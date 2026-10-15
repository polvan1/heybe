import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { Plus, Trash2, Search, Scissors, Camera, PackagePlus, Settings2, Loader2, Sparkles, Factory } from 'lucide-react';
import { gorselDataUrl } from '../utils/foto';
import { silmeOnayi } from '../utils/guvenlik';
import { apiIstek } from '../data/api';

const BIRIMLER = ['kg', 'metre', 'top'];

export default function KumasStok() {
    const { kumasStoklar, kumasStokEkle, kumasStokSil, kumasTurleri, kumasTuruEkle, kumasTuruSil, firmalar, currentUser } = useApp();
    // Kesimhane yetkilisi yalnızca kendi kesimhanesinin stoğunu görür ve girer (sunucu da bunu zorlar)
    const kesimhaneKullanici = currentUser?.rol === 'kesimhane';
    const kesimhaneler = firmalar.filter(f => f.tip === 'kesimhane');
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
    const BOS_FORM = { kumasAdi: '', renk: '', topAdedi: '', miktar: '', birim: 'kg', gelenFirmaId: '', kesimhaneId: '', referansNo: '', notlar: '' };
    const [form, setForm] = useState(BOS_FORM);
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
        // Stoğu olmayan kesimhaneler de görünsün
        kesimhaneler.forEach(f => { if (!map[f.id]) map[f.id] = { id: f.id, ad: f.ad, kalem: 0, birimler: {} }; });
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
            // Firma adını kayıtlı firmalarla eşleştirmeyi dene
            const aiFirma = (json.okuma.firma || '').toLowerCase();
            const eslesenFirma = aiFirma
                ? firmalar.find(f => aiFirma.includes(f.ad.toLowerCase()) || f.ad.toLowerCase().includes(aiFirma.split(' ')[0]))
                : null;
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

    const handleKaydet = () => {
        if (!form.kumasAdi.trim() || !parseFloat(form.miktar)) return;
        const firma = firmalar.find(f => f.id === form.gelenFirmaId);
        kumasStokEkle({
            kumasAdi: form.kumasAdi.trim(),
            renk: form.renk.trim(),
            topAdedi: parseFloat(form.topAdedi) || null,
            miktar: parseFloat(form.miktar),
            birim: form.birim,
            gelenFirmaId: form.gelenFirmaId || null,
            gelenFirmaAdi: firma?.ad || '',
            referansNo: form.referansNo.trim(),
            kesimhaneId: (kesimhaneKullanici ? currentUser.firmaId : form.kesimhaneId) || null,
            kesimhaneAdi: kesimhaneAdi(kesimhaneKullanici ? currentUser.firmaId : form.kesimhaneId),
            notlar: form.notlar.trim(),
        });
        setShowForm(false);
    };

    const handleSil = (k) => {
        if (!silmeOnayi(`${k.kumasAdi} — ${k.miktar} ${k.birim} kumaş girişi silinecek.`)) return;
        kumasStokSil(k.id);
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
                    <button className="btn btn-success" onClick={() => kameraRef.current?.click()} disabled={okumaBusy}>
                        {okumaBusy ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
                        {okumaBusy ? ' Okunuyor...' : ' İrsaliye Okut'}
                    </button>
                    <button className="btn btn-primary" onClick={() => { setForm(yeniForm()); setShowForm(true); }}>
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
                        <button className="btn btn-primary" onClick={() => { setForm(yeniForm()); setShowForm(true); }}><Plus size={17} /> Kumaş Ekle</button>
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
                                <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                                    {[k.gelenFirmaAdi, k.referansNo].filter(Boolean).join(' • ') || '—'}
                                    &nbsp;•&nbsp; {new Date(k.tarih).toLocaleDateString('tr-TR')}
                                </div>
                            </div>
                            <button className="btn-icon" onClick={() => handleSil(k)} style={{ color: 'var(--accent-danger)' }} title="Sil (şifreli)">
                                <Trash2 size={15} />
                            </button>
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
                                options={firmalar.map(f => ({ value: f.id, label: f.ad }))}
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
                                options={kesimhaneler.map(f => ({ value: f.id, label: f.ad }))}
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
                            </div>
                        </div>
                    ))}
                    <div className="text-xs text-muted">
                        Satırları düzeltebilir, istemediklerinizin işaretini kaldırabilirsiniz. Kaydet dediğinizde her satır ayrı stok girişi olur.
                    </div>
                </Modal>
            )}

            {/* Elle Kumaş Giriş Formu */}
            {showForm && (
                <Modal
                    title="Kumaş Girişi"
                    onClose={() => setShowForm(false)}
                    footer={<>
                        <button className="btn btn-ghost" onClick={() => setShowForm(false)}>İptal</button>
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
                                options={kesimhaneler.map(f => ({ value: f.id, label: f.ad }))}
                                placeholder="Kumaşın indiği kesimhane"
                                clearLabel="Belirtilmemiş"
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Geldiği Firma</label>
                        <SearchableSelect
                            value={form.gelenFirmaId}
                            onChange={v => setForm({ ...form, gelenFirmaId: v })}
                            options={firmalar.map(f => ({ value: f.id, label: f.ad }))}
                            placeholder="Seçin (isteğe bağlı)"
                            clearLabel="Seçim yok"
                        />
                    </div>
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
                                    <button className="btn-icon" onClick={() => { if (silmeOnayi(`"${t.ad}" kumaş türü silinecek.`)) kumasTuruSil(t.id); }} style={{ color: 'var(--accent-danger)' }}>
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
