import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MapPinned, Route as RouteIcon, Search, Crosshair, X, Navigation, Share2, Home, AlertTriangle, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { hasYetki } from '../data/yetki';
import { FIRMA_TIP_LABELS, IRSALIYE_DURUM_LABELS } from '../data/db';
import HaritaGorunum from '../components/HaritaGorunum';
import { adresAra } from '../utils/adresAra';
import { rotaPlanla, siraliRotaKm, googleHaritaLinki, konumVarMi } from '../utils/rota';

const DEMO = import.meta.env.VITE_DEMO === '1';
const TIP_FILTRELER = [
    { value: 'hepsi', label: 'Tümü' },
    { value: 'kesimhane', label: 'Kesimhane' },
    { value: 'atolye', label: 'Atölye' },
    { value: 'utupaketci', label: 'Ütü/Paket' },
    { value: 'baskici', label: 'Baskıcı' },
];
const BEKLEYEN_IRSALIYE = ['taslak', 'onaylandi'];
const km = (x) => x.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' km';
const sure = (dk) => (dk >= 60 ? `${Math.floor(dk / 60)} sa ${dk % 60} dk` : `${dk} dk`);

// Firmanın şu an üzerindeki aktif partiler (aşamasına göre)
function aktifPartiler(firma, partiler) {
    return partiler.filter(p => !p.arsivde && (
        (p.durum === 'kesimde' && p.kesimhaneId === firma.id) ||
        (p.durum === 'dikimde' && p.dikimhaneId === firma.id) ||
        (p.durum === 'utupakette' && p.utupaketciId === firma.id)
    ));
}

export default function Harita() {
    const { firmalar, partiler, irsaliyeler, currentUser, firmaGuncelle, merkez, merkezKaydet } = useApp();
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
    const [baslangicId, setBaslangicId] = useState('merkez');
    const [donus, setDonus] = useState(true);
    const [haricTutulan, setHaricTutulan] = useState(() => new Set());

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
    const baslangic = baslangicSecenekleri.find(b => b.id === baslangicId) || baslangicSecenekleri[0];

    const bekleyenler = useMemo(() => irsaliyeler
        .filter(i => BEKLEYEN_IRSALIYE.includes(i.durum))
        .map(i => {
            const g = firmaById[i.gonderenFirmaId], a = firmaById[i.alanFirmaId];
            const eksik = [g, a].filter(f => !f || !konumVarMi(f)).map(f => f?.ad || 'Bilinmeyen firma');
            return {
                irsaliye: i, eksik,
                gorev: eksik.length ? null : {
                    id: i.id, etiket: `${i.irsaliyeNo || ''} · ${i.partiNo || ''}`.trim(),
                    adet: +i.toplamAdet || 0,
                    alim: { ad: g.ad, lat: +g.lat, lng: +g.lng, firmaId: g.id },
                    teslim: { ad: a.ad, lat: +a.lat, lng: +a.lng, firmaId: a.id },
                },
            };
        })
        .sort((x, y) => String(x.irsaliye.tarih || '').localeCompare(String(y.irsaliye.tarih || ''))), [irsaliyeler, firmaById]);

    const seciliGorevler = bekleyenler.filter(b => b.gorev && !haricTutulan.has(b.irsaliye.id)).map(b => b.gorev);
    // Girdi (başlangıç, görevler ve konumları, dönüş) değişmedikçe yeniden hesaplanmaz
    const planAnahtari = JSON.stringify([baslangic?.konum, seciliGorevler, donus]);
    const plan = useMemo(() => (baslangic && seciliGorevler.length
        ? rotaPlanla({ baslangic: baslangic.konum, gorevler: seciliGorevler, donus })
        : null
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [planAnahtari]);
    const siraliKm = plan ? siraliRotaKm({ baslangic: baslangic.konum, gorevler: seciliGorevler, donus }) : 0;
    const kazanc = plan && siraliKm > 0 ? Math.round((1 - plan.toplamKm / siraliKm) * 100) : 0;
    const gLink = plan ? googleHaritaLinki(plan.duraklar) : null;

    const rotaMetni = () => {
        if (!plan) return '';
        const satirlar = [`Sevkiyat rotası — ${new Date().toLocaleDateString('tr-TR')}`, `Toplam ~${km(plan.toplamKm)}, ~${sure(plan.sureDk)}`, ''];
        plan.duraklar.forEach((d, i) => {
            if (d.tip === 'baslangic') satirlar.push(`Çıkış: ${baslangic.ad}`);
            else if (d.tip === 'donus') satirlar.push(`Dönüş: ${baslangic.ad}`);
            else {
                satirlar.push(`${i}. ${d.konum.ad}`);
                d.teslimler.forEach(g => satirlar.push(`   ↓ Bırak: ${g.etiket} (${g.adet} ad)`));
                d.alimlar.forEach(g => satirlar.push(`   ↑ Al: ${g.etiket} (${g.adet} ad)`));
            }
        });
        if (gLink) satirlar.push('', gLink.url);
        return satirlar.join('\n');
    };

    const gorevDegistir = (id) => setHaricTutulan(s => {
        const y = new Set(s);
        if (y.has(id)) y.delete(id); else y.add(id);
        return y;
    });

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
                rota={sekme === 'rota' ? plan?.duraklar : null}
                seciliId={seciliId}
                secimModu={!!hedef}
                onHaritaTikla={(konum) => { if (hedef) konumuKaydet(konum); }}
                onNoktaTikla={(id) => { setSeciliId(id); setSekme('yerler'); document.getElementById('firma-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }}
                odakAnahtari={`${sekme}-${odak}-${filtre}`}
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
                    {!baslangicSecenekleri.length ? (
                        <div className="card harita-bos">
                            <p>Rota planlamak için önce <strong>Üretim Yerleri</strong> sekmesinden araç çıkış noktasını ve firma konumlarını girin.</p>
                        </div>
                    ) : (
                        <>
                            <div className="card harita-rota-ayar">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="rota-baslangic">Araç nereden çıkıyor?</label>
                                    <select id="rota-baslangic" className="form-input" value={baslangic?.id} onChange={e => setBaslangicId(e.target.value)}>
                                        {baslangicSecenekleri.map(b => <option key={b.id} value={b.id}>{b.ad}</option>)}
                                    </select>
                                </div>
                                <label className="harita-onay">
                                    <input type="checkbox" checked={donus} onChange={e => setDonus(e.target.checked)} />
                                    İş bitince çıkış noktasına dön
                                </label>
                            </div>

                            <h3 className="harita-baslik">Bekleyen sevkiyatlar ({bekleyenler.length})</h3>
                            {bekleyenler.length === 0 ? (
                                <p className="harita-not">Teslim edilmemiş irsaliye yok. Taslak ya da onaylanmış irsaliyeler burada listelenir.</p>
                            ) : (
                                <ul className="harita-gorevler">
                                    {bekleyenler.map(({ irsaliye: i, gorev, eksik }) => (
                                        <li key={i.id} className={`card harita-gorev ${!gorev ? 'harita-gorev--pasif' : ''}`}>
                                            <label>
                                                <input type="checkbox" disabled={!gorev}
                                                    checked={!!gorev && !haricTutulan.has(i.id)} onChange={() => gorevDegistir(i.id)} />
                                                <span className="harita-gorev-icerik">
                                                    <span className="harita-gorev-ust">
                                                        <strong>{i.irsaliyeNo}</strong> · {i.partiNo}
                                                        <span className="harita-gorev-durum">{IRSALIYE_DURUM_LABELS[i.durum]}</span>
                                                    </span>
                                                    <span className="harita-gorev-yol">{i.gonderenFirmaAdi} → {i.alanFirmaAdi}</span>
                                                    <span className="harita-gorev-adet">{Number(i.toplamAdet || 0).toLocaleString('tr-TR')} adet · {i.urunAdi}</span>
                                                    {!gorev && <span className="harita-konum-yok"><AlertTriangle size={13} /> Konum eksik: {eksik.join(', ')}</span>}
                                                </span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {plan && (
                                <div className="card harita-sonuc">
                                    <div className="harita-ozet">
                                        <div><span>Toplam yol</span><strong>~{km(plan.toplamKm)}</strong></div>
                                        <div><span>Tahmini süre</span><strong>~{sure(plan.sureDk)}</strong></div>
                                        <div><span>Durak</span><strong>{plan.duraklar.filter(d => d.tip === 'durak').length}</strong></div>
                                    </div>
                                    {kazanc > 0 && (
                                        <p className="harita-kazanc">İrsaliyeleri tarih sırasıyla tek tek taşımaya göre <strong>%{kazanc} daha kısa</strong> ({km(siraliKm)} yerine).</p>
                                    )}
                                    <ol className="harita-duraklar">
                                        {plan.duraklar.map((d, i) => (
                                            <li key={i} className={`harita-durak-satir harita-durak-satir--${d.tip}`}>
                                                <span className="harita-durak-no">{d.tip === 'durak' ? i : d.tip === 'baslangic' ? 'Ç' : 'D'}</span>
                                                <div>
                                                    <strong>{d.tip === 'baslangic' ? `Çıkış: ${baslangic.ad}` : d.tip === 'donus' ? `Dönüş: ${baslangic.ad}` : d.konum.ad}</strong>
                                                    {d.km > 0 && <span className="harita-durak-km">+{km(d.km)}</span>}
                                                    {d.teslimler.map(g => <span key={'t' + g.id} className="harita-is harita-is--birak">Bırak: {g.etiket} ({g.adet.toLocaleString('tr-TR')} ad)</span>)}
                                                    {d.alimlar.map(g => <span key={'a' + g.id} className="harita-is harita-is--al">Al: {g.etiket} ({g.adet.toLocaleString('tr-TR')} ad)</span>)}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                    <div className="harita-rota-aksiyon">
                                        {gLink && (
                                            <a className="btn btn-primary" href={gLink.url} target="_blank" rel="noopener noreferrer">
                                                <Navigation size={16} /> Google Haritalar'da aç
                                            </a>
                                        )}
                                        <a className="btn btn-ghost" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(rotaMetni())}`} target="_blank" rel="noopener noreferrer">
                                            <Share2 size={16} /> WhatsApp ile gönder
                                        </a>
                                    </div>
                                    {gLink?.eksikDurak > 0 && (
                                        <p className="harita-not">Google Haritalar en fazla 9 ara durak kabul eder; son {gLink.eksikDurak} durak bağlantıya eklenmedi.</p>
                                    )}
                                    <p className="harita-not">
                                        Mesafeler kuş uçuşu × 1,3 yol katsayısıyla tahmini hesaplanır; süreye durak başı 10 dk yükleme eklenir.
                                        {plan.yontem === 'kesin' ? ' Bu sıra seçilen sevkiyatlar için en kısa sıradır.' : ' Çok sayıda sevkiyat olduğu için hızlı yaklaşık çözüm kullanıldı.'}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </section>
            )}
        </div>
    );
}
