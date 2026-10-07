import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MapPinned, Route as RouteIcon, Search, Crosshair, X, Home, AlertTriangle, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { hasYetki } from '../data/yetki';
import { FIRMA_TIP_LABELS } from '../data/db';
import HaritaGorunum from '../components/HaritaGorunum';
import { adresAra } from '../utils/adresAra';
import { konumVarMi } from '../utils/rota';
import SevkPlani from '../components/SevkPlani';

const DEMO = import.meta.env.VITE_DEMO === '1';
const TIP_FILTRELER = [
    { value: 'hepsi', label: 'Tümü' },
    { value: 'kesimhane', label: 'Kesimhane' },
    { value: 'atolye', label: 'Atölye' },
    { value: 'utupaketci', label: 'Ütü/Paket' },
    { value: 'baskici', label: 'Baskıcı' },
];

// Firmanın şu an üzerindeki aktif partiler (aşamasına göre)
function aktifPartiler(firma, partiler) {
    return partiler.filter(p => !p.arsivde && (
        (p.durum === 'kesimde' && p.kesimhaneId === firma.id) ||
        (p.durum === 'dikimde' && p.dikimhaneId === firma.id) ||
        (p.durum === 'utupakette' && p.utupaketciId === firma.id)
    ));
}

export default function Harita() {
    const { firmalar, partiler, currentUser, firmaGuncelle, merkez, merkezKaydet } = useApp();
    const [sekme, setSekme] = useState('yerler');
    const [mod, setMod] = useState(DEMO ? 'sade' : 'sokak');
    const [filtre, setFiltre] = useState('hepsi');
    const [seciliId, setSeciliId] = useState(null);
    const [hedef, setHedef] = useState(null);          // konumu girilen: firma id ya da 'merkez'
    const [arama, setArama] = useState('');
    const [sonuclar, setSonuclar] = useState(null);
    const [aramaUyari, setAramaUyari] = useState('');
    const [araniyor, setAraniyor] = useState(false);
    const [odak, setOdak] = useState(0);
    const [sevkHaritasi, setSevkHaritasi] = useState(null); // rota sekmesinin çizdiği rotalar ve araçlar

    const firmaDuzenleyebilir = hasYetki(currentUser, 'firmalar');
    const merkezDuzenleyebilir = hasYetki(currentUser, 'harita') || hasYetki(currentUser, 'ayarlar');
    const aktifFirmalar = useMemo(() => firmalar.filter(f => f.aktif !== false), [firmalar]);
    const firmaById = useMemo(() => Object.fromEntries(firmalar.map(f => [f.id, f])), [firmalar]);

    // ---------- Üretim yerleri ----------
    const listelenen = aktifFirmalar.filter(f => filtre === 'hepsi' || f.tip === filtre);
    const konumsuzSayisi = aktifFirmalar.filter(f => !konumVarMi(f)).length;
    const haritaNoktalari = useMemo(() => aktifFirmalar
        .filter(f => konumVarMi(f) && (filtre === 'hepsi' || f.tip === filtre))
        .map(f => ({ id: f.id, lat: +f.lat, lng: +f.lng, tip: f.tip, etiket: f.ad })), [aktifFirmalar, filtre]);

    const konumuKaydet = (konum, adres) => {
        if (hedef === 'merkez') {
            merkezKaydet({ ad: merkez?.ad || 'Merkez', lat: konum.lat, lng: konum.lng });
        } else if (hedef) {
            firmaGuncelle(hedef, { lat: +konum.lat.toFixed(6), lng: +konum.lng.toFixed(6), ...(adres ? { konumAdres: adres } : {}) });
            setSeciliId(hedef);
        }
        setHedef(null); setSonuclar(null); setArama(''); setAramaUyari('');
        setOdak(o => o + 1);
    };

    const konumSec = (id) => {
        setHedef(id); setSonuclar(null); setAramaUyari('');
        const f = id === 'merkez' ? null : firmaById[id];
        setArama(f?.adres || '');
    };

    const araYap = async (e) => {
        e.preventDefault();
        if (!arama.trim()) return;
        setAraniyor(true);
        const r = await adresAra(arama.trim());
        setSonuclar(r.sonuclar); setAramaUyari(r.uyari || (r.sonuclar.length ? '' : 'Sonuç bulunamadı. Haritaya dokunarak da konum seçebilirsiniz.'));
        setAraniyor(false);
    };

    // ---------- Rota planı ----------
    const baslangicSecenekleri = [
        ...(konumVarMi(merkez) ? [{ id: 'merkez', ad: merkez.ad || 'Merkez', konum: merkez }] : []),
        ...aktifFirmalar.filter(konumVarMi).map(f => ({ id: f.id, ad: f.ad, konum: { lat: +f.lat, lng: +f.lng, ad: f.ad } })),
    ];
    const hedefAdi = hedef === 'merkez' ? 'Araç çıkış noktası' : firmaById[hedef]?.ad;

    return (
        <div className="harita-sayfa">
            <div className="harita-sekmeler" role="tablist">
                <button role="tab" aria-selected={sekme === 'yerler'} className={`filter-btn ${sekme === 'yerler' ? 'active' : ''}`}
                    onClick={() => { setSekme('yerler'); setOdak(o => o + 1); }}>
                    <MapPinned size={15} /> Üretim Yerleri
                </button>
                <button role="tab" aria-selected={sekme === 'rota'} className={`filter-btn ${sekme === 'rota' ? 'active' : ''}`}
                    onClick={() => { setSekme('rota'); setHedef(null); setOdak(o => o + 1); }}>
                    <RouteIcon size={15} /> Rota Planı
                </button>
                {!DEMO && (
                    <button className="filter-btn harita-mod-btn" onClick={() => setMod(m => (m === 'sokak' ? 'sade' : 'sokak'))}>
                        {mod === 'sokak' ? 'Sade harita' : 'Sokak haritası'}
                    </button>
                )}
            </div>

            {hedef && (
                <div className="harita-secim-bandi">
                    <Crosshair size={16} />
                    <span><strong>{hedefAdi}</strong> için haritada noktaya dokunun ya da adres arayın.</span>
                    <button className="btn-icon" aria-label="Vazgeç" onClick={() => setHedef(null)}><X size={16} /></button>
                </div>
            )}

            <HaritaGorunum
                mod={mod}
                noktalar={haritaNoktalari}
                merkez={konumVarMi(merkez) ? merkez : null}
                rotalar={sekme === 'rota' ? sevkHaritasi?.rotalar : null}
                araclar={sekme === 'rota' ? sevkHaritasi?.araclar || [] : []}
                seciliId={seciliId}
                secimModu={!!hedef}
                onHaritaTikla={(konum) => { if (hedef) konumuKaydet(konum); }}
                onNoktaTikla={(id) => { setSeciliId(id); setSekme('yerler'); document.getElementById('firma-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }}
                odakAnahtari={`${sekme}-${odak}-${filtre}-${sevkHaritasi?.rotalar?.length || 0}`}
            />
            <div className="harita-lejant" aria-label="Renk açıklaması">
                <span><i className="harita-lejant-nokta harita-nokta--kesim" /> Kesimhane</span>
                <span><i className="harita-lejant-nokta harita-nokta--atolye" /> Atölye</span>
                <span><i className="harita-lejant-nokta harita-nokta--utu" /> Ütü/Paket</span>
                <span><i className="harita-lejant-nokta harita-nokta--baski" /> Baskıcı</span>
                <span><i className="harita-lejant-merkez">M</i> Merkez</span>
            </div>

            {hedef && (
                <form className="card harita-adres" onSubmit={araYap}>
                    <label className="form-label" htmlFor="adres-arama">Adres ya da ilçe ara</label>
                    <div className="harita-adres-satir">
                        <input id="adres-arama" className="form-input" value={arama} onChange={e => setArama(e.target.value)}
                            placeholder="Örn: Bağcılar, Mahmutbey Mah. 2621. Sk." autoFocus />
                        <button className="btn btn-primary" type="submit" disabled={araniyor}><Search size={16} /> {araniyor ? 'Aranıyor' : 'Ara'}</button>
                    </div>
                    {aramaUyari && <p className="harita-not">{aramaUyari}</p>}
                    {sonuclar?.length > 0 && (
                        <ul className="harita-sonuclar">
                            {sonuclar.map((s, i) => (
                                <li key={i}>
                                    <button type="button" onClick={() => konumuKaydet(s, s.kaynak === 'osm' ? s.ad : undefined)}>
                                        <MapPin size={14} /> <span>{s.ad}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </form>
            )}

            {sekme === 'yerler' ? (
                <section className="harita-panel">
                    <div className="card harita-merkez-kart">
                        <Home size={18} />
                        <div className="harita-merkez-bilgi">
                            <strong>Araç çıkış noktası</strong>
                            <span>{konumVarMi(merkez) ? (merkez.ad || 'Merkez') : 'Henüz seçilmedi'}</span>
                        </div>
                        {merkezDuzenleyebilir && (
                            <button className="btn btn-ghost" onClick={() => konumSec('merkez')}>
                                <Crosshair size={15} /> {konumVarMi(merkez) ? 'Değiştir' : 'Konum seç'}
                            </button>
                        )}
                    </div>

                    <div className="harita-filtreler">
                        {TIP_FILTRELER.map(t => (
                            <button key={t.value} className={`filter-btn ${filtre === t.value ? 'active' : ''}`} onClick={() => setFiltre(t.value)}>{t.label}</button>
                        ))}
                    </div>
                    {konumsuzSayisi > 0 && (
                        <p className="harita-not"><AlertTriangle size={14} /> {konumsuzSayisi} firmanın konumu girilmemiş; rota planında kullanılamaz.</p>
                    )}

                    <ul className="harita-firma-listesi">
                        {listelenen.map(f => {
                            const aktif = aktifPartiler(f, partiler);
                            const var_ = konumVarMi(f);
                            return (
                                <li key={f.id} id={'firma-' + f.id} className={`card harita-firma ${seciliId === f.id ? 'harita-firma--secili' : ''}`}>
                                    <button className="harita-firma-ust" onClick={() => { if (var_) { setSeciliId(f.id); } }}>
                                        <i className={`harita-lejant-nokta ${'harita-nokta--' + ({ kesimhane: 'kesim', atolye: 'atolye', utupaketci: 'utu', baskici: 'baski' }[f.tip] || 'atolye')}`} />
                                        <span className="harita-firma-ad">{f.ad}</span>
                                        <span className="harita-firma-tip">{FIRMA_TIP_LABELS[f.tip] || f.tip}</span>
                                    </button>
                                    <div className="harita-firma-alt">
                                        <span className={var_ ? 'harita-konum-var' : 'harita-konum-yok'}>
                                            {var_ ? <><Check size={13} /> {f.konumAdres || f.adres || 'Konum girildi'}</> : <><AlertTriangle size={13} /> Konum yok</>}
                                        </span>
                                        <span className="harita-firma-is">
                                            {aktif.length ? `${aktif.length} aktif parti` : 'Boşta'}
                                            {f.gunlukKapasite ? ` · ${Number(f.gunlukKapasite).toLocaleString('tr-TR')} ad/gün` : ''}
                                        </span>
                                    </div>
                                    {(aktif.length > 0 || firmaDuzenleyebilir) && (
                                        <div className="harita-firma-aksiyon">
                                            {aktif.slice(0, 3).map(p => (
                                                <Link key={p.id} to={`/parti/${p.id}`} className="harita-parti-link">{p.partiNo}</Link>
                                            ))}
                                            {firmaDuzenleyebilir && (
                                                <button className="btn btn-ghost" onClick={() => konumSec(f.id)}>
                                                    <Crosshair size={15} /> {var_ ? 'Konumu değiştir' : 'Konum seç'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ) : (
                <section className="harita-panel">
                    <SevkPlani baslangicSecenekleri={baslangicSecenekleri} firmaById={firmaById} onHaritaVerisi={setSevkHaritasi} />
                </section>
            )}
        </div>
    );
}
