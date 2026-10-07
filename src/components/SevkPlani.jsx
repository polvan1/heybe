// Sevkiyat planı: araçlar, bekleyen irsaliyeler, çoklu araç rota planı,
// şoförlere gönderme ve aktif seferlerin canlı takibi.
import { useEffect, useMemo, useState } from 'react';
import { Truck, Plus, Trash2, Send, Navigation, Share2, AlertTriangle, RefreshCw, X, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { hasYetki } from '../data/yetki';
import { IRSALIYE_DURUM_LABELS, SEFER_DURUM_LABELS } from '../data/db';
import {
    rotaPlanla, cokluAracPlanla, siraliRotaKm, googleHaritaLinki, konumVarMi,
    kmYazi, sureYazi, seferDuraklari, seferHaritaDuraklari,
} from '../utils/rota';

const BEKLEYEN_IRSALIYE = ['taslak', 'onaylandi'];
const AKTIF_SEFER = ['atandi', 'yolda'];
const CANLI_YENILEME_MS = 20000;

function zamanFarki(iso) {
    if (!iso) return '';
    const dk = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (dk < 1) return 'az önce';
    if (dk < 60) return `${dk} dk önce`;
    return `${Math.floor(dk / 60)} sa önce`;
}

function rotaMetni(baslik, plan, baslangicAdi) {
    const satirlar = [baslik, `Toplam ~${kmYazi(plan.toplamKm)}, ~${sureYazi(plan.sureDk)}`, ''];
    plan.duraklar.forEach((d, i) => {
        if (d.tip === 'baslangic') satirlar.push(`Çıkış: ${baslangicAdi}`);
        else if (d.tip === 'donus') satirlar.push(`Dönüş: ${baslangicAdi}`);
        else {
            satirlar.push(`${i}. ${d.konum.ad}`);
            d.teslimler.forEach(g => satirlar.push(`   ↓ Bırak: ${g.etiket} (${g.adet} ad)`));
            d.alimlar.forEach(g => satirlar.push(`   ↑ Al: ${g.etiket} (${g.adet} ad)`));
        }
    });
    const link = googleHaritaLinki(plan.duraklar);
    if (link) satirlar.push('', link.url);
    return satirlar.join('\n');
}

export default function SevkPlani({ baslangicSecenekleri, firmaById, onHaritaVerisi }) {
    const {
        irsaliyeler, kullanicilar, currentUser, araclar, seferler,
        aracEkle, aracSil, seferleriGonder, seferIptal, sunucudanYenile,
    } = useApp();
    const [baslangicId, setBaslangicId] = useState('merkez');
    const [donus, setDonus] = useState(true);
    const [haricTutulan, setHaricTutulan] = useState(() => new Set());
    const [secilenAraclar, setSecilenAraclar] = useState(null); // null = tüm aktif araçlar
    const [aracFormu, setAracFormu] = useState(null);
    const [mesaj, setMesaj] = useState('');
    const [islemde, setIslemde] = useState(false);

    const duzenleyebilir = hasYetki(currentUser, 'harita');
    const soforler = kullanicilar.filter(k => k.rol === 'sofor' && k.aktif !== false);
    const kullaniciAdi = (id) => kullanicilar.find(k => k.id === id)?.ad || '';
    const aktifAraclar = araclar.filter(a => a.aktif !== false);
    const aracRenk = (id) => Math.max(0, araclar.findIndex(a => a.id === id)) % 6;

    const baslangic = baslangicSecenekleri.find(b => b.id === baslangicId) || baslangicSecenekleri[0];

    // Aktif seferde olan irsaliyeler tekrar planlanmaz
    const seferdekiIrsaliyeler = useMemo(() => {
        const m = new Map();
        seferler.filter(s => AKTIF_SEFER.includes(s.durum)).forEach(s => (s.duraklar || []).forEach(d =>
            [...(d.alimlar || []), ...(d.teslimler || [])].forEach(g => m.set(g.irsaliyeId, s))));
        return m;
    }, [seferler]);

    const bekleyenler = useMemo(() => irsaliyeler
        .filter(i => BEKLEYEN_IRSALIYE.includes(i.durum))
        .map(i => {
            const g = firmaById[i.gonderenFirmaId], a = firmaById[i.alanFirmaId];
            const eksik = [g, a].filter(f => !f || !konumVarMi(f)).map(f => f?.ad || 'Bilinmeyen firma');
            const sefer = seferdekiIrsaliyeler.get(i.id);
            return {
                irsaliye: i, eksik, sefer,
                gorev: eksik.length || sefer ? null : {
                    id: i.id, etiket: `${i.irsaliyeNo || ''} · ${i.partiNo || ''}`.trim(),
                    adet: +i.toplamAdet || 0, urunAdi: i.urunAdi || '',
                    alim: { ad: g.ad, lat: +g.lat, lng: +g.lng, firmaId: g.id },
                    teslim: { ad: a.ad, lat: +a.lat, lng: +a.lng, firmaId: a.id },
                },
            };
        })
        .sort((x, y) => String(x.irsaliye.tarih || '').localeCompare(String(y.irsaliye.tarih || ''))), [irsaliyeler, firmaById, seferdekiIrsaliyeler]);

    const seciliGorevler = bekleyenler.filter(b => b.gorev && !haricTutulan.has(b.irsaliye.id)).map(b => b.gorev);
    const planAraclari = (secilenAraclar ? aktifAraclar.filter(a => secilenAraclar.has(a.id)) : aktifAraclar);

    // Araç tanımlı değilse tek (isimsiz) araçla planlanır
    const planAnahtari = JSON.stringify([baslangic?.konum, seciliGorevler, donus, planAraclari.map(a => a.id)]);
    const sonuc = useMemo(() => {
        if (!baslangic || !seciliGorevler.length) return null;
        if (planAraclari.length <= 1) {
            const p = rotaPlanla({ baslangic: baslangic.konum, gorevler: seciliGorevler, donus });
            return { planlar: [{ aracId: planAraclari[0]?.id || null, plan: p, gorevler: seciliGorevler }], enUzunDk: p.sureDk, toplamKm: p.toplamKm };
        }
        return cokluAracPlanla({
            araclar: planAraclari.map(a => ({ id: a.id, baslangic: baslangic.konum, donus })),
            gorevler: seciliGorevler,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planAnahtari]);
    const doluPlanlar = sonuc ? sonuc.planlar.filter(p => p.plan) : [];
    const siraliKm = sonuc ? siraliRotaKm({ baslangic: baslangic.konum, gorevler: seciliGorevler, donus }) : 0;
    const kazanc = sonuc && siraliKm > 0 ? Math.round((1 - sonuc.toplamKm / siraliKm) * 100) : 0;
    const soforsuzAraclar = doluPlanlar.filter(p => !p.aracId || !araclar.find(a => a.id === p.aracId)?.soforId);

    const aktifSeferler = seferler.filter(s => AKTIF_SEFER.includes(s.durum));
    const bugunBitenler = seferler.filter(s => s.durum === 'tamamlandi' && String(s.bitisZamani || '').slice(0, 10) === new Date().toISOString().slice(0, 10));

    // Haritaya: plan varsa plan rotaları, yoksa aktif seferler + araç konumları
    const haritaAnahtari = JSON.stringify([doluPlanlar.map(p => p.aracId + p.plan.toplamKm), aktifSeferler.map(s => s.id + s.updatedAt), araclar.map(a => a.sonKonumZamani)]);
    useEffect(() => {
        const rotalar = doluPlanlar.length
            ? doluPlanlar.map(p => ({ renk: aracRenk(p.aracId), duraklar: p.plan.duraklar }))
            : aktifSeferler.map(s => ({ renk: aracRenk(s.aracId), duraklar: seferHaritaDuraklari(s) }));
        const aracKonumlari = araclar
            .filter(a => konumVarMi({ lat: a.sonLat, lng: a.sonLng }) && aktifSeferler.some(s => s.aracId === a.id))
            .map(a => ({ id: a.id, lat: +a.sonLat, lng: +a.sonLng, renk: aracRenk(a.id), etiket: `${a.ad} · ${zamanFarki(a.sonKonumZamani)}` }));
        onHaritaVerisi({ rotalar, araclar: aracKonumlari });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [haritaAnahtari]);
    useEffect(() => () => onHaritaVerisi(null), [onHaritaVerisi]);

    // Canlı takip: aktif sefer varken ekran açıkken sık yenile
    useEffect(() => {
        if (!aktifSeferler.length) return;
        const t = setInterval(() => { if (document.visibilityState === 'visible') sunucudanYenile(); }, CANLI_YENILEME_MS);
        return () => clearInterval(t);
    }, [aktifSeferler.length, sunucudanYenile]);

    const gonder = () => {
        if (!doluPlanlar.length || soforsuzAraclar.length) return;
        const liste = doluPlanlar.map(p => {
            const a = araclar.find(x => x.id === p.aracId);
            return {
                aracId: a.id, aracAdi: a.ad, soforId: a.soforId, soforAd: kullaniciAdi(a.soforId),
                baslangicAdi: baslangic.ad, duraklar: seferDuraklari(p.plan.duraklar),
                toplamKm: Math.round(p.plan.toplamKm * 10) / 10, sureDk: p.plan.sureDk,
            };
        });
        seferleriGonder(liste);
        setHaricTutulan(new Set());
        setMesaj(`${liste.length} sefer şoförlere gönderildi. Şoförün telefonuna bildirim düştü; ilerlemeyi aşağıdan izleyebilirsiniz.`);
    };

    const iptalEt = async (s) => {
        if (!window.confirm(`${s.aracAdi || 'Araç'} seferi iptal edilsin mi?`)) return;
        setIslemde(true);
        try { await seferIptal(s.id); } catch (e) { alert('İptal edilemedi: ' + e.message); }
        setIslemde(false);
    };

    const aracKaydet = (e) => {
        e.preventDefault();
        if (!aracFormu.ad.trim()) return;
        aracEkle({ ad: aracFormu.ad.trim(), plaka: aracFormu.plaka.trim().toUpperCase(), soforId: aracFormu.soforId || null });
        setAracFormu(null);
    };

    const aracSecimiDegistir = (id) => setSecilenAraclar(s => {
        const y = new Set(s || aktifAraclar.map(a => a.id));
        if (y.has(id)) y.delete(id); else y.add(id);
        return y;
    });
    const gorevDegistir = (id) => setHaricTutulan(s => {
        const y = new Set(s);
        if (y.has(id)) y.delete(id); else y.add(id);
        return y;
    });

    if (!baslangicSecenekleri.length) {
        return (
            <div className="card harita-bos">
                <p>Rota planlamak için önce <strong>Üretim Yerleri</strong> sekmesinden araç çıkış noktasını ve firma konumlarını girin.</p>
            </div>
        );
    }

    return (
        <>
            {/* ---- Aktif seferler (canlı) ---- */}
            {(aktifSeferler.length > 0 || bugunBitenler.length > 0) && (
                <>
                    <h3 className="harita-baslik sevk-baslik">
                        Yoldaki seferler ({aktifSeferler.length})
                        <button className="btn-icon" aria-label="Şimdi yenile" title="Şimdi yenile" onClick={sunucudanYenile}><RefreshCw size={15} /></button>
                    </h3>
                    <ul className="harita-gorevler">
                        {[...aktifSeferler, ...bugunBitenler].map(s => {
                            const duraklar = (s.duraklar || []).filter(d => d.tip === 'durak');
                            const biten = duraklar.filter(d => d.durum === 'tamamlandi').length;
                            const arac = araclar.find(a => a.id === s.aracId);
                            const siradaki = duraklar.find(d => d.durum !== 'tamamlandi');
                            return (
                                <li key={s.id} className={`card sefer-kart harita-renk-${aracRenk(s.aracId)}`}>
                                    <div className="sefer-ust">
                                        <i className="arac-renk" />
                                        <strong>{s.aracAdi || arac?.ad || 'Araç'}</strong>
                                        <span className="sefer-sofor">{s.soforAd || kullaniciAdi(s.soforId)}</span>
                                        <span className={`sefer-durum sefer-durum--${s.durum}`}>{SEFER_DURUM_LABELS[s.durum]}</span>
                                    </div>
                                    <div className="sefer-ilerleme" aria-label={`${biten}/${duraklar.length} durak tamamlandı`}>
                                        <span style={{ width: `${duraklar.length ? (biten / duraklar.length) * 100 : 0}%` }} />
                                    </div>
                                    <div className="sefer-alt">
                                        <span>{biten}/{duraklar.length} durak · ~{kmYazi(s.toplamKm)}</span>
                                        {siradaki && s.durum !== 'tamamlandi' && <span>Sıradaki: <strong>{siradaki.ad}</strong></span>}
                                        {arac?.sonKonumZamani && AKTIF_SEFER.includes(s.durum) && <span>Konum: {zamanFarki(arac.sonKonumZamani)}</span>}
                                    </div>
                                    {duzenleyebilir && AKTIF_SEFER.includes(s.durum) && (
                                        <button className="btn btn-ghost sefer-iptal" disabled={islemde} onClick={() => iptalEt(s)}><X size={14} /> Seferi iptal et</button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            {/* ---- Araçlar ---- */}
            <h3 className="harita-baslik">Araçlar ({aktifAraclar.length})</h3>
            {aktifAraclar.length === 0 && (
                <p className="harita-not">Henüz araç yok. Araç ekleyip şoför atarsanız rota araçlara bölünür ve her şoföre kendi seferi gönderilir.</p>
            )}
            <ul className="harita-gorevler">
                {aktifAraclar.map(a => {
                    const secili = !secilenAraclar || secilenAraclar.has(a.id);
                    const mesgul = aktifSeferler.some(s => s.aracId === a.id);
                    return (
                        <li key={a.id} className={`card harita-gorev harita-renk-${aracRenk(a.id)}`}>
                            <label>
                                <input type="checkbox" checked={secili} onChange={() => aracSecimiDegistir(a.id)} />
                                <span className="harita-gorev-icerik">
                                    <span className="harita-gorev-ust"><i className="arac-renk" /> <strong>{a.ad}</strong> {a.plaka && <span className="arac-plaka">{a.plaka}</span>}
                                        {mesgul && <span className="harita-gorev-durum">Seferde</span>}
                                    </span>
                                    <span className={a.soforId ? 'harita-gorev-adet' : 'harita-konum-yok'}>
                                        {a.soforId ? `Şoför: ${kullaniciAdi(a.soforId)}` : <><AlertTriangle size={13} /> Şoför atanmamış</>}
                                    </span>
                                </span>
                            </label>
                            {duzenleyebilir && (
                                <button className="btn-icon arac-sil" aria-label={`${a.ad} aracını sil`}
                                    onClick={() => { if (window.confirm(`${a.ad} silinsin mi?`)) aracSil(a.id); }}><Trash2 size={15} /></button>
                            )}
                        </li>
                    );
                })}
            </ul>
            {duzenleyebilir && (aracFormu ? (
                <form className="card arac-formu" onSubmit={aracKaydet}>
                    <div className="arac-formu-satir">
                        <div className="form-group">
                            <label className="form-label" htmlFor="arac-ad">Araç adı</label>
                            <input id="arac-ad" className="form-input" value={aracFormu.ad} onChange={e => setAracFormu({ ...aracFormu, ad: e.target.value })} placeholder="Örn: Kamyonet 1" autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="arac-plaka">Plaka</label>
                            <input id="arac-plaka" className="form-input" value={aracFormu.plaka} onChange={e => setAracFormu({ ...aracFormu, plaka: e.target.value })} placeholder="34 ABC 123" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="arac-sofor">Şoför</label>
                        <select id="arac-sofor" className="form-input" value={aracFormu.soforId} onChange={e => setAracFormu({ ...aracFormu, soforId: e.target.value })}>
                            <option value="">— Seçin —</option>
                            {soforler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
                        </select>
                        {soforler.length === 0 && <p className="harita-not">Şoför listesi boş. Kullanıcılar sayfasından rolü "Şoför" olan bir kullanıcı ekleyin.</p>}
                    </div>
                    <div className="harita-rota-aksiyon">
                        <button type="button" className="btn btn-ghost" onClick={() => setAracFormu(null)}>Vazgeç</button>
                        <button type="submit" className="btn btn-primary"><Check size={16} /> Aracı kaydet</button>
                    </div>
                </form>
            ) : (
                <button className="btn btn-ghost arac-ekle" onClick={() => setAracFormu({ ad: '', plaka: '', soforId: '' })}><Plus size={16} /> Araç ekle</button>
            ))}

            {/* ---- Plan ayarları ---- */}
            <div className="card harita-rota-ayar">
                <div className="form-group">
                    <label className="form-label" htmlFor="rota-baslangic">Araçlar nereden çıkıyor?</label>
                    <select id="rota-baslangic" className="form-input" value={baslangic?.id} onChange={e => setBaslangicId(e.target.value)}>
                        {baslangicSecenekleri.map(b => <option key={b.id} value={b.id}>{b.ad}</option>)}
                    </select>
                </div>
                <label className="harita-onay">
                    <input type="checkbox" checked={donus} onChange={e => setDonus(e.target.checked)} />
                    İş bitince çıkış noktasına dön
                </label>
            </div>

            {/* ---- Bekleyen sevkiyatlar ---- */}
            <h3 className="harita-baslik">Bekleyen sevkiyatlar ({bekleyenler.length})</h3>
            {bekleyenler.length === 0 ? (
                <p className="harita-not">Teslim edilmemiş irsaliye yok. Taslak ya da onaylanmış irsaliyeler burada listelenir.</p>
            ) : (
                <ul className="harita-gorevler">
                    {bekleyenler.map(({ irsaliye: i, gorev, eksik, sefer }) => (
                        <li key={i.id} className={`card harita-gorev ${!gorev ? 'harita-gorev--pasif' : ''}`}>
                            <label>
                                <input type="checkbox" disabled={!gorev} checked={!!gorev && !haricTutulan.has(i.id)} onChange={() => gorevDegistir(i.id)} />
                                <span className="harita-gorev-icerik">
                                    <span className="harita-gorev-ust">
                                        <strong>{i.irsaliyeNo}</strong> · {i.partiNo}
                                        <span className="harita-gorev-durum">{sefer ? `Seferde: ${sefer.aracAdi || ''}` : IRSALIYE_DURUM_LABELS[i.durum]}</span>
                                    </span>
                                    <span className="harita-gorev-yol">{i.gonderenFirmaAdi} → {i.alanFirmaAdi}</span>
                                    <span className="harita-gorev-adet">{Number(i.toplamAdet || 0).toLocaleString('tr-TR')} adet · {i.urunAdi}</span>
                                    {eksik.length > 0 && <span className="harita-konum-yok"><AlertTriangle size={13} /> Konum eksik: {eksik.join(', ')}</span>}
                                </span>
                            </label>
                        </li>
                    ))}
                </ul>
            )}

            {/* ---- Plan sonucu ---- */}
            {sonuc && (
                <div className="card harita-sonuc">
                    <div className="harita-ozet">
                        <div><span>{doluPlanlar.length > 1 ? 'Son biten araç' : 'Tahmini süre'}</span><strong>~{sureYazi(sonuc.enUzunDk)}</strong></div>
                        <div><span>Toplam yol</span><strong>~{kmYazi(sonuc.toplamKm)}</strong></div>
                        <div><span>Araç</span><strong>{doluPlanlar.length}</strong></div>
                    </div>
                    {kazanc > 0 && (
                        <p className="harita-kazanc">Tek araçla tarih sırasıyla taşımaya göre toplam yol <strong>%{kazanc} daha kısa</strong> ({kmYazi(siraliKm)} yerine).</p>
                    )}

                    {doluPlanlar.map(({ aracId, plan }) => {
                        const arac = araclar.find(a => a.id === aracId);
                        const gLink = googleHaritaLinki(plan.duraklar);
                        const baslik = `${arac ? arac.ad : 'Sevkiyat'} — ${new Date().toLocaleDateString('tr-TR')}`;
                        return (
                            <section key={aracId || 'tek'} className={`arac-plan harita-renk-${aracRenk(aracId)}`}>
                                <div className="sefer-ust">
                                    <i className="arac-renk" />
                                    <strong>{arac ? arac.ad : 'Rota'}</strong>
                                    {arac && <span className="sefer-sofor">{arac.soforId ? kullaniciAdi(arac.soforId) : 'Şoför yok'}</span>}
                                    <span className="arac-plan-ozet">~{kmYazi(plan.toplamKm)} · ~{sureYazi(plan.sureDk)}</span>
                                </div>
                                <ol className="harita-duraklar">
                                    {plan.duraklar.map((d, i) => (
                                        <li key={i} className={`harita-durak-satir harita-durak-satir--${d.tip}`}>
                                            <span className="harita-durak-no">{d.tip === 'durak' ? i : d.tip === 'baslangic' ? 'Ç' : 'D'}</span>
                                            <div>
                                                <strong>{d.tip === 'baslangic' ? `Çıkış: ${baslangic.ad}` : d.tip === 'donus' ? `Dönüş: ${baslangic.ad}` : d.konum.ad}</strong>
                                                {d.km > 0 && <span className="harita-durak-km">+{kmYazi(d.km)}</span>}
                                                {d.teslimler.map(g => <span key={'t' + g.id} className="harita-is harita-is--birak">Bırak: {g.etiket} ({g.adet.toLocaleString('tr-TR')} ad)</span>)}
                                                {d.alimlar.map(g => <span key={'a' + g.id} className="harita-is harita-is--al">Al: {g.etiket} ({g.adet.toLocaleString('tr-TR')} ad)</span>)}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                                <div className="harita-rota-aksiyon">
                                    {gLink && <a className="btn btn-ghost" href={gLink.url} target="_blank" rel="noopener noreferrer"><Navigation size={16} /> Google Haritalar</a>}
                                    <a className="btn btn-ghost" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(rotaMetni(baslik, plan, baslangic.ad))}`} target="_blank" rel="noopener noreferrer"><Share2 size={16} /> WhatsApp</a>
                                </div>
                            </section>
                        );
                    })}

                    {duzenleyebilir && aktifAraclar.length > 0 && (
                        <>
                            {soforsuzAraclar.length > 0 && (
                                <p className="harita-not"><AlertTriangle size={14} /> Göndermek için her araca bir şoför atanmalı.</p>
                            )}
                            <button className="btn btn-primary sevk-gonder" disabled={soforsuzAraclar.length > 0} onClick={gonder}>
                                <Send size={16} /> Şoförlere gönder ({doluPlanlar.length} sefer)
                            </button>
                        </>
                    )}
                    {mesaj && <p className="harita-kazanc">{mesaj}</p>}
                    <p className="harita-not">
                        Mesafeler kuş uçuşu × 1,3 yol katsayısıyla tahmini hesaplanır; süreye durak başı 10 dk yükleme eklenir.
                        {doluPlanlar.length > 1 && ' Sevkiyatlar, en geç biten araç mümkün olduğunca erken bitecek şekilde araçlara dağıtılır.'}
                    </p>
                </div>
            )}
            {!sonuc && mesaj && <p className="harita-kazanc">{mesaj}</p>}
            {!duzenleyebilir && <p className="harita-not"><Truck size={14} /> Sefer göndermek için "Harita ve Rota" yetkisi gerekir.</p>}
        </>
    );
}
