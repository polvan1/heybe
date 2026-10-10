import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { Plus, Edit2, Trash2, Package, Search, Warehouse, Minus, Upload, Download, FileSpreadsheet, Camera, X } from 'lucide-react';
import { fotoYukle, fotoSil, fotoSrc } from '../utils/foto';
import { silmeOnayi } from '../utils/guvenlik';

const DEFAULT_BEDENLER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const EMPTY_FORM = {
    urunKodu: '',
    urunAdi: '',
    bedenler: ['S', 'M', 'L', 'XL', '2XL'],
    dagilim: { 'S': 1, 'M': 2, 'L': 3, 'XL': 2, '2XL': 1 },
    kesimFiyat: '',
    dikimFiyat: '',
    utuFiyat: '',
    foto: '',
    firmaFiyatlari: {}, // { [firmaId]: { kesim, dikim, utu } } — firma bazlı anlaşma fiyatları
};

export default function Urunler() {
    const { urunler, urunEkle, urunGuncelle, urunSil, partiler, firmalar = [] } = useApp();
    const [modal, setModal] = useState(null);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [search, setSearch] = useState('');
    const [stokModal, setStokModal] = useState(null);
    const [stokAdet, setStokAdet] = useState('');
    const [importData, setImportData] = useState(null);
    const [fotoBusy, setFotoBusy] = useState(false);
    const fileInputRef = useRef(null);
    const fotoInputRef = useRef(null);

    const handleFotoSec = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setFotoBusy(true);
        try {
            const eskiFoto = form.foto;
            const url = await fotoYukle(file);
            if (eskiFoto) fotoSil(eskiFoto); // eski dosyayı sunucudan temizle
            setForm(f => ({ ...f, foto: url }));
        } catch (err) {
            alert('Fotoğraf yüklenemedi: ' + err.message);
        } finally {
            setFotoBusy(false);
        }
    };

    const handleFotoKaldir = () => {
        if (form.foto) fotoSil(form.foto);
        setForm(f => ({ ...f, foto: '' }));
    };

    const filteredUrunler = urunler.filter(u => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return u.urunKodu.toLowerCase().includes(q) || u.urunAdi.toLowerCase().includes(q);
    });

    const getUrunStok = (urun) => {
        return urun.stokAdet || 0;
    };

    const openAdd = () => {
        setForm(EMPTY_FORM);
        setEditId(null);
        setModal('add');
    };

    // ---- EXCEL / CSV IMPORT ----
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            if (lines.length < 2) {
                alert('Dosyada yeterli veri bulunamadı. İlk satır başlık, sonraki satırlar veri olmalıdır.');
                return;
            }
            // Başlık satırını atla, verileri parse et
            const separator = lines[0].includes(';') ? ';' : ',';
            const headers = lines[0].split(separator).map(h => h.replace(/"/g, '').trim().toLowerCase());
            
            const parsed = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(separator).map(c => c.replace(/"/g, '').trim());
                if (cols.length < 2) continue;

                // Esnek kolon eşleştirme — kodIdx önce bulunur, adIdx onu hariç tutar
                const kodIdx = headers.findIndex(h => h.includes('kod') || h.includes('code'));
                const adIdx = headers.findIndex((h, idx) => {
                    if (idx === kodIdx) return false; // kod sütununu atla
                    return h.includes('ürün ad') || h.includes('urun ad') || h.includes('ad') || h.includes('name') || h.includes('isim') || h.includes('ürün');
                });
                const bedenIdx = headers.findIndex(h => h.includes('beden') || h.includes('size'));
                const kesimIdx = headers.findIndex(h => h.includes('kesim'));
                const dikimIdx = headers.findIndex(h => h.includes('dikim'));
                const utuIdx = headers.findIndex(h => h.includes('ütü') || h.includes('utu') || h.includes('paket'));

                const urunKodu = cols[kodIdx >= 0 ? kodIdx : 0] || '';
                const urunAdi = cols[adIdx >= 0 ? adIdx : (kodIdx === 0 ? 1 : 0)] || '';
                const bedenStr = bedenIdx >= 0 ? cols[bedenIdx] : '';
                const kesimFiyat = kesimIdx >= 0 ? parseFloat(cols[kesimIdx]) || 0 : 0;
                const dikimFiyat = dikimIdx >= 0 ? parseFloat(cols[dikimIdx]) || 0 : 0;
                const utuFiyat = utuIdx >= 0 ? parseFloat(cols[utuIdx]) || 0 : 0;

                if (!urunKodu && !urunAdi) continue;

                // Bedenler parse et (virgülle ayrılmış veya boşlukla)
                let bedenler = ['S', 'M', 'L', 'XL', '2XL'];
                if (bedenStr) {
                    bedenler = bedenStr.split(/[,\s\/\-]+/).map(b => b.trim().toUpperCase()).filter(b => b);
                }

                parsed.push({ urunKodu, urunAdi, bedenler, kesimFiyat, dikimFiyat, utuFiyat });
            }

            if (parsed.length === 0) {
                alert('Geçerli ürün verisi bulunamadı. Lütfen dosya formatını kontrol edin.');
                return;
            }
            setImportData(parsed);
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
    };

    const handleImportConfirm = () => {
        if (!importData) return;
        importData.forEach(item => {
            const dagilim = {};
            item.bedenler.forEach((b, i) => {
                dagilim[b] = i === Math.floor(item.bedenler.length / 2) ? 3 : (i === 0 || i === item.bedenler.length - 1 ? 1 : 2);
            });
            urunEkle({
                urunKodu: item.urunKodu,
                urunAdi: item.urunAdi,
                asorti: { bedenler: item.bedenler, dagilim },
                kesimFiyat: item.kesimFiyat,
                dikimFiyat: item.dikimFiyat,
                utuFiyat: item.utuFiyat,
            });
        });
        setImportData(null);
        alert(`${importData.length} ürün başarıyla eklendi!`);
    };

    const downloadTemplate = () => {
        const csv = '\uFEFFÜrün Kodu;Ürün Adı;Bedenler;Kesim Fiyat;Dikim Fiyat;Ütü Fiyat\nTS-001;Erkek Basic T-Shirt;S,M,L,XL,2XL;1.50;3.00;1.00\nTS-002;Kadın V-Yaka;XS,S,M,L,XL;1.75;3.50;1.25';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'urun_sablonu.csv';
        link.click();
    };

    const openEdit = (e, urun) => {
        e.stopPropagation();
        setForm({
            urunKodu: urun.urunKodu,
            urunAdi: urun.urunAdi,
            bedenler: urun.asorti.bedenler,
            dagilim: { ...urun.asorti.dagilim },
            kesimFiyat: urun.kesimFiyat || '',
            dikimFiyat: urun.dikimFiyat || '',
            utuFiyat: urun.utuFiyat || '',
            foto: urun.foto || '',
            firmaFiyatlari: urun.firmaFiyatlari ? JSON.parse(JSON.stringify(urun.firmaFiyatlari)) : {},
        });
        setEditId(urun.id);
        setModal('edit');
    };

    const handleSave = () => {
        if (!form.urunKodu.trim() || !form.urunAdi.trim()) return;
        const urunData = {
            urunKodu: form.urunKodu,
            urunAdi: form.urunAdi,
            asorti: {
                bedenler: form.bedenler,
                dagilim: form.dagilim,
            },
            kesimFiyat: parseFloat(form.kesimFiyat) || 0,
            dikimFiyat: parseFloat(form.dikimFiyat) || 0,
            utuFiyat: parseFloat(form.utuFiyat) || 0,
            foto: form.foto || null,
            // Tamamen boş anlaşma satırlarını kaydetme
            firmaFiyatlari: Object.fromEntries(
                Object.entries(form.firmaFiyatlari || {}).filter(([, f]) =>
                    parseFloat(f?.kesim) > 0 || parseFloat(f?.dikim) > 0 || parseFloat(f?.utu) > 0
                )
            ),
        };
        if (editId) {
            urunGuncelle(editId, urunData);
        } else {
            urunEkle(urunData);
        }
        setModal(null);
    };

    // Silme, yanlışlıkla dokunmayı önlemek için listeden kaldırıldı —
    // ürün silme artık Düzenle penceresinde ve güvenlik şifresiyle yapılır.
    const handleModalSil = () => {
        const urun = urunler.find(u => u.id === editId);
        if (!silmeOnayi(`${urun?.urunKodu || ''} — ${urun?.urunAdi || ''} ürünü silinecek.`)) return;
        urunSil(editId);
        setModal(null);
    };

    const toggleBeden = (beden) => {
        const newBedenler = form.bedenler.includes(beden)
            ? form.bedenler.filter(b => b !== beden)
            : [...form.bedenler, beden].sort((a, b) => DEFAULT_BEDENLER.indexOf(a) - DEFAULT_BEDENLER.indexOf(b));

        const newDagilim = { ...form.dagilim };
        if (!newBedenler.includes(beden)) {
            delete newDagilim[beden];
        } else if (!newDagilim[beden]) {
            newDagilim[beden] = 1;
        }
        setForm({ ...form, bedenler: newBedenler, dagilim: newDagilim });
    };

    const updateDagilim = (beden, value) => {
        setForm({
            ...form,
            dagilim: { ...form.dagilim, [beden]: parseInt(value, 10) || 0 },
        });
    };

    const toplamAsortiAdet = form.bedenler.reduce((t, b) => t + (form.dagilim[b] || 0), 0);

    const handleStokGuncelle = () => {
        if (!stokModal || !stokAdet || parseInt(stokAdet) <= 0) return;
        const urun = urunler.find(u => u.id === stokModal.urunId);
        if (!urun) return;
        const mevcutStok = urun.stokAdet || 0;
        const adet = parseInt(stokAdet, 10);
        const yeniStok = stokModal.tip === 'giris'
            ? mevcutStok + adet
            : Math.max(mevcutStok - adet, 0);
        urunGuncelle(stokModal.urunId, { stokAdet: yeniStok });
        setStokModal(null);
        setStokAdet('');
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Ürünler</h1>
                <div className="page-header-actions">
                    <button className="btn btn-ghost" onClick={downloadTemplate} title="Şablon İndir">
                        <Download size={16} /> Şablon
                    </button>
                    <button className="btn btn-success" onClick={() => fileInputRef.current?.click()} title="Excel/CSV'den Aktar">
                        <Upload size={16} /> Excel Aktar
                    </button>
                    <button className="btn btn-primary" onClick={openAdd}>
                        <Plus size={18} /> Ürün Ekle
                    </button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                />
            </div>

            {/* Arama */}
            <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    placeholder="Ürün kodu veya adı ara..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {filteredUrunler.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Package size={48} /></div>
                    <div className="empty-state-title">Ürün bulunamadı</div>
                    <div className="empty-state-text">Yeni bir ürün ekleyerek başlayın</div>
                    <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Ürün Ekle</button>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="desktop-only">
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Ürün Kodu</th>
                                        <th>Ürün Adı</th>
                                        <th style={{ textAlign: 'center' }}>Stok</th>
                                        <th style={{ textAlign: 'center' }}>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUrunler.map(urun => {
                                        const stok = getUrunStok(urun);
                                        return (
                                            <tr key={urun.id}>
                                                <td style={{ fontWeight: 600 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {urun.foto && (
                                                            <img src={fotoSrc(urun.foto)} alt="" style={{ width: '34px', height: '34px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', flexShrink: 0 }} />
                                                        )}
                                                        {urun.urunKodu}
                                                    </div>
                                                </td>
                                                <td>{urun.urunAdi}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                        <span style={{
                                                            fontWeight: 700,
                                                            fontSize: '1rem',
                                                            color: stok > 0 ? 'var(--accent-success)' : 'var(--text-muted)',
                                                            minWidth: '40px',
                                                        }}>
                                                            {stok.toLocaleString('tr-TR')}
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '2px' }}>
                                                            <button
                                                                className="btn-icon"
                                                                title="Stok Giriş"
                                                                onClick={(e) => { e.stopPropagation(); setStokModal({ urunId: urun.id, tip: 'giris' }); setStokAdet(''); }}
                                                                style={{ color: 'var(--accent-success)', width: '26px', height: '26px' }}
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                            <button
                                                                className="btn-icon"
                                                                title="Stok Çıkış"
                                                                onClick={(e) => { e.stopPropagation(); setStokModal({ urunId: urun.id, tip: 'cikis' }); setStokAdet(''); }}
                                                                style={{ color: 'var(--accent-danger)', width: '26px', height: '26px' }}
                                                            >
                                                                <Minus size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                        <button className="btn-icon" onClick={(e) => openEdit(e, urun)}><Edit2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="mobile-only">
                        <div className="mobile-list">
                            {filteredUrunler.map(urun => {
                                const stok = getUrunStok(urun);
                                return (
                                    <div key={urun.id} className="mobile-list-item">
                                        <div className="mobile-list-item-header">
                                            <span className="mobile-list-item-title">{urun.urunKodu}</span>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button className="btn-icon" onClick={(e) => openEdit(e, urun)}><Edit2 size={16} /></button>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                                            {urun.urunAdi}
                                        </div>

                                        {/* Stok Alanı */}
                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 12px', background: stok > 0 ? 'var(--color-success-soft)' : 'var(--color-surface-muted)',
                                            borderRadius: 'var(--radius-sm)', marginBottom: '8px',
                                            border: stok > 0 ? '1px solid var(--color-success-border)' : '1px solid var(--border-color)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Warehouse size={16} style={{ color: stok > 0 ? 'var(--accent-success)' : 'var(--text-muted)' }} />
                                                <span className="text-muted" style={{ fontSize: '0.8rem' }}>Stok</span>
                                                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: stok > 0 ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                                                    {stok.toLocaleString('tr-TR')} adet
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => { setStokModal({ urunId: urun.id, tip: 'giris' }); setStokAdet(''); }}
                                                    style={{ padding: '4px 8px' }}
                                                >
                                                    <Plus size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-ghost"
                                                    onClick={() => { setStokModal({ urunId: urun.id, tip: 'cikis' }); setStokAdet(''); }}
                                                    style={{ padding: '4px 8px', color: 'var(--accent-danger)' }}
                                                >
                                                    <Minus size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Ürün Ekle/Düzenle Modal */}
            {modal && (
                <Modal
                    title={editId ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}
                    onClose={() => setModal(null)}
                    footer={
                        <>
                            {editId && (
                                <button className="btn btn-ghost" onClick={handleModalSil} style={{ color: 'var(--accent-danger)', marginRight: 'auto' }}>
                                    <Trash2 size={15} /> Sil
                                </button>
                            )}
                            <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleSave}>Kaydet</button>
                        </>
                    }
                >
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Ürün Kodu *</label>
                            <input className="form-input" value={form.urunKodu} onChange={e => setForm({ ...form, urunKodu: e.target.value })} placeholder="Örn: TS-001" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ürün Adı *</label>
                            <input className="form-input" value={form.urunAdi} onChange={e => setForm({ ...form, urunAdi: e.target.value })} placeholder="Örn: Erkek Basic T-Shirt" />
                        </div>
                    </div>

                    {/* Numune Fotoğrafı */}
                    <div className="form-group" style={{ marginTop: '4px' }}>
                        <label className="form-label">Numune Fotoğrafı</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {form.foto ? (
                                <img
                                    src={fotoSrc(form.foto)}
                                    alt="Numune"
                                    style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                                />
                            ) : (
                                <div style={{ width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                                    <Camera size={22} />
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fotoInputRef.current?.click()} disabled={fotoBusy}>
                                    <Camera size={14} /> {fotoBusy ? 'Yükleniyor...' : form.foto ? 'Değiştir' : 'Fotoğraf Seç'}
                                </button>
                                {form.foto && (
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleFotoKaldir} style={{ color: 'var(--accent-danger)' }}>
                                        <X size={14} /> Kaldır
                                    </button>
                                )}
                            </div>
                            <input ref={fotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoSec} />
                        </div>
                    </div>

                    <div className="form-row" style={{ marginTop: '12px', padding: '12px', background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-sm)' }}>
                        <div className="form-group">
                            <label className="form-label">Kesim Fiyatı (₺)</label>
                            <input type="number" step="0.01" className="form-input" value={form.kesimFiyat} onChange={e => setForm({ ...form, kesimFiyat: e.target.value })} placeholder="0.00" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Dikim Fiyatı (₺)</label>
                            <input type="number" step="0.01" className="form-input" value={form.dikimFiyat} onChange={e => setForm({ ...form, dikimFiyat: e.target.value })} placeholder="0.00" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ütü/Paket Fiyatı (₺)</label>
                            <input type="number" step="0.01" className="form-input" value={form.utuFiyat} onChange={e => setForm({ ...form, utuFiyat: e.target.value })} placeholder="0.00" />
                        </div>
                    </div>

                    {/* Firma Bazlı Fiyat Anlaşmaları */}
                    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '4px' }}>Firma Bazlı Fiyat Anlaşmaları</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Belirli bir firmayla farklı fiyat anlaştıysanız buraya girin. Parti açarken o firma seçilince
                            bu fiyat otomatik kullanılır; boş bırakılan alanlar için yukarıdaki varsayılan geçerlidir.
                        </div>

                        {Object.entries(form.firmaFiyatlari || {}).map(([fid, fiyatlar]) => {
                            const firma = firmalar.find(f => f.id === fid);
                            const setF = (alan, deger) => setForm({
                                ...form,
                                firmaFiyatlari: { ...form.firmaFiyatlari, [fid]: { ...fiyatlar, [alan]: deger } },
                            });
                            return (
                                <div key={fid} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: '1 1 120px', fontWeight: 600, fontSize: '0.8rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {firma?.ad || 'Silinmiş firma'}
                                    </div>
                                    {[['kesim', 'Kesim'], ['dikim', 'Dikim'], ['utu', 'Ütü']].map(([alan, ad]) => (
                                        <input
                                            key={alan}
                                            type="number" step="0.01" min="0"
                                            className="form-input"
                                            style={{ width: '74px', padding: '6px 8px', fontSize: '0.8rem' }}
                                            value={fiyatlar?.[alan] ?? ''}
                                            onChange={e => setF(alan, e.target.value)}
                                            placeholder={ad}
                                            title={`${ad} fiyatı (₺)`}
                                        />
                                    ))}
                                    <button
                                        type="button" className="btn-icon"
                                        onClick={() => {
                                            const yeni = { ...form.firmaFiyatlari };
                                            delete yeni[fid];
                                            setForm({ ...form, firmaFiyatlari: yeni });
                                        }}
                                        style={{ color: 'var(--accent-danger)' }} title="Anlaşmayı kaldır"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })}

                        <select
                            className="form-input"
                            style={{ fontSize: '0.8rem' }}
                            value=""
                            onChange={e => {
                                const fid = e.target.value;
                                if (!fid || form.firmaFiyatlari?.[fid]) return;
                                setForm({ ...form, firmaFiyatlari: { ...form.firmaFiyatlari, [fid]: { kesim: '', dikim: '', utu: '' } } });
                            }}
                        >
                            <option value="">+ Firma anlaşması ekle...</option>
                            {firmalar
                                .filter(f => !form.firmaFiyatlari?.[f.id])
                                .map(f => <option key={f.id} value={f.id}>{f.ad}</option>)}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginTop: '16px' }}>
                        <label className="form-label">Beden Seçimi</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {DEFAULT_BEDENLER.map(beden => (
                                <button
                                    key={beden}
                                    type="button"
                                    className={`btn btn-sm ${form.bedenler.includes(beden) ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => toggleBeden(beden)}
                                    style={{ minWidth: '46px' }}
                                >
                                    {beden}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Asorti Dağılımı (1 Kat = {toplamAsortiAdet} adet)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '8px' }}>
                            {form.bedenler.map(beden => (
                                <div key={beden} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>{beden}</div>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="0"
                                        value={form.dagilim[beden] || 0}
                                        onChange={e => updateDagilim(beden, e.target.value)}
                                        style={{ textAlign: 'center', padding: '6px' }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal>
            )}

            {/* Stok Güncelleme Modal */}
            {stokModal && (
                <Modal
                    title={stokModal.tip === 'giris' ? 'Stok Giriş' : 'Stok Çıkış'}
                    onClose={() => { setStokModal(null); setStokAdet(''); }}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => { setStokModal(null); setStokAdet(''); }}>İptal</button>
                            <button
                                className={`btn ${stokModal.tip === 'giris' ? 'btn-success' : 'btn-primary'}`}
                                onClick={handleStokGuncelle}
                            >
                                {stokModal.tip === 'giris' ? 'Stok Ekle' : 'Stok Düş'}
                            </button>
                        </>
                    }
                >
                    {(() => {
                        const urun = urunler.find(u => u.id === stokModal.urunId);
                        if (!urun) return null;
                        return (
                            <>
                                <div style={{ padding: '12px', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                                    <div style={{ fontWeight: 600 }}>{urun.urunKodu} — {urun.urunAdi}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        Mevcut Stok: <strong style={{ color: 'var(--accent-primary)', fontSize: '1.1rem' }}>{(urun.stokAdet || 0).toLocaleString('tr-TR')}</strong> adet
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{stokModal.tip === 'giris' ? 'Eklenecek Adet' : 'Çıkılacak Adet'}</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="1"
                                        value={stokAdet}
                                        onChange={e => setStokAdet(e.target.value)}
                                        placeholder="Adet giriniz"
                                        style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}
                                        autoFocus
                                    />
                                </div>
                                {stokAdet && parseInt(stokAdet) > 0 && (
                                    <div style={{
                                        padding: '10px 12px',
                                        background: stokModal.tip === 'giris' ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.85rem',
                                        marginTop: '8px'
                                    }}>
                                        Yeni stok: <strong>
                                            {stokModal.tip === 'giris'
                                                ? ((urun.stokAdet || 0) + parseInt(stokAdet)).toLocaleString('tr-TR')
                                                : Math.max((urun.stokAdet || 0) - parseInt(stokAdet), 0).toLocaleString('tr-TR')
                                            }
                                        </strong> adet
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </Modal>
            )}

            {/* Excel Import Önizleme Modal */}
            {importData && (
                <Modal
                    title={`Excel Aktarma Önizleme (${importData.length} ürün)`}
                    onClose={() => setImportData(null)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setImportData(null)}>İptal</button>
                            <button className="btn btn-success" onClick={handleImportConfirm}>
                                <Upload size={16} /> {importData.length} Ürünü Aktar
                            </button>
                        </>
                    }
                >
                    <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-primary)', position: 'sticky', top: 0 }}>
                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>#</th>
                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>Ürün Kodu</th>
                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>Ürün Adı</th>
                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>Bedenler</th>
                                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>Kesim ₺</th>
                                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>Dikim ₺</th>
                                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid var(--border-color)', whiteSpace: 'nowrap' }}>Ütü ₺</th>
                                </tr>
                            </thead>
                            <tbody>
                                {importData.map((item, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{i + 1}</td>
                                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{item.urunKodu}</td>
                                        <td style={{ padding: '6px 8px' }}>{item.urunAdi}</td>
                                        <td style={{ padding: '6px 8px', fontSize: '0.75rem' }}>{item.bedenler.join(', ')}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.kesimFiyat > 0 ? item.kesimFiyat.toFixed(2) : '-'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.dikimFiyat > 0 ? item.dikimFiyat.toFixed(2) : '-'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.utuFiyat > 0 ? item.utuFiyat.toFixed(2) : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: '12px', padding: '10px', background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Veriler doğru görünüyorsa "Aktar" butonuna basın. Asorti dağılımları otomatik oluşturulacak.
                    </div>
                </Modal>
            )}
        </div>
    );
}
