import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { Plus, Edit2, Trash2, Phone, MapPin, User, Search, Star, Calendar } from 'lucide-react';
import { FIRMA_TIP_LABELS } from '../data/db';
import { silmeOnayi } from '../utils/guvenlik';

const TIPLER = [
    { value: 'all', label: 'Tümü' },
    { value: 'kesimhane', label: 'Kesimhane' },
    { value: 'baskici', label: 'Baskıcı' },
    { value: 'atolye', label: 'Atölye' },
    { value: 'utupaketci', label: 'Ütü/Paketçi' },
];

const EMPTY_FORM = { ad: '', tip: 'atolye', telefon: '', adres: '', yetkiliKisi: '', notlar: '', gunlukKapasite: '', odemeVadesi: '' };

export default function Firmalar() {
    const { firmalar, firmaEkle, firmaGuncelle, firmaSil, partiler, getFirmaPerformans } = useApp();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(null);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

    const filtered = firmalar.filter(f => {
        if (filter !== 'all' && f.tip !== filter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return f.ad.toLowerCase().includes(q) ||
                   (f.yetkiliKisi || '').toLowerCase().includes(q) ||
                   (f.telefon || '').includes(q);
        }
        return true;
    });

    const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setModal('add'); };
    const openEdit = (firma) => { setForm({ ...EMPTY_FORM, ...firma }); setEditId(firma.id); setModal('edit'); };

    const handleSave = () => {
        if (!form.ad.trim()) return;
        const data = { ...form, odemeVadesi: form.odemeVadesi ? parseInt(form.odemeVadesi, 10) : null };
        if (editId) {
            firmaGuncelle(editId, data);
        } else {
            firmaEkle(data);
        }
        setModal(null);
    };

    // Silme, yanlışlıkla dokunmayı önlemek için karttan kaldırıldı —
    // firma silme artık Düzenle penceresinde ve güvenlik şifresiyle yapılır.
    const handleModalSil = () => {
        const firma = firmalar.find(f => f.id === editId);
        if (!silmeOnayi(`${firma?.ad || ''} firması silinecek.`)) return;
        const result = firmaSil(editId);
        if (result && result.ok === false) {
            alert(result.reason);
            return;
        }
        setModal(null);
    };

    const getAktifPartiSayisi = (firmaId) => {
        return partiler.filter(p =>
            p.durum !== 'tamamlandi' &&
            p.firmaAtamalari?.some(a => a.firmaId === firmaId)
        ).length;
    };

    const getPerfBadge = (skor) => {
        if (skor >= 85) return { label: `${skor}`, cls: 'excellent' };
        if (skor >= 70) return { label: `${skor}`, cls: 'good' };
        if (skor >= 50) return { label: `${skor}`, cls: 'average' };
        return { label: `${skor}`, cls: 'poor' };
    };

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Firmalar</h1>
                <button className="btn btn-primary" onClick={openAdd}>
                    <Plus size={18} /> Firma Ekle
                </button>
            </div>

            {/* Arama */}
            <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    placeholder="Firma adı, yetkili veya telefon ara..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Filter Tabs */}
            <div className="filter-row">
                {TIPLER.map(t => (
                    <button
                        key={t.value}
                        className={`filter-btn ${filter === t.value ? 'active' : ''}`}
                        onClick={() => setFilter(t.value)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Firma List */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><FirmaSvg size={48} /></div>
                    <div className="empty-state-title">Firma bulunamadı</div>
                    <div className="empty-state-text">Yeni bir firma ekleyerek başlayın</div>
                    <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Firma Ekle</button>
                </div>
            ) : (
                <div className="mobile-list">
                    {filtered.map(firma => {
                        const perf = getFirmaPerformans(firma.id);
                        const badge = getPerfBadge(perf.skor);
                        return (
                            <div key={firma.id} className="mobile-list-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/cari/${firma.id}`)}>
                                <div className="mobile-list-item-header">
                                    <span className="mobile-list-item-title">{firma.ad}</span>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        {perf.toplamIs > 0 && (
                                            <span className={`perf-badge ${badge.cls}`}>{badge.label}</span>
                                        )}
                                        <span className={`badge ${firma.tip === 'atolye' ? 'dikimde' : firma.tip === 'kesimhane' ? 'kesimde' : firma.tip === 'baskici' ? 'baskida' : 'utupakette'}`}>
                                            {FIRMA_TIP_LABELS[firma.tip]}
                                        </span>
                                    </div>
                                </div>
                                <div className="mobile-list-item-meta">
                                    {firma.yetkiliKisi && <span><User size={13} style={{ verticalAlign: 'middle' }} /> {firma.yetkiliKisi}</span>}
                                    {firma.telefon && <span><Phone size={13} style={{ verticalAlign: 'middle' }} /> {firma.telefon}</span>}
                                    {firma.adres && <span><MapPin size={13} style={{ verticalAlign: 'middle' }} /> {firma.adres}</span>}
                                    {firma.odemeVadesi && <span><Calendar size={13} style={{ verticalAlign: 'middle' }} /> Vade: Ayın {firma.odemeVadesi}'i</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem' }}>
                                        <span className="text-muted">
                                            Aktif: <strong style={{ color: 'var(--accent-info)' }}>{getAktifPartiSayisi(firma.id)}</strong>
                                        </span>
                                        {perf.toplamIs > 0 && (
                                            <>
                                                <span className="text-muted">
                                                    Fire: <strong style={{ color: parseFloat(perf.fireOrani) > 5 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>{perf.fireOrani}%</strong>
                                                </span>
                                                <span className="text-muted">
                                                    Ort: <strong>{perf.ortTeslimSuresi} gün</strong>
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        <button className="btn-icon" onClick={() => openEdit(firma)}><Edit2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {modal && (
                <Modal
                    title={editId ? 'Firma Düzenle' : 'Yeni Firma Ekle'}
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
                    <div className="form-group">
                        <label className="form-label">Firma Adı *</label>
                        <input className="form-input" value={form.ad} onChange={e => updateField('ad', e.target.value)} placeholder="Firma adı girin" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Firma Tipi</label>
                        <select className="form-input" value={form.tip} onChange={e => updateField('tip', e.target.value)}>
                            {TIPLER.filter(t => t.value !== 'all').map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Yetkili Kişi</label>
                            <input className="form-input" value={form.yetkiliKisi} onChange={e => updateField('yetkiliKisi', e.target.value)} placeholder="Ad Soyad" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Telefon</label>
                            <input className="form-input" value={form.telefon} onChange={e => updateField('telefon', e.target.value)} placeholder="0532 000 0000" type="tel" />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Adres</label>
                            <input className="form-input" value={form.adres} onChange={e => updateField('adres', e.target.value)} placeholder="Adres" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Günlük Kapasite (adet)</label>
                            <input className="form-input" type="number" min="0" value={form.gunlukKapasite} onChange={e => updateField('gunlukKapasite', parseInt(e.target.value, 10) || '')} placeholder="Örn: 200" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Ödeme Vadesi (Ayın Kaçı)</label>
                        <input className="form-input" type="number" min="1" max="31" value={form.odemeVadesi || ''} onChange={e => updateField('odemeVadesi', e.target.value)} placeholder="Örn: 20 (Ayın 20'si)" />
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Her ayın bu gününde ödeme vadesi gelir. Boş bırakılırsa vade takibi yapılmaz.</div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notlar</label>
                        <textarea className="form-input" rows={3} value={form.notlar} onChange={e => updateField('notlar', e.target.value)} placeholder="Ek notlar..." />
                    </div>
                </Modal>
            )}
        </div>
    );
}

function FirmaSvg(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M17 18h1" /><path d="M12 18h1" /><path d="M7 18h1" /></svg>
    );
}
