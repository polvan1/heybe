// Şoför ekranı: kendisine atanan seferler, sıradaki durak, durak tamamlama,
// yol tarifi ve canlı konum paylaşımı. Ekran açıkken sık sık sunucudan yenilenir;
// yeni sefer gelince telefona bildirim (push) de düşer.
import { useEffect, useRef, useState } from 'react';
import { Truck, Navigation, Phone, Check, RotateCcw, MapPin, Bell, LocateFixed, PackageCheck, PackageOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SEFER_DURUM_LABELS } from '../data/db';
import HaritaGorunum from '../components/HaritaGorunum';
import { kmYazi, sureYazi, seferHaritaDuraklari } from '../utils/rota';
import { pushDurumu, pushAc } from '../data/push';

const DEMO = import.meta.env.VITE_DEMO === '1';
const YENILEME_MS = 15000;
const KONUM_ARALIK_MS = 30000;
const AKTIF = ['atandi', 'yolda'];
const KONUM_TERCIH = 'hiserp_konum_paylas';

const saat = (iso) => (iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
const yolTarifi = (d) => `https://www.google.com/maps/dir/?api=1&destination=${(+d.lat).toFixed(6)},${(+d.lng).toFixed(6)}&travelmode=driving`;

// Kalan duraklar için tek bağlantı (başlangıç verilmez → Google mevcut konumu kullanır)
function kalanRotaLinki(duraklar) {
    const kalan = duraklar.filter(d => d.tip === 'durak' && d.durum !== 'tamamlandi');
    const donus = duraklar.find(d => d.tip === 'donus');
    const noktalar = [...kalan, ...(donus ? [donus] : [])].map(d => `${(+d.lat).toFixed(6)},${(+d.lng).toFixed(6)}`);
    if (!noktalar.length) return null;
    const p = new URLSearchParams({ api: '1', destination: noktalar[noktalar.length - 1], travelmode: 'driving' });
    const ara = noktalar.slice(0, -1).slice(0, 9);
    if (ara.length) p.set('waypoints', ara.join('|'));
    return 'https://www.google.com/maps/dir/?' + p.toString();
}

function tercihOku() {
    try { return localStorage.getItem(KONUM_TERCIH) === '1'; } catch (e) { return false; }
}
function tercihYaz(v) {
    try { localStorage.setItem(KONUM_TERCIH, v ? '1' : '0'); } catch (e) { /* yoksay */ }
}

export default function Gorevlerim() {
    const { seferler, firmalar, currentUser, seferDurakIsle, sunucudanYenile, konumGonder } = useApp();
    const [islemde, setIslemde] = useState(null);
    const [yeniSefer, setYeniSefer] = useState(false);
    const [konumAcik, setKonumAcik] = useState(tercihOku);
    const [konumDurumu, setKonumDurumu] = useState('');
    const [bildirim, setBildirim] = useState(null);
    const gorulenRef = useRef(null);
    const sonGonderimRef = useRef(0);

    const benim = seferler.filter(s => s.soforId === currentUser?.id);
    const aktif = benim.filter(s => AKTIF.includes(s.durum)).sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
    const gecmis = benim.filter(s => !AKTIF.includes(s.durum)).slice(0, 5);
    const sefer = aktif[0];
    const firmaTel = (id) => firmalar.find(f => f.id === id)?.telefon || '';

    // Sık yenileme (ekran açıkken)
    useEffect(() => {
        sunucudanYenile();
        const t = setInterval(() => { if (document.visibilityState === 'visible') sunucudanYenile(); }, YENILEME_MS);
        return () => clearInterval(t);
    }, [sunucudanYenile]);

    // Yeni sefer geldiğinde uyar
    useEffect(() => {
        const idler = new Set(benim.map(s => s.id));
        if (gorulenRef.current) {
            const yeni = [...idler].some(id => !gorulenRef.current.has(id));
            if (yeni) {
                setYeniSefer(true);
                try { navigator.vibrate?.([200, 100, 200]); } catch (e) { /* desteklenmiyor */ }
            }
        }
        gorulenRef.current = idler;
    }, [benim.map(s => s.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps

    // Bildirim izni durumu
    useEffect(() => {
        if (DEMO) return;
        pushDurumu().then(setBildirim).catch(() => setBildirim(null));
    }, []);

    // Canlı konum paylaşımı (aktif sefer varken ve ekran açıkken)
    useEffect(() => {
        if (!konumAcik || !sefer) return;
        if (!('geolocation' in navigator)) { setKonumDurumu('Bu cihaz konum paylaşımını desteklemiyor.'); return; }
        setKonumDurumu('Konum alınıyor…');
        const izle = navigator.geolocation.watchPosition(
            async (p) => {
                const simdi = Date.now();
                if (simdi - sonGonderimRef.current < KONUM_ARALIK_MS) return;
                sonGonderimRef.current = simdi;
                try {
                    await konumGonder(p.coords.latitude, p.coords.longitude);
                    setKonumDurumu(`Konum paylaşılıyor · son gönderim ${saat(new Date().toISOString())}`);
                } catch (e) { setKonumDurumu('Konum gönderilemedi, tekrar denenecek.'); }
            },
            (e) => setKonumDurumu(e.code === 1 ? 'Konum izni verilmedi. Tarayıcı ayarlarından izin verin.' : 'Konum alınamadı.'),
            { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
        );
        return () => navigator.geolocation.clearWatch(izle);
    }, [konumAcik, sefer?.id, konumGonder]);

    const durakIsle = async (durakNo, islem) => {
        if (islem === 'tamamla' && !window.confirm('Bu durak tamamlandı olarak işaretlensin mi?')) return;
        setIslemde(durakNo);
        try { await seferDurakIsle(sefer.id, durakNo, islem); } catch (e) { alert('Kaydedilemedi: ' + e.message); }
        setIslemde(null);
    };

    const bildirimleriAc = async () => {
        try { await pushAc(); setBildirim('acik'); } catch (e) { alert(e.message); }
    };

    if (!sefer) {
        return (
            <div className="gorev-sayfa">
                {bildirim && bildirim !== 'acik' && bildirim !== 'desteklenmiyor' && (
                    <button className="btn btn-primary gorev-bildirim" onClick={bildirimleriAc}><Bell size={16} /> Yeni sefer gelince telefonuma bildir</button>
                )}
                <div className="card gorev-bos">
                    <Truck size={36} />
                    <h2>Şu an atanmış seferiniz yok</h2>
                    <p>Yeni sefer atandığında bu ekran kendiliğinden güncellenir{DEMO ? '' : ' ve telefonunuza bildirim gelir'}.</p>
                </div>
                {gecmis.length > 0 && <GecmisSeferler liste={gecmis} />}
            </div>
        );
    }

    const duraklar = sefer.duraklar || [];
    const isDuraklari = duraklar.map((d, i) => ({ ...d, no: i })).filter(d => d.tip === 'durak');
    const biten = isDuraklari.filter(d => d.durum === 'tamamlandi').length;
    const siradaki = isDuraklari.find(d => d.durum !== 'tamamlandi');
    const kalanLink = kalanRotaLinki(duraklar);

    return (
        <div className="gorev-sayfa">
            {yeniSefer && (
                <div className="gorev-yeni" role="status">
                    <Bell size={16} /> <span>Yeni sefer atandı.</span>
                    <button className="btn-icon" aria-label="Kapat" onClick={() => setYeniSefer(false)}>×</button>
                </div>
            )}

            <div className="card gorev-ozet">
                <div className="sefer-ust">
                    <Truck size={18} />
                    <strong>{sefer.aracAdi || 'Sefer'}</strong>
                    <span className={`sefer-durum sefer-durum--${sefer.durum}`}>{SEFER_DURUM_LABELS[sefer.durum]}</span>
                </div>
                <div className="sefer-ilerleme"><span style={{ width: `${isDuraklari.length ? (biten / isDuraklari.length) * 100 : 0}%` }} /></div>
                <div className="sefer-alt">
                    <span>{biten}/{isDuraklari.length} durak tamamlandı</span>
                    <span>~{kmYazi(sefer.toplamKm)} · ~{sureYazi(sefer.sureDk || 0)}</span>
                    {sefer.olusturanAd && <span>Gönderen: {sefer.olusturanAd}</span>}
                </div>
                {kalanLink && (
                    <a className="btn btn-primary gorev-tum-rota" href={kalanLink} target="_blank" rel="noopener noreferrer">
                        <Navigation size={16} /> Kalan rotayı Google Haritalar'da aç
                    </a>
                )}
            </div>

            {siradaki && (
                <div className="card gorev-siradaki">
                    <span className="gorev-etiket">Sıradaki durak · {siradaki.no}</span>
                    <h2>{siradaki.ad}</h2>
                    <DurakIsleri d={siradaki} />
                    <div className="gorev-aksiyonlar">
                        <a className="btn btn-ghost" href={yolTarifi(siradaki)} target="_blank" rel="noopener noreferrer"><Navigation size={16} /> Yol tarifi</a>
                        {firmaTel(siradaki.firmaId) && (
                            <a className="btn btn-ghost" href={`tel:${firmaTel(siradaki.firmaId).replace(/\s/g, '')}`}><Phone size={16} /> {firmaTel(siradaki.firmaId)}</a>
                        )}
                    </div>
                    <button className="btn btn-primary gorev-tamamla" disabled={islemde !== null} onClick={() => durakIsle(siradaki.no, 'tamamla')}>
                        <Check size={18} /> {islemde === siradaki.no ? 'Kaydediliyor…' : 'Bu durak tamamlandı'}
                    </button>
                </div>
            )}

            <HaritaGorunum
                mod={DEMO ? 'sade' : 'sokak'}
                rotalar={[{ renk: 0, duraklar: seferHaritaDuraklari(sefer) }]}
                odakAnahtari={sefer.id}
            />

            <div className="card gorev-konum">
                <label className="harita-onay">
                    <input type="checkbox" checked={konumAcik} onChange={e => { setKonumAcik(e.target.checked); tercihYaz(e.target.checked); if (!e.target.checked) setKonumDurumu(''); }} />
                    <LocateFixed size={16} /> Konumumu sevk sorumlusuyla paylaş
                </label>
                <p className="harita-not">
                    {konumDurumu || 'Açıkken konumunuz yarım dakikada bir gönderilir; sadece bu ekran açıkken çalışır.'}
                </p>
            </div>

            {bildirim && bildirim !== 'acik' && bildirim !== 'desteklenmiyor' && (
                <button className="btn btn-ghost gorev-bildirim" onClick={bildirimleriAc}><Bell size={16} /> Yeni sefer gelince telefonuma bildir</button>
            )}

            <h3 className="harita-baslik">Tüm duraklar</h3>
            <ol className="gorev-duraklar">
                {isDuraklari.map(d => (
                    <li key={d.no} className={`card gorev-durak ${d.durum === 'tamamlandi' ? 'gorev-durak--tamam' : ''} ${d === siradaki ? 'gorev-durak--siradaki' : ''}`}>
                        <span className="harita-durak-no">{d.durum === 'tamamlandi' ? '✓' : d.no}</span>
                        <div className="gorev-durak-icerik">
                            <strong>{d.ad}</strong>
                            <DurakIsleri d={d} />
                            {d.durum === 'tamamlandi' && (
                                <span className="gorev-durak-zaman">
                                    {saat(d.tamamlanmaZamani)} tamamlandı
                                    <button className="btn-icon" aria-label="Geri al" title="Yanlışlıkla işaretlediyseniz geri alın"
                                        disabled={islemde !== null} onClick={() => durakIsle(d.no, 'geri_al')}><RotateCcw size={13} /></button>
                                </span>
                            )}
                        </div>
                        {d.durum !== 'tamamlandi' && (
                            <a className="btn-icon" href={yolTarifi(d)} target="_blank" rel="noopener noreferrer" aria-label={`${d.ad} yol tarifi`}><MapPin size={16} /></a>
                        )}
                    </li>
                ))}
            </ol>
            {aktif.length > 1 && <p className="harita-not">Bu seferden sonra {aktif.length - 1} sefer daha sırada.</p>}
            {gecmis.length > 0 && <GecmisSeferler liste={gecmis} />}
        </div>
    );
}

function DurakIsleri({ d }) {
    return (
        <>
            {(d.teslimler || []).map(g => (
                <span key={'t' + g.irsaliyeId} className="harita-is harita-is--birak"><PackageCheck size={13} /> Bırak: {g.etiket} · {Number(g.adet).toLocaleString('tr-TR')} ad</span>
            ))}
            {(d.alimlar || []).map(g => (
                <span key={'a' + g.irsaliyeId} className="harita-is harita-is--al"><PackageOpen size={13} /> Al: {g.etiket} · {Number(g.adet).toLocaleString('tr-TR')} ad</span>
            ))}
        </>
    );
}

function GecmisSeferler({ liste }) {
    return (
        <>
            <h3 className="harita-baslik">Son seferler</h3>
            <ul className="harita-gorevler">
                {liste.map(s => (
                    <li key={s.id} className="card sefer-kart">
                        <div className="sefer-ust">
                            <strong>{s.aracAdi || 'Sefer'}</strong>
                            <span className="sefer-sofor">{new Date(s.tarih).toLocaleDateString('tr-TR')}</span>
                            <span className={`sefer-durum sefer-durum--${s.durum}`}>{SEFER_DURUM_LABELS[s.durum]}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </>
    );
}
