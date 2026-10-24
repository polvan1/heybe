import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { Plus, Trash2, Search, Scissors, Camera, PackagePlus, Settings2, Loader2, Sparkles, Factory, Layers, Edit2, FileSpreadsheet } from 'lucide-react';
import { excelIndir } from '../utils/excel';
import Notice from '../components/ui/Notice';
import { gorselDataUrl } from '../utils/foto';
import { silmeOnayi } from '../utils/guvenlik';
import { apiIstek } from '../data/api';
import { FIRMA_TIP_LABELS, kumasTutari, kumasCariKapali } from '../data/db';
import { cariYazabilir } from '../data/yetki';
import { PARA_BIRIMLERI, paraSembolu, kurDegeri, useKurlar } from '../data/kur';
import { secilebilirFirmalar, firmaSecenekAdi, firmaAktifMi } from '../utils/firma';

const BIRIMLER = ['kg', 'metre', 'top'];
const tl = (n) => `${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;

// Geldiği firma listesi: aktif kumaş tedarikçileri önce, ardından diğer aktif firmalar
function tedarikciSecenekleri(firmalar, seciliId) {
    return secilebilirFirmalar(firmalar, { seciliId })
        .sort((a, b) => ((b.tip === 'kumasci') - (a.tip === 'kumasci')) || a.ad.localeCompare(b.ad, 'tr'))
        .map(f => ({ value: f.id, label: firmaSecenekAdi(f), sub: FIRMA_TIP_LABELS[f.tip] }));
}

// İrsaliyede okunan firma adını kayıtlı firmalarla eşleştir (önce kumaş tedarikçileri)
function firmaEslestir(firmalar, ad) {
    const aranan = (ad || '').toLocaleLowerCase('tr').trim();
    if (!aranan) return null;
    const ilkKelime = aranan.split(/\s+/)[0];
    const adaylar = secilebilirFirmalar(firmalar)
        .sort((a, b) => (b.tip === 'kumasci') - (a.tip === 'kumasci'));
    return adaylar.find(f => aranan.includes(f.ad.toLocaleLowerCase('tr')))
        || adaylar.find(f => ilkKelime.length >= 3 && f.ad.toLocaleLowerCase('tr').includes(ilkKelime))
        || null;
}

export default function KumasStok() {
    const { kumasStoklar, kumasStokEkle, kumasStokGuncelle, kumasStokSil, kumasTurleri, kumasTuruEkle, kumasTuruSil, firmalar, currentUser } = useApp();
    // Kesimhane yetkilisi yalnızca kendi kesimhanesinin stoğunu görür ve girer (sunucu da bunu zorlar)
    const kesimhaneKullanici = currentUser?.rol === 'kesimhane';
    // Alış fiyatı tedarikçinin carisine borç yazar → yalnızca cari yazabilen kullanıcı girer
    const fiyatGirebilir = cariYazabilir(currentUser);
    const { kurlar } = useKurlar();
    const kesimhaneler = firmalar.filter(f => f.tip === 'kesimhane');
    const kesimhaneSecenekleri = (seciliId) => secilebilirFirmalar(firmalar, { tip: 'kesimhane', seciliId })
        .map(f => ({ value: f.id, label: firmaSecenekAdi(f) }));
    const [kesimhaneFiltre, setKesimhaneFiltre] = useState('all'); // 'all' | firmaId | 'yok'
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [showTurler, setShowTurler] = useState(false);
    const [yeniTur, setYeniTur] = useState('');
    const [yeniTurBirim, setYeniTurBirim] = useState('kg');
    const [okumaBusy, setOkumaBusy] = useState(false);
    const [okuma, setOkuma] = useState(null); // AI sonucu: { firma, irsaliyeNo, satirlar }
    const kameraRef = useRef(null);

    const varsayilanKesimhane = () => kesimhaneKullanici
        ? (currentUser.firmaId || '')
        : (kesimhaneFiltre !== 'all' && kesimhaneFiltre !== 'yok' ? kesimhaneFiltre : '');
    const BOS_FORM = { kumasAdi: '', renk: '', topAdedi: '', miktar: '', birim: 'kg', birimFiyat: '', paraBirimi: 'TRY', kur: '', gelenFirmaId: '', kesimhaneId: '', referansNo: '', notlar: '' };
    const [form, setForm] = useState(BOS_FORM);
    const [duzenlenenId, setDuzenlenenId] = useState(null);
    const duzenlenen = duzenlenenId ? kumasStoklar.find(k => k.id === duzenlenenId) : null;
    const yeniForm = () => ({ ...BOS_FORM, kesimhaneId: varsayilanKesimhane() });
    const kesimhaneAdi = (id) => firmalar.find(f => f.id === id)?.ad || '';

    // Seçili kesimhaneye göre kayıtlar (özet ve liste bunu kullanır)
    const kesimhaneKayitlari = kumasStoklar.filter(k => {
        if (kesimhaneKullanici || kesimhaneFiltre === 'all') return true;
        if (kesimhaneFiltre === 'yok') return !k.kesimhaneId;
        return k.kesimhaneId === kesimhaneFiltre;
    });

    // Kesimhane bazında toplamlar (yönetici görünümü)
    const kesimhaneOzeti = (() => {
        const map = {};
        kumasStoklar.forEach(k => {
            const anahtar = k.kesimhaneId || 'yok';
            if (!map[anahtar]) map[anahtar] = { id: anahtar, ad: k.kesimhaneId ? (kesimhaneAdi(k.kesimhaneId) || k.kesimhaneAdi || 'Kesimhane') : 'Kesimhane belirtilmemiş', kalem: 0, birimler: {} };
            map[anahtar].kalem += 1;
            map[anahtar].birimler[k.birim] = (map[anahtar].birimler[k.birim] || 0) + (parseFloat(k.miktar) || 0);
        });
        // Stoğu olmayan (aktif) kesimhaneler de görünsün
        kesimhaneler.forEach(f => { if (!map[f.id] && firmaAktifMi(f)) map[f.id] = { id: f.id, ad: f.ad, kalem: 0, birimler: {} }; });
        return Object.values(map).sort((a, b) => (a.id === 'yok') - (b.id === 'yok') || a.ad.localeCompare(b.ad, 'tr'));
    })();

    const filtered = kesimhaneKayitlari
        .filter(k => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (k.kumasAdi || '').toLowerCase().includes(q) ||
                   (k.renk || '').toLowerCase().includes(q) ||
                   (k.gelenFirmaAdi || '').toLowerCase().includes(q) ||
                   (k.referansNo || '').toLowerCase().includes(q) ||
                   (k.kesimhaneAdi || kesimhaneAdi(k.kesimhaneId)).toLowerCase().includes(q);
        })
        .sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

    // Tür + renk bazında stok özeti
    const stokOzeti = (() => {
        const map = {};
        kesimhaneKayitlari.forEach(k => {
            const anahtar = `${k.kumasAdi}|${k.renk || '-'}|${k.birim}`;
            if (!map[anahtar]) map[anahtar] = { kumas: k.kumasAdi, renk: k.renk || '—', birim: k.birim, miktar: 0, top: 0 };
            map[anahtar].miktar += parseFloat(k.miktar) || 0;
            map[anahtar].top += parseFloat(k.topAdedi) || 0;
        });
        return Object.values(map).sort((a, b) => b.miktar - a.miktar).slice(0, 8);
    })();

    // ---- YAPAY ZEKÂ İRSALİYE OKUMA ----
    // Native kamera (input capture) kullanılır — getUserMedia gerekmez,
    // izin sorunları yaşanmaz. Fotoğraf sunucuya gider, Claude okur.
    const handleFotoSecildi = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setOkumaBusy(true);
        try {
            const dataUrl = await gorselDataUrl(file, 1600, 0.85);
            const json = await apiIstek('irsaliye_oku=1', { data: dataUrl, kumas_turleri: kumasTurleri.map(t => t.ad) })
                .catch(err => err.veri || { error: 'baglanti', mesaj: err.message });
            if (json.error === 'anahtar_yok') {
                alert(json.mesaj || 'Yapay zekâ okuma için sunucuya bir yapay zekâ anahtarı (ör. ücretsiz GEMINI_API_KEY) eklenmelidir.');
                return;
            }
            if (!json.success || !json.okuma?.satirlar?.length) {
                alert('İrsaliye okunamadı' + (json.mesaj ? `: ${json.mesaj}` : '. Fotoğrafı daha net çekip tekrar deneyin.'));
                return;
            }
            // Firma adını kayıtlı firmalarla eşleştirmeyi dene (önce kumaş tedarikçileri)
            const eslesenFirma = firmaEslestir(firmalar, json.okuma.firma);
            setOkuma({
                kesimhaneId: varsayilanKesimhane(),
                firma: json.okuma.firma || '',
                firmaId: eslesenFirma?.id || '',
                irsaliyeNo: json.okuma.irsaliyeNo || '',
                satirlar: json.okuma.satirlar.map(s => ({
                    kumasTuru: s.kumasTuru || '',
                    renk: s.renk || '',
                    topAdedi: s.topAdedi ?? '',
                    miktar: s.miktar ?? '',
                    birim: BIRIMLER.includes(s.birim) ? s.birim : 'kg',
                    birimFiyat: '',
                    dahil: true,
                })),
            });
        } catch (err) {
            alert('Okuma sırasında hata: ' + err.message);
        } finally {
            setOkumaBusy(false);
        }
    };

    const okumaSatirGuncelle = (i, alan, deger) => {
        setOkuma(o => ({ ...o, satirlar: o.satirlar.map((s, idx) => idx === i ? { ...s, [alan]: deger } : s) }));
    };

    const okumaKaydet = () => {
        const firma = firmalar.find(f => f.id === okuma.firmaId);
        const kesimhaneId = kesimhaneKullanici ? (currentUser.firmaId || '') : (okuma.kesimhaneId || '');
        const kaydedilecek = okuma.satirlar.filter(s => s.dahil && s.kumasTuru.trim() && parseFloat(s.miktar));
        kaydedilecek.forEach(s => {
            kumasStokEkle({
                kumasAdi: s.kumasTuru.trim(),
                renk: (s.renk || '').trim(),
                topAdedi: parseFloat(s.topAdedi) || null,
                miktar: parseFloat(s.miktar),
                birim: s.birim,
                birimFiyat: fiyatGirebilir ? (parseFloat(s.birimFiyat) || null) : undefined,
                gelenFirmaId: okuma.firmaId || null,
                gelenFirmaAdi: firma?.ad || okuma.firma || '',
                referansNo: okuma.irsaliyeNo || '',
                kesimhaneId: kesimhaneId || null,
                kesimhaneAdi: kesimhaneAdi(kesimhaneId),
                notlar: 'Yapay zekâ irsaliye okumasıyla eklendi',
            });
        });
        setOkuma(null);
    };

    const formuAc = (k = null) => {
        setDuzenlenenId(k?.id || null);
        setForm(k ? {
            ...BOS_FORM,
            kumasAdi: k.kumasAdi || '', renk: k.renk || '', topAdedi: k.topAdedi ?? '', miktar: k.miktar ?? '',
            birim: k.birim || 'kg', birimFiyat: k.birimFiyat ?? '', paraBirimi: k.paraBirimi || 'TRY', kur: k.kur ?? '', gelenFirmaId: k.gelenFirmaId || '',
            kesimhaneId: k.kesimhaneId || '', referansNo: k.referansNo || '', notlar: k.notlar || '',
        } : yeniForm());
        setShowForm(true);
    };

    const handleKaydet = async () => {
        if (!form.kumasAdi.trim() || !parseFloat(form.miktar)) return;
        // Fiyat/firma kaldırılırsa bağlı cari borç silinir → silme şifresi gerekir
        const borcSilinecek = fiyatGirebilir && duzenlenen?.cariHareketId && !kumasCariKapali(duzenlenen)
            && (!(kumasTutari(form) > 0) || !form.gelenFirmaId);
        if (borcSilinecek && !(await silmeOnayi(`${duzenlenen.gelenFirmaAdi || 'Tedarikçi'} carisindeki ${tl(duzenlenen.tutar)} kumaş alımı borcu silinecek.`))) return;
        const firma = firmalar.find(f => f.id === form.gelenFirmaId);
        const kesimhaneId = (kesimhaneKullanici ? currentUser.firmaId : form.kesimhaneId) || null;
        const veri = {
            kumasAdi: form.kumasAdi.trim(),
            renk: form.renk.trim(),
            topAdedi: parseFloat(form.topAdedi) || null,
            miktar: parseFloat(form.miktar),
            birim: form.birim,
            gelenFirmaId: form.gelenFirmaId || null,
            gelenFirmaAdi: firma?.ad || (form.gelenFirmaId ? duzenlenen?.gelenFirmaAdi || '' : ''),
            referansNo: form.referansNo.trim(),
            kesimhaneId,
            kesimhaneAdi: kesimhaneAdi(kesimhaneId),
            notlar: form.notlar.trim(),
        };
        if (fiyatGirebilir) {
            veri.birimFiyat = parseFloat(form.birimFiyat) || null;
            veri.paraBirimi = form.paraBirimi || 'TRY';
            veri.kur = veri.paraBirimi === 'TRY' ? null : (parseFloat(form.kur) || kurDegeri(veri.paraBirimi, kurlar) || null);
        }
        if (duzenlenenId) kumasStokGuncelle(duzenlenenId, veri);
        else kumasStokEkle(veri);
        setShowForm(false);
        setDuzenlenenId(null);
    };
    const formTutari = kumasTutari(form);
    const formCariKapali = duzenlenen ? kumasCariKapali(duzenlenen) : false;

    const handleSil = async (k) => {
        if (!(await silmeOnayi(`${k.kumasAdi} — ${k.miktar} ${k.birim} kumaş girişi silinecek.`))) return;
        kumasStokSil(k.id);
    };

    // Görünen kumaş girişleri + tür/renk özeti Excel'e (fiyatlar sadece cari yetkisi olanlara)
    const excelAl = () => {
        const sutunlar = [
            { baslik: 'Tarih', tip: 'tarih' }, { baslik: 'Kumaş' }, { baslik: 'Renk' }, { baslik: 'Top', tip: 'sayi' },
            { baslik: 'Miktar', tip: 'sayi' }, { baslik: 'Birim' }, { baslik: 'Kesimhane' }, { baslik: 'Geldiği Firma' },
            { baslik: 'İrsaliye/Ref.' }, { baslik: 'Parti' }, { baslik: 'Not' },
        ];
        if (fiyatGirebilir) sutunlar.push({ baslik: 'Birim Fiyat', tip: 'sayi' }, { baslik: 'Para / Kur' }, { baslik: 'Tutar (TL)', tip: 'para' });
        const satirlar = filtered.map(k => {
            const r = [k.tarih, k.kumasAdi, k.renk || '', k.topAdedi || null, Number(k.miktar) || 0, k.birim,
                k.kesimhaneAdi || kesimhaneAdi(k.kesimhaneId), k.gelenFirmaAdi || '', k.referansNo || '', k.partiNo || '', k.notlar || ''];
            if (fiyatGirebilir) r.push(k.birimFiyat || null, k.tutar || null);
            if (fiyatGirebilir) r.splice(r.length - 1, 0, k.paraBirimi && k.paraBirimi !== 'TRY' ? `${k.paraBirimi} @ ${k.kur}` : 'TRY');
            return r;
        });
        const ozet = {};
        filtered.forEach(k => {
            const a = `${k.kumasAdi}|${k.renk || ''}|${k.birim}`;
            if (!ozet[a]) ozet[a] = [k.kumasAdi, k.renk || '', 0, 0, k.birim];
            ozet[a][2] += parseFloat(k.topAdedi) || 0;
            ozet[a][3] += parseFloat(k.miktar) || 0;
        });
        excelIndir('Kumas_Stok', [
            { ad: 'Girişler', sutunlar, satirlar },
            { ad: 'Özet', sutunlar: [{ baslik: 'Kumaş' }, { baslik: 'Renk' }, { baslik: 'Top', tip: 'sayi' }, { baslik: 'Miktar', tip: 'sayi' }, { baslik: 'Birim' }],
                satirlar: Object.values(ozet).sort((x, y) => y[3] - x[3]) },
        ]);
    };

    const handleTurEkle = () => {
        if (!yeniTur.trim()) return;
        const sonuc = kumasTuruEkle(yeniTur.trim(), yeniTurBirim);
        if (!sonuc) { alert('Bu kumaş türü zaten tanımlı.'); return; }
        setYeniTur('');
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Scissors size={22} /> Kumaş Stok
                </h1>
                <div className="page-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" onClick={() => setShowTurler(true)}>
                        <Settings2 size={16} /> Türler
                    </button>
                    <button className="btn btn-ghost" onClick={excelAl} disabled={!filtered.length} title="Görünen girişleri Excel'e aktar">
                        <FileSpreadsheet size={16} /> Excel
                    </button>
                    <button className="btn btn-success" onClick={() => kameraRef.current?.click()} disabled={okumaBusy}>
                        {okumaBusy ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
                        {okumaBusy ? ' Okunuyor...' : ' İrsaliye Okut'}
                    </button>
                    <button className="btn btn-primary" onClick={() => formuAc()}>
                        <Plus size={17} /> Kumaş Ekle
                    </button>
                </div>
            </div>
            {/* Native kamera: getUserMedia gerektirmez, iOS'ta doğrudan kamera açılır */}
            <input ref={kameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFotoSecildi} />

            {/* Kesimhane bazında stoklar (kesimhaneler kendi stoklarını girer) */}
            {!kesimhaneKullanici && kesimhaneOzeti.length > 0 && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title"><Factory size={18} /> Kesimhane Stokları</h3>
                        {kesimhaneFiltre !== 'all' && (
                            <button className="btn btn-sm btn-ghost" onClick={() => setKesimhaneFiltre('all')}>Tümünü göster</button>
                        )}
                    </div>
                    <div className="kesimhane-stok-grid">
                        {kesimhaneOzeti.map(o => (
                            <button
                                key={o.id}
                                type="button"
                                className={`kesimhane-stok-kart ${kesimhaneFiltre === o.id ? 'active' : ''}`}
                                onClick={() => setKesimhaneFiltre(kesimhaneFiltre === o.id ? 'all' : o.id)}
                                aria-pressed={kesimhaneFiltre === o.id}
                            >
                                <span className="kesimhane-stok-ad">{o.ad}</span>
                                <span className="kesimhane-stok-miktar">
                                    {Object.keys(o.birimler).length === 0
                                        ? 'Stok yok'
                                        : Object.entries(o.birimler).map(([b, m]) => `${m.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ${b}`).join(' · ')}
                                </span>
                                <span className="kesimhane-stok-kalem">{o.kalem} giriş</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tür + renk bazlı stok özeti */}
            {stokOzeti.length > 0 && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">Stok Özeti</h3>
                        <span className="text-sm text-muted">
                            {kesimhaneKullanici ? kesimhaneAdi(currentUser.firmaId)
                                : kesimhaneFiltre === 'all' ? 'Tüm kesimhaneler'
                                : kesimhaneFiltre === 'yok' ? 'Kesimhane belirtilmemiş' : kesimhaneAdi(kesimhaneFiltre)}
                        </span>
                    </div>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead>
                                <tr><th>Kumaş</th><th>Renk</th><th style={{ textAlign: 'right' }}>Top</th><th style={{ textAlign: 'right' }}>Miktar</th></tr>
                            </thead>
                            <tbody>
                                {stokOzeti.map((s, i) => (
                                    <tr key={i}>
                                        <td className="text-sm font-semibold">{s.kumas}</td>
                                        <td className="text-sm">{s.renk}</td>
                                        <td style={{ textAlign: 'right' }}>{s.top > 0 ? s.top.toLocaleString('tr-TR') : '—'}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                            {s.miktar.toLocaleString('tr-TR')} {s.birim}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="search-bar" style={{ marginBottom: '12px' }}>
                <Search size={18} className="search-icon" />
                <input type="text" placeholder="Kumaş, renk, firma veya irsaliye no ara..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><PackagePlus size={48} /></div>
                    <div className="empty-state-title">Kumaş girişi yok</div>
                    <div className="empty-state-text">İrsaliyenin fotoğrafını çekin — yapay zekâ kumaş türü, renk, top ve kilogramı okuyup stok girişlerini hazırlasın</div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-success" onClick={() => kameraRef.current?.click()}><Camera size={17} /> İrsaliye Okut</button>
                        <button className="btn btn-primary" onClick={() => formuAc()}><Plus size={17} /> Kumaş Ekle</button>
                    </div>
                </div>
            ) : (
                <div className="mobile-list">
                    {filtered.map(k => (
                        <div key={k.id} className="mobile-list-item">
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span className="mobile-list-item-title">{k.kumasAdi}</span>
                                    {k.renk && <span className="badge devam" style={{ fontSize: '0.68rem' }}>{k.renk}</span>}
                                    <span style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>
                                        {Number(k.miktar).toLocaleString('tr-TR')} {k.birim}
                                    </span>
                                    {k.topAdedi ? <span className="text-xs text-muted">({Number(k.topAdedi).toLocaleString('tr-TR')} top)</span> : null}
                                </div>
                                {!kesimhaneKullanici && (
                                    <div className="text-xs" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: k.kesimhaneId ? 'var(--text-secondary)' : 'var(--accent-warning)' }}>
                                        <Factory size={13} /> {k.kesimhaneId ? (k.kesimhaneAdi || kesimhaneAdi(k.kesimhaneId)) : 'Kesimhane belirtilmemiş'}
                                    </div>
                                )}
                                <div className="text-xs text-muted" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                    {k.gelenFirmaAdi && <><Layers size={12} /> {k.gelenFirmaAdi} •</>}
                                    {k.referansNo && <>{k.referansNo} •</>}
                                    <span>{new Date(k.tarih).toLocaleDateString('tr-TR')}</span>
                                    {fiyatGirebilir && k.tutar > 0 && (
                                        <span className="kumas-tutar">• {k.paraBirimi && k.paraBirimi !== 'TRY' ? `${Number(k.birimFiyat).toLocaleString('tr-TR')} ${paraSembolu(k.paraBirimi)}` : tl(k.birimFiyat)}/{k.birim} = <strong>{tl(k.tutar)}</strong></span>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button className="btn-icon" onClick={() => formuAc(k)} title="Düzenle" aria-label="Kumaş girişini düzenle">
                                    <Edit2 size={15} />
                                </button>
                                <button className="btn-icon" onClick={() => handleSil(k)} style={{ color: 'var(--accent-danger)' }} title="Sil (şifreli)" aria-label="Kumaş girişini sil">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* AI OKUMA ÖNİZLEME: satırları düzelt → tek dokunuşla hepsini kaydet */}
            {okuma && (
                <Modal
                    title="İrsaliye Okundu — Kontrol Edin"
                    onClose={() => setOkuma(null)}
                    footer={<>
                        <button className="btn btn-ghost" onClick={() => setOkuma(null)}>İptal</button>
                        <button className="btn btn-primary" onClick={okumaKaydet}
                            disabled={!okuma.satirlar.some(s => s.dahil && s.kumasTuru.trim() && parseFloat(s.miktar))}>
                            <Sparkles size={15} /> Stoklara Kaydet
                        </button>
                    </>}
                >
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Gönderen Firma</label>
                            <SearchableSelect
                                value={okuma.firmaId}
                                onChange={v => setOkuma(o => ({ ...o, firmaId: v }))}
                                options={tedarikciSecenekleri(firmalar, okuma.firmaId)}
                                placeholder={okuma.firma ? `Okunan: ${okuma.firma}` : 'Seçin (isteğe bağlı)'}
                                clearLabel="Seçim yok"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">İrsaliye No</label>
                            <input className="form-input" value={okuma.irsaliyeNo} onChange={e => setOkuma(o => ({ ...o, irsaliyeNo: e.target.value }))} />
                        </div>
                    </div>

                    {!kesimhaneKullanici && (
                        <div className="form-group">
                            <label className="form-label">Bulunduğu Kesimhane</label>
                            <SearchableSelect
                                value={okuma.kesimhaneId}
                                onChange={v => setOkuma(o => ({ ...o, kesimhaneId: v }))}
                                options={kesimhaneSecenekleri(okuma.kesimhaneId)}
                                placeholder="Kumaşın indiği kesimhane"
                                clearLabel="Belirtilmemiş"
                            />
                        </div>
                    )}

                    <label className="form-label">Okunan Satırlar</label>
                    {okuma.satirlar.map((s, i) => (
                        <div key={i} style={{
                            padding: '10px', marginBottom: '8px', borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)', background: s.dahil ? 'var(--bg-card)' : 'var(--color-surface-muted)',
                            opacity: s.dahil ? 1 : 0.55,
                        }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                                <input type="checkbox" checked={s.dahil} onChange={e => okumaSatirGuncelle(i, 'dahil', e.target.checked)} style={{ accentColor: 'var(--color-primary)', flexShrink: 0 }} />
                                <input className="form-input" list="kumas-turleri-listesi" value={s.kumasTuru}
                                    onChange={e => okumaSatirGuncelle(i, 'kumasTuru', e.target.value)}
                                    placeholder="Kumaş türü" style={{ flex: 2, minWidth: 0 }} />
                                <input className="form-input" value={s.renk} onChange={e => okumaSatirGuncelle(i, 'renk', e.target.value)}
                                    placeholder="Renk" style={{ flex: 1, minWidth: 0 }} />
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input className="form-input" type="number" inputMode="numeric" value={s.topAdedi}
                                    onChange={e => okumaSatirGuncelle(i, 'topAdedi', e.target.value)} placeholder="Top" style={{ flex: 1 }} title="Top adedi" />
                                <input className="form-input" type="number" inputMode="decimal" step="0.01" value={s.miktar}
                                    onChange={e => okumaSatirGuncelle(i, 'miktar', e.target.value)} placeholder="Miktar *" style={{ flex: 1.4 }} />
                                <select className="form-input" value={s.birim} onChange={e => okumaSatirGuncelle(i, 'birim', e.target.value)} style={{ flex: 1 }}>
                                    {BIRIMLER.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                                {fiyatGirebilir && (
                                    <input className="form-input" type="number" inputMode="decimal" step="0.01" value={s.birimFiyat}
                                        onChange={e => okumaSatirGuncelle(i, 'birimFiyat', e.target.value)} placeholder="₺/birim" style={{ flex: 1.2 }} title="Birim alış fiyatı (isteğe bağlı)" />
                                )}
                            </div>
                        </div>
                    ))}
                    <div className="text-xs text-muted">
                        Satırları düzeltebilir, istemediklerinizin işaretini kaldırabilirsiniz. Kaydet dediğinizde her satır ayrı stok girişi olur.
                        {fiyatGirebilir && ' Birim fiyat girilen satırlar gönderen firmanın carisine borç olarak yazılır.'}
                    </div>
                </Modal>
            )}

            {/* Elle Kumaş Giriş Formu */}
            {showForm && (
                <Modal
                    title={duzenlenenId ? 'Kumaş Girişini Düzenle' : 'Kumaş Girişi'}
                    onClose={() => { setShowForm(false); setDuzenlenenId(null); }}
                    footer={<>
                        <button className="btn btn-ghost" onClick={() => { setShowForm(false); setDuzenlenenId(null); }}>İptal</button>
                        <button className="btn btn-primary" onClick={handleKaydet} disabled={!form.kumasAdi.trim() || !parseFloat(form.miktar)}>
                            Kaydet
                        </button>
                    </>}
                >
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Kumaş Türü *</label>
                            <input className="form-input" list="kumas-turleri-listesi" value={form.kumasAdi}
                                onChange={e => setForm({ ...form, kumasAdi: e.target.value })}
                                placeholder="Tanımlı türden seçin veya yazın" autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Renk</label>
                            <input className="form-input" value={form.renk} onChange={e => setForm({ ...form, renk: e.target.value })} placeholder="Örn: Siyah" />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Top Adedi</label>
                            <input className="form-input" type="number" inputMode="numeric" value={form.topAdedi} onChange={e => setForm({ ...form, topAdedi: e.target.value })} placeholder="0" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Miktar *</label>
                            <input className="form-input" type="number" inputMode="decimal" step="0.01" value={form.miktar} onChange={e => setForm({ ...form, miktar: e.target.value })} placeholder="0" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Birim</label>
                            <select className="form-input" value={form.birim} onChange={e => setForm({ ...form, birim: e.target.value })}>
                                {BIRIMLER.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </div>
                    {!kesimhaneKullanici && (
                        <div className="form-group">
                            <label className="form-label">Bulunduğu Kesimhane</label>
                            <SearchableSelect
                                value={form.kesimhaneId}
                                onChange={v => setForm({ ...form, kesimhaneId: v })}
                                options={kesimhaneSecenekleri(form.kesimhaneId)}
                                placeholder="Kumaşın indiği kesimhane"
                                clearLabel="Belirtilmemiş"
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Geldiği Firma (Kumaş Tedarikçisi)</label>
                        <SearchableSelect
                            value={form.gelenFirmaId}
                            onChange={v => setForm({ ...form, gelenFirmaId: v })}
                            options={tedarikciSecenekleri(firmalar, form.gelenFirmaId)}
                            placeholder="Seçin (isteğe bağlı)"
                            clearLabel="Seçim yok"
                        />
                        {!firmalar.some(f => f.tip === 'kumasci') && (
                            <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                                İpucu: Firmalar sayfasından "Kumaş Tedarikçisi" türünde firma ekleyin; burada en üstte listelenir.
                            </div>
                        )}
                    </div>
                    {fiyatGirebilir && (
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label" htmlFor="kumas-fiyat">Birim Alış Fiyatı ({paraSembolu(form.paraBirimi)}/{form.birim})</label>
                                <div className="fiyat-para">
                                    <input id="kumas-fiyat" className="form-input" type="number" inputMode="decimal" step="0.01" min="0" value={form.birimFiyat}
                                        onChange={e => setForm({ ...form, birimFiyat: e.target.value })} placeholder="İsteğe bağlı" disabled={formCariKapali} />
                                    <select className="form-input" value={form.paraBirimi} disabled={formCariKapali} aria-label="Para birimi"
                                        onChange={e => setForm({ ...form, paraBirimi: e.target.value, kur: e.target.value === 'TRY' ? '' : String(kurDegeri(e.target.value, kurlar) || '') })}>
                                        {PARA_BIRIMLERI.map(p => <option key={p.kod} value={p.kod}>{p.kod}</option>)}
                                    </select>
                                </div>
                                {form.paraBirimi !== 'TRY' && (
                                    <div className="kur-satiri">
                                        <label htmlFor="kumas-kur">Kur (1 {form.paraBirimi} =)</label>
                                        <input id="kumas-kur" className="form-input" type="number" inputMode="decimal" step="0.0001" value={form.kur} disabled={formCariKapali}
                                            onChange={e => setForm({ ...form, kur: e.target.value })} placeholder={kurDegeri(form.paraBirimi, kurlar) ? String(kurDegeri(form.paraBirimi, kurlar)) : 'Kur girin'} />
                                        <span>₺</span>
                                    </div>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tutar (TL)</label>
                                <div className="form-input kumas-tutar-kutu" aria-live="polite">{formTutari > 0 ? tl(formTutari) : '—'}</div>
                            </div>
                        </div>
                    )}
                    {fiyatGirebilir && formCariKapali && (
                        <Notice tone="neutral">Bu alımın cari borcu "Hesabı Kapat" ile kapatıldığı için fiyat ve tutar artık değiştirilemez; stok bilgilerini düzenleyebilirsiniz.</Notice>
                    )}
                    {fiyatGirebilir && !formCariKapali && formTutari > 0 && form.gelenFirmaId && (
                        <Notice tone="info">{tl(formTutari)} tutarında borç, {firmalar.find(f => f.id === form.gelenFirmaId)?.ad || 'seçili firma'} carisine "Kumaş alımı" olarak yazılır.</Notice>
                    )}
                    {fiyatGirebilir && formTutari > 0 && !form.gelenFirmaId && (
                        <Notice tone="warning">Cariye borç yazılması için geldiği firmayı seçin.</Notice>
                    )}
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">İrsaliye / Referans No</label>
                            <input className="form-input" value={form.referansNo} onChange={e => setForm({ ...form, referansNo: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Not</label>
                            <input className="form-input" value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} />
                        </div>
                    </div>
                </Modal>
            )}

            {/* Kumaş Türleri Yönetimi */}
            {showTurler && (
                <Modal
                    title="Kumaş Türleri"
                    onClose={() => setShowTurler(false)}
                    footer={<button className="btn btn-primary" onClick={() => setShowTurler(false)}>Tamam</button>}
                >
                    <div className="text-xs text-muted" style={{ marginBottom: '12px' }}>
                        Buraya eklediğiniz türler, yapay zekâ irsaliye okurken eşleştirme için kullanılır
                        ve kumaş girişi formlarında öneri olarak çıkar.
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                        <input className="form-input" value={yeniTur} onChange={e => setYeniTur(e.target.value)}
                            placeholder="Örn: Süprem 30/1" style={{ flex: 2 }}
                            onKeyDown={e => { if (e.key === 'Enter') handleTurEkle(); }} />
                        <select className="form-input" value={yeniTurBirim} onChange={e => setYeniTurBirim(e.target.value)} style={{ flex: 1 }}>
                            {BIRIMLER.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <button className="btn btn-primary" onClick={handleTurEkle} disabled={!yeniTur.trim()}><Plus size={16} /></button>
                    </div>
                    {kumasTurleri.length === 0 ? (
                        <div className="text-center text-muted text-sm" style={{ padding: '16px' }}>Henüz tür tanımlanmadı.</div>
                    ) : (
                        kumasTurleri.map(t => (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid var(--border-color)' }}>
                                <div>
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.ad}</span>
                                    <span className="text-xs text-muted" style={{ marginLeft: '8px' }}>{t.birim}</span>
                                </div>
                                {!kesimhaneKullanici && (
                                    <button className="btn-icon" onClick={async () => { if (await silmeOnayi(`"${t.ad}" kumaş türü silinecek.`)) kumasTuruSil(t.id); }} style={{ color: 'var(--accent-danger)' }}>
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </Modal>
            )}

            {/* Tanımlı türler: form alanlarında öneri listesi */}
            <datalist id="kumas-turleri-listesi">
                {kumasTurleri.map(t => <option key={t.id} value={t.ad} />)}
            </datalist>
        </div>
    );
}
