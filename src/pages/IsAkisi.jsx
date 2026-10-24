import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MapPin, QrCode, ChevronRight, Gauge, AlertTriangle } from 'lucide-react';
import { DURUM_LABELS, DURUM_SIRALAMA, partiDurumEtiketi } from '../data/db';
import PartiIlerletModal, { sonrakiAdim, adimYapabilirMi } from '../components/PartiIlerletModal';
import { yazdirPartiEtiketi } from '../utils/partiEtiketi';
import { atolyeYukleri, partiKalanAdet } from '../utils/kapasite';

const KANBAN_COLUMNS = [
    { key: 'kesimde', label: 'Kesim' },
    { key: 'dikimde', label: 'Dikim' },
    { key: 'utupakette', label: 'Ütü & Paket' },
    { key: 'tamamlandi', label: 'Tamamlandı' },
];
// Aşamada bu kadar günden uzun kalan kart kırmızı rozetle işaretlenir
const GECIKME_GUN = { kesimde: 5, dikimde: 14, utupakette: 5 };
const ASAMA_FIRMA = { kesimde: 'kesimhaneId', dikimde: 'dikimhaneId', utupakette: 'utupaketciId' };

// Partinin şu anki aşamaya giriş tarihi
function asamaBaslangici(p) {
    if (p.durum === 'dikimde') return p.dikimBaslamaTarihi || p.gonderimTarihi || p.updatedAt || p.createdAt;
    if (p.durum === 'utupakette') return p.dikimBitisTarihi || p.updatedAt || p.createdAt;
    if (p.durum === 'tamamlandi') return p.updatedAt || p.createdAt;
    return p.createdAt;
}
const gunFarki = (t) => (t ? Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 86400000)) : 0);
const yukEtiketi = { normal: 'Normal', yogun: 'Yoğun', darbogaz: 'Darboğaz', bilinmiyor: 'Kapasite yok' };

export default function IsAkisi() {
    const { partiler, firmalar, currentUser } = useApp();
    const navigate = useNavigate();
    const kapRef = useRef(null);
    const surukle = useRef(null);          // { parti, baslangic, aktif, zamanlayici, pointerId }
    const [hayalet, setHayalet] = useState(null); // { parti, x, y }
    const [hedef, setHedef] = useState(null);     // üzerinde bulunulan kolon
    const [ilerletParti, setIlerletParti] = useState(null);
    const [uyari, setUyari] = useState('');

    const aktifPartiler = partiler.filter(p => !p.arsivde);
    const yukler = useMemo(() => atolyeYukleri(partiler, firmalar), [partiler, firmalar]);
    const darbogazSayisi = yukler.filter(y => y.durum === 'darbogaz').length;
    const firmaAdi = (id) => firmalar.find(f => f.id === id)?.ad || '';

    useEffect(() => {
        if (!uyari) return undefined;
        const t = setTimeout(() => setUyari(''), 3500);
        return () => clearTimeout(t);
    }, [uyari]);

    // ---- Sürükle-bırak (fare + dokunmatik; telefonda uzun bas) ----
    // Pencere dinleyicileri bir kez oluşturulur (eklenen ve kaldırılan fonksiyon aynı olsun)
    const surukleBitti = useRef(0);
    const isleyici = useRef(null);
    if (!isleyici.current) {
        const kolonBul = (x, y) => document.elementFromPoint(x, y)?.closest('[data-durum]')?.getAttribute('data-durum') || null;
        const kaydirmayiEngelle = (e) => { if (surukle.current?.aktif) e.preventDefault(); };
        const temizle = () => {
            const s = surukle.current;
            if (s?.zamanlayici) clearTimeout(s.zamanlayici);
            window.removeEventListener('pointermove', hareket);
            window.removeEventListener('pointerup', birak);
            window.removeEventListener('pointercancel', temizle);
            document.removeEventListener('touchmove', kaydirmayiEngelle);
            surukle.current = null;
            setHayalet(null);
            setHedef(null);
        };
        function hareket(e) {
            const s = surukle.current;
            if (!s || e.pointerId !== s.pointerId) return;
            const dx = e.clientX - s.baslangic.x;
            const dy = e.clientY - s.baslangic.y;
            if (!s.aktif) {
                // Dokunmatikte uzun basma dolmadan parmak kaydıysa bu bir kaydırmadır
                if (s.dokunmatik) { if (Math.hypot(dx, dy) > 8) temizle(); return; }
                if (Math.hypot(dx, dy) < 6) return;
                s.aktif = true;
            }
            setHayalet({ parti: s.parti, x: e.clientX, y: e.clientY });
            setHedef(kolonBul(e.clientX, e.clientY));
            // Kenara yaklaşınca kanbanı yatay kaydır (telefonda kolonlar ekran genişliğinde)
            const kap = kapRef.current;
            if (kap) {
                if (e.clientX < 40) kap.scrollLeft -= 14;
                else if (e.clientX > window.innerWidth - 40) kap.scrollLeft += 14;
            }
        }
        function birak(e) {
            const s = surukle.current;
            if (!s) return;
            const { aktif, parti } = s;
            temizle();
            if (!aktif) return; // normal tıklama: kartın tıklama olayı detayı açar
            surukleBitti.current = Date.now();
            const kolon = kolonBul(e.clientX, e.clientY);
            if (!kolon || kolon === parti.durum) return;
            const sonraki = DURUM_SIRALAMA[DURUM_SIRALAMA.indexOf(parti.durum) + 1];
            if (kolon !== sonraki) {
                setUyari(`${parti.partiNo} sırayla ilerler: ${DURUM_LABELS[parti.durum]} → ${DURUM_LABELS[sonraki] || '—'}`);
                return;
            }
            setIlerletParti(parti);
        }
        const baslat = (e, parti) => {
            if (e.button !== undefined && e.button !== 0) return;
            if (surukle.current) temizle();
            const s = { parti, baslangic: { x: e.clientX, y: e.clientY }, aktif: false, pointerId: e.pointerId, dokunmatik: e.pointerType !== 'mouse' };
            surukle.current = s;
            if (s.dokunmatik) {
                s.zamanlayici = setTimeout(() => {
                    if (surukle.current !== s) return;
                    s.aktif = true;
                    navigator.vibrate?.(15);
                    setHayalet({ parti, x: s.baslangic.x, y: s.baslangic.y });
                }, 350);
            }
            window.addEventListener('pointermove', hareket);
            window.addEventListener('pointerup', birak);
            window.addEventListener('pointercancel', temizle);
            document.addEventListener('touchmove', kaydirmayiEngelle, { passive: false });
        };
        isleyici.current = { baslat, temizle };
    }
    const baslat = (e, parti) => { if (adimYapabilirMi(currentUser, parti)) isleyici.current.baslat(e, parti); };
    const kartTikla = (p) => {
        if (Date.now() - surukleBitti.current < 300) return; // sürüklemenin sonundaki tıklamayı yok say
        navigate(`/parti/${p.id}`);
    };

    useEffect(() => () => isleyici.current.temizle(), []);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Atölye Kanban</h1>
                    <span className="text-sm text-muted">Kartı sürükleyerek sonraki aşamaya taşıyın{matchMedia('(pointer: coarse)').matches ? ' (basılı tutun)' : ''}</span>
                </div>
                <span className="text-sm text-muted">{aktifPartiler.filter(p => p.durum !== 'tamamlandi' && p.durum !== 'beklemede').length} aktif iş</span>
            </div>

            {/* Atölye yükü ve darboğaz */}
            {yukler.length > 0 && (
                <div className="card yuk-kart">
                    <div className="card-header">
                        <h3 className="card-title"><Gauge size={18} /> Atölye yükü</h3>
                        {darbogazSayisi > 0
                            ? <span className="yuk-uyari"><AlertTriangle size={14} /> {darbogazSayisi} atölyede darboğaz</span>
                            : <span className="text-xs text-muted">Eldeki iş / günlük kapasite</span>}
                    </div>
                    <div className="yuk-liste">
                        {yukler.map(y => (
                            <button key={y.anahtar} type="button" className={`yuk-oge yuk--${y.durum}`} onClick={() => navigate(`/cari/${y.firmaId}`)}
                                title={`${y.ad} — ${y.parti} parti, ${y.adet.toLocaleString('tr-TR')} adet`}>
                                <div className="yuk-ust">
                                    <strong className="truncate">{y.ad}</strong>
                                    <span className="yuk-asama">{DURUM_LABELS[y.asama]}</span>
                                </div>
                                <div className="yuk-cubuk"><span style={{ width: `${y.gun === null ? 0 : Math.min(100, (y.gun / 10) * 100)}%` }} /></div>
                                <div className="yuk-alt">
                                    <span>{y.adet.toLocaleString('tr-TR')} adet · {y.parti} parti</span>
                                    <strong>{y.gun === null ? yukEtiketi.bilinmiyor : `≈ ${y.gun.toLocaleString('tr-TR')} gün`}</strong>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className={`kanban-container ${hayalet ? 'kanban--surukleniyor' : ''}`} ref={kapRef}>
                {KANBAN_COLUMNS.map(col => {
                    let items = aktifPartiler.filter(p => p.durum === col.key);
                    const totalCount = items.length;
                    const toplamAdet = items.reduce((t, p) => t + (col.key === 'tamamlandi' ? (Number(p.sonCikanAdet) || Number(p.toplamAdet) || 0) : partiKalanAdet(p) || Number(p.toplamAdet) || 0), 0);
                    const darbogaz = yukler.some(y => y.asama === col.key && y.durum === 'darbogaz');
                    if (col.key === 'tamamlandi') {
                        items = items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 15);
                    } else {
                        items = items.sort((a, b) => new Date(asamaBaslangici(a)) - new Date(asamaBaslangici(b)));
                    }
                    const gecerliHedef = hayalet && DURUM_SIRALAMA[DURUM_SIRALAMA.indexOf(hayalet.parti.durum) + 1] === col.key;

                    return (
                        <div key={col.key}
                            className={`kanban-column ${hedef === col.key ? (gecerliHedef ? 'kanban-hedef' : 'kanban-hedef--gecersiz') : ''} ${gecerliHedef ? 'kanban-birakilabilir' : ''}`}
                            data-durum={col.key}>
                            <div className="kanban-column-header">
                                <span>{col.label}</span>
                                {darbogaz && <span className="kanban-darbogaz" title="Bu aşamada darboğaz olan atölye var">Darboğaz</span>}
                                <span className="kanban-column-count" title={`${toplamAdet.toLocaleString('tr-TR')} adet`}>{totalCount}</span>
                            </div>
                            {totalCount > 0 && <div className="kanban-column-adet">{toplamAdet.toLocaleString('tr-TR')} adet</div>}
                            <div className="kanban-column-body">
                                {items.length === 0 ? (
                                    <div className="kanban-empty">Parti yok</div>
                                ) : (
                                    <>
                                        {items.map(p => {
                                            const gun = gunFarki(asamaBaslangici(p));
                                            const gec = GECIKME_GUN[p.durum] && gun > GECIKME_GUN[p.durum];
                                            const firmaId = p[ASAMA_FIRMA[p.durum]] || p.dikimhaneId;
                                            const adim = sonrakiAdim(p);
                                            const ilerletebilir = adim && adimYapabilirMi(currentUser, p);
                                            const adet = p.durum === 'tamamlandi' ? (Number(p.sonCikanAdet) || Number(p.toplamAdet) || 0) : (partiKalanAdet(p) || Number(p.toplamAdet) || 0);
                                            return (
                                                <div
                                                    key={p.id}
                                                    className={`kanban-card ${hayalet?.parti.id === p.id ? 'kanban-card--kaynak' : ''} ${ilerletebilir ? 'kanban-card--tasinabilir' : ''}`}
                                                    onPointerDown={(e) => baslat(e, p)}
                                                    onClick={() => kartTikla(p)}
                                                    onContextMenu={(e) => { if (surukle.current) e.preventDefault(); }}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/parti/${p.id}`); }}
                                                    aria-label={`${p.partiNo} ${p.urunAdi}, ${partiDurumEtiketi(p)}`}
                                                >
                                                    <div className="kanban-kart-ust">
                                                        <span className="kanban-kart-no">{p.partiNo}</span>
                                                        <span className={`kanban-gun ${gec ? 'gec' : ''}`} title="Bu aşamadaki gün">
                                                            {p.durum === 'tamamlandi' ? 'Hazır' : `${gun} gün`}
                                                        </span>
                                                    </div>
                                                    <div className="kanban-card-title">{p.urunAdi}</div>
                                                    <div className="kanban-card-info">{p.urunKodu}{p.kesimDurumu === 'kesildi' && p.durum === 'kesimde' ? ' · Kesildi' : ''}</div>
                                                    {firmaId && (
                                                        <div className="kanban-card-info kanban-card-info--firma">
                                                            <MapPin size={14} /> <span className="truncate">{firmaAdi(firmaId)}</span>
                                                        </div>
                                                    )}
                                                    <div className="kanban-kart-alt">
                                                        <span>{adet.toLocaleString('tr-TR')} adet</span>
                                                        <span className="kanban-kart-araclar">
                                                            <button type="button" className="kanban-ikon" title="QR etiket yazdır" aria-label={`${p.partiNo} QR etiket`}
                                                                onPointerDown={e => e.stopPropagation()}
                                                                onClick={e => { e.stopPropagation(); yazdirPartiEtiketi(p, { firmalar }); }}>
                                                                <QrCode size={15} />
                                                            </button>
                                                            {ilerletebilir && (
                                                                <button type="button" className="kanban-ikon" title={adim.etiket} aria-label={`${p.partiNo}: ${adim.etiket}`}
                                                                    onPointerDown={e => e.stopPropagation()}
                                                                    onClick={e => { e.stopPropagation(); setIlerletParti(p); }}>
                                                                    <ChevronRight size={16} />
                                                                </button>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {col.key === 'tamamlandi' && totalCount > 15 && (
                                            <div className="kanban-more">
                                                Son 15 parti gösteriliyor. Diğerleri <b>Partiler</b> sayfasındadır.
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {hayalet && (
                <div className="kanban-hayalet" style={{ left: hayalet.x, top: hayalet.y }} aria-hidden="true">
                    <strong>{hayalet.parti.partiNo}</strong>
                    <span>{hayalet.parti.urunAdi}</span>
                </div>
            )}
            {uyari && <div className="demo-toast" role="status">{uyari}</div>}
            {ilerletParti && <PartiIlerletModal parti={partiler.find(p => p.id === ilerletParti.id) || ilerletParti} onClose={() => setIlerletParti(null)} />}
        </div>
    );
}
