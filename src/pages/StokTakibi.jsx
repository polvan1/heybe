import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { Plus, Search, Package, ArrowDownCircle, ArrowUpCircle, Trash2, Edit2, Scissors } from 'lucide-react';
import { silmeOnayi } from '../utils/guvenlik';

const EMPTY_FORM = { ad: '', birim: 'metre', miktar: '', birimFiyat: '', tedarikci: '', notlar: '' };
const BIRIMLER = ['metre', 'kg', 'adet', 'top', 'rulo'];

export default function StokTakibi() {
    const { stoklar, urunler, stokEkle, stokGuncelle, stokSil, stokHareketiEkle, getStokHareketleri, partiler, urunGuncelle } = useApp();
    const [activeTab, setActiveTab] = useState('urunler'); // 'urunler' | 'malzemeler'
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(null); // 'add' | 'edit' | 'hareket' | 'urun_hareket'
    const [form, setForm] = useState(EMPTY_FORM);
    const [editId, setEditId] = useState(null);
    const [hareketForm, setHareketForm] = useState({ id: '', tip: 'giris', miktar: '', aciklama: '' }); // id is stokId or urunId

    const filteredStoklar = stoklar.filter(s => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return s.ad.toLowerCase().includes(q) || (s.tedarikci || '').toLowerCase().includes(q);
    });

    const filteredUrunler = urunler.filter(u => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return u.urunAdi.toLowerCase().includes(q) || u.urunKodu.toLowerCase().includes(q);
    });

    const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setModal('add'); };
    const openEdit = (stok) => { setForm({ ...EMPTY_FORM, ...stok }); setEditId(stok.id); setModal('edit'); };

    const handleSave = () => {
        if (!form.ad.trim()) return;
        const data = { ...form, miktar: parseFloat(form.miktar) || 0, birimFiyat: parseFloat(form.birimFiyat) || 0 };
        if (editId) {
            stokGuncelle(editId, data);
        } else {
            stokEkle(data);
        }
        setModal(null);
    };

    const handleDelete = (id) => {
        const stok = stoklar.find(s => s.id === id);
        if (!silmeOnayi(`${stok?.ad || 'Stok kaydı'} silinecek.`)) return;
        stokSil(id);
    };

    const openHareket = (id, tip, isUrun = false) => {
        setHareketForm({ id, tip, miktar: '', aciklama: '' });
        setModal(isUrun ? 'urun_hareket' : 'hareket');
    };

    const handleHareket = () => {
        if (!hareketForm.miktar || parseFloat(hareketForm.miktar) <= 0) return;
        const adet = parseFloat(hareketForm.miktar);

        if (modal === 'urun_hareket') {
            const urun = urunler.find(u => u.id === hareketForm.id);
            if (!urun) return;
            const mevcutStok = urun.stokAdet || 0;
            const yeniStok = hareketForm.tip === 'giris' ? mevcutStok + adet : Math.max(mevcutStok - adet, 0);
            urunGuncelle(urun.id, { stokAdet: yeniStok });
            
            stokHareketiEkle({
                urunId: urun.id,
                tip: hareketForm.tip,
                miktar: adet,
                aciklama: hareketForm.aciklama || (hareketForm.tip === 'giris' ? 'Ürün Girişi' : 'Ürün Çıkışı'),
            });
        } else {
            stokHareketiEkle({
                stokId: hareketForm.id,
                tip: hareketForm.tip,
                miktar: adet,
                aciklama: hareketForm.aciklama || (hareketForm.tip === 'giris' ? 'Stok Girişi' : 'Stok Çıkışı'),
            });
        }
        setModal(null);
    };

    const stokHareketleri = getStokHareketleri();

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Stok Takibi</h1>
                {activeTab === 'malzemeler' && (
                    <button className="btn btn-primary" onClick={openAdd}>
                        <Plus size={18} /> Malzeme Ekle
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button 
                    className={`btn ${activeTab === 'urunler' ? 'btn-soft' : 'btn-ghost'}`} 
                    onClick={() => setActiveTab('urunler')}
                >
                    <Package size={16} /> Ürün Stokları
                </button>
                <button 
                    className={`btn ${activeTab === 'malzemeler' ? 'btn-soft' : 'btn-ghost'}`} 
                    onClick={() => setActiveTab('malzemeler')}
                >
                    <Scissors size={16} /> Malzeme Stokları
                </button>
            </div>

            <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    placeholder={activeTab === 'urunler' ? "Ürün kodu veya adı ara..." : "Kumaş adı veya tedarikçi ara..."}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {activeTab === 'urunler' && (
                filteredUrunler.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Package size={48} /></div>
                        <div className="empty-state-title">Ürün bulunamadı</div>
                        <div className="empty-state-text">Önce Ürünler sayfasından ürün ekleyin.</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredUrunler.map(urun => {
                            const hareketler = stokHareketleri.filter(h => h.urunId === urun.id);
                            return (
                                <div key={urun.id} className="stok-card">
                                    <div className="stok-icon">
                                        <Package size={22} />
                                    </div>
                                    <div className="stok-info">
                                        <div className="stok-name">{urun.urunKodu} - {urun.urunAdi}</div>
                                        <div className="stok-meta">
                                            {hareketler.length} stok hareketi
                                        </div>
                                    </div>
                                    <div className="stok-miktar" style={{ fontWeight: 700, fontSize: '1.1rem', color: (urun.stokAdet || 0) > 0 ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                                        {(urun.stokAdet || 0).toLocaleString('tr-TR')} adet
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        <button className="btn-icon" onClick={() => openHareket(urun.id, 'giris', true)} title="Ürün Girişi" style={{ color: 'var(--accent-success)' }}><ArrowDownCircle size={18} /></button>
                                        <button className="btn-icon" onClick={() => openHareket(urun.id, 'cikis', true)} title="Ürün Çıkışı" style={{ color: 'var(--accent-danger)' }}><ArrowUpCircle size={18} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {activeTab === 'malzemeler' && (
                filteredStoklar.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Scissors size={48} /></div>
                        <div className="empty-state-title">Malzeme bulunamadı</div>
                        <div className="empty-state-text">Kumaş veya malzeme ekleyerek başlayın</div>
                        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Malzeme Ekle</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredStoklar.map(stok => {
                            const hareketler = stokHareketleri.filter(h => h.stokId === stok.id);
                            return (
                                <div key={stok.id} className="stok-card">
                                    <div className="stok-icon">
                                        <Scissors size={22} />
                                    </div>
                                    <div className="stok-info">
                                        <div className="stok-name">{stok.ad}</div>
                                        <div className="stok-meta">
                                            {stok.tedarikci && `${stok.tedarikci} • `}
                                            {stok.birimFiyat > 0 && `${stok.birimFiyat} ₺/${stok.birim} • `}
                                            {hareketler.length} hareket
                                        </div>
                                    </div>
                                    <div className="stok-miktar">
                                        {(stok.kalanMiktar ?? stok.miktar ?? 0).toLocaleString('tr-TR')} {stok.birim}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        <button className="btn-icon" onClick={() => openHareket(stok.id, 'giris')} title="Giriş" style={{ color: 'var(--accent-success)' }}><ArrowDownCircle size={18} /></button>
                                        <button className="btn-icon" onClick={() => openHareket(stok.id, 'cikis')} title="Çıkış" style={{ color: 'var(--accent-danger)' }}><ArrowUpCircle size={18} /></button>
                                        <button className="btn-icon" onClick={() => openEdit(stok)}><Edit2 size={16} /></button>
                                        <button className="btn-icon" onClick={() => handleDelete(stok.id)} style={{ color: 'var(--accent-danger)' }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* Stok Ekle/Düzenle Modal (Malzeme) */}
            {(modal === 'add' || modal === 'edit') && (
                <Modal
                    title={editId ? 'Malzeme Düzenle' : 'Yeni Malzeme Ekle'}
                    onClose={() => setModal(null)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleSave}>Kaydet</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">Kumaş / Malzeme Adı *</label>
                        <input className="form-input" value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Örn: Penye Kumaş 30/1" />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Birim</label>
                            <select className="form-input" value={form.birim} onChange={e => setForm({ ...form, birim: e.target.value })}>
                                {BIRIMLER.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Başlangıç Miktarı</label>
                            <input className="form-input" type="number" step="0.01" value={form.miktar} onChange={e => setForm({ ...form, miktar: e.target.value })} placeholder="0" />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Birim Fiyat (₺)</label>
                            <input className="form-input" type="number" step="0.01" value={form.birimFiyat} onChange={e => setForm({ ...form, birimFiyat: e.target.value })} placeholder="0.00" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tedarikçi</label>
                            <input className="form-input" value={form.tedarikci} onChange={e => setForm({ ...form, tedarikci: e.target.value })} placeholder="Tedarikçi adı" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notlar</label>
                        <textarea className="form-input" rows={2} value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} placeholder="Ek bilgi..." />
                    </div>
                </Modal>
            )}

            {/* Hareket Modal (Hem Ürün Hem Malzeme için) */}
            {(modal === 'hareket' || modal === 'urun_hareket') && (
                <Modal
                    title={hareketForm.tip === 'giris' ? 'Giriş İşlemi' : 'Çıkış İşlemi'}
                    onClose={() => setModal(null)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
                            <button className={`btn ${hareketForm.tip === 'giris' ? 'btn-success' : 'btn-danger'}`} onClick={handleHareket}>
                                {hareketForm.tip === 'giris' ? 'Giriş Kaydet' : 'Çıkış Kaydet'}
                            </button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">Miktar *</label>
                        <input
                            className="form-input"
                            type="number"
                            step="0.01"
                            value={hareketForm.miktar}
                            onChange={e => setHareketForm({ ...hareketForm, miktar: e.target.value })}
                            placeholder="0"
                            style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Açıklama</label>
                        <input className="form-input" value={hareketForm.aciklama} onChange={e => setHareketForm({ ...hareketForm, aciklama: e.target.value })} placeholder="Açıklama veya İrsaliye No" />
                    </div>
                </Modal>
            )}
        </div>
    );
}
