import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Users, Plus, Edit2, Trash2, Shield, Eye, EyeOff } from 'lucide-react';
import Modal from '../components/Modal';
import { silmeOnayi } from '../utils/guvenlik';

const ROLLER = [
    { value: 'admin', label: 'Yönetici', desc: 'Tüm yetkilere sahip' },
    { value: 'uretim', label: 'Üretim Sorumlusu', desc: 'Parti ve iş akışı yönetimi' },
    { value: 'muhasebe', label: 'Muhasebe', desc: 'Cari hesaplar ve raporlar' },
    { value: 'fasoncu', label: 'Fasoncu', desc: 'Sadece izin verilen sayfalar' },
    { value: 'izleyici', label: 'İzleyici', desc: 'Sadece görüntüleme' },
];

const TUM_YETKILER = [
    { key: 'anasayfa', label: 'Anasayfa' },
    { key: 'islerim', label: 'İşlerim (Fasoncu)' },
    { key: 'partiler', label: 'Partiler' },
    { key: 'is_akisi', label: 'İş Akışı' },
    { key: 'takvim', label: 'Takvim' },
    { key: 'urunler', label: 'Ürünler' },
    { key: 'stok_takibi', label: 'Stok Takibi' },
    { key: 'firmalar', label: 'Firmalar' },
    { key: 'cari_hesaplar', label: 'Cari Hesaplar' },
    { key: 'irsaliyeler', label: 'İrsaliyeler' },
    { key: 'raporlar', label: 'Raporlar' },
    { key: 'kullanicilar', label: 'Kullanıcılar' },
    { key: 'ayarlar', label: 'Ayarlar' },
];

const DEFAULT_YETKILER = {
    admin: TUM_YETKILER.map(y => y.key),
    uretim: ['anasayfa', 'partiler', 'is_akisi', 'takvim', 'urunler', 'stok_takibi', 'irsaliyeler'],
    muhasebe: ['anasayfa', 'cari_hesaplar', 'raporlar', 'firmalar'],
    fasoncu: ['islerim'],
    izleyici: ['anasayfa', 'partiler', 'raporlar'],
};

const EMPTY_FORM = {
    ad: '',
    email: '',
    telefon: '',
    rol: 'fasoncu',
    yetkiler: [...DEFAULT_YETKILER.fasoncu],
    aktif: true,
    sifre: '',
    firmaId: '',
};

export default function Kullanicilar() {
    const { kullanicilar = [], kullaniciEkle, kullaniciGuncelle, kullaniciSil, firmalar = [] } = useApp();
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [editId, setEditId] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    const openAdd = () => {
        setForm({ ...EMPTY_FORM });
        setEditId(null);
        setModal('add');
    };

    const openEdit = (user) => {
        setForm({
            ad: user.ad,
            email: user.email || '',
            telefon: user.telefon || '',
            rol: user.rol,
            yetkiler: [...(user.yetkiler || DEFAULT_YETKILER[user.rol] || [])],
            aktif: user.aktif !== false,
            sifre: '',
            firmaId: user.firmaId || '',
        });
        setEditId(user.id);
        setModal('edit');
    };

    const handleRolChange = (rol) => {
        setForm({
            ...form,
            rol,
            yetkiler: [...(DEFAULT_YETKILER[rol] || [])],
        });
    };

    const toggleYetki = (key) => {
        const has = form.yetkiler.includes(key);
        setForm({
            ...form,
            yetkiler: has
                ? form.yetkiler.filter(y => y !== key)
                : [...form.yetkiler, key],
        });
    };

    const handleSave = () => {
        if (!form.ad.trim()) return;
        const userData = {
            ad: form.ad.trim(),
            email: form.email.trim(),
            telefon: form.telefon.trim(),
            rol: form.rol,
            yetkiler: form.yetkiler,
            aktif: form.aktif,
            firmaId: form.firmaId || null,
        };
        if (form.sifre) {
            userData.sifre = form.sifre;
        }
        if (editId) {
            kullaniciGuncelle(editId, userData);
        } else {
            kullaniciEkle({ ...userData, sifre: form.sifre || '1234' });
        }
        setModal(null);
    };

    const handleDelete = (id) => {
        const user = kullanicilar.find(k => k.id === id);
        if (!silmeOnayi(`${user?.ad || ''} kullanıcısı silinecek.`)) return;
        kullaniciSil(id);
    };

    const getRolBadge = (rol) => {
        const colors = {
            admin: { bg: '#deecf9', color: '#0078d4', border: '#c7e0f4' },
            uretim: { bg: '#fff4ce', color: '#d83b01', border: '#ffeb9c' },
            muhasebe: { bg: '#dff6dd', color: '#107c10', border: '#c1e1bc' },
            fasoncu: { bg: '#f4f4fc', color: '#5c2d91', border: '#e2e2f6' },
            izleyici: { bg: '#f3f2f1', color: '#605e5c', border: '#edebe9' },
        };
        const c = colors[rol] || colors.izleyici;
        const label = ROLLER.find(r => r.value === rol)?.label || rol;
        return (
            <span style={{
                display: 'inline-block',
                padding: '3px 8px',
                borderRadius: '2px',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: c.bg,
                color: c.color,
                border: `1px solid ${c.border}`,
            }}>
                {label}
            </span>
        );
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={20} /> Kullanıcı Yönetimi
                </h2>
                <button className="btn btn-primary btn-sm" onClick={openAdd}>
                    <Plus size={16} /> Kullanıcı Ekle
                </button>
            </div>

            {/* Kullanıcı Listesi */}
            <div className="card">
                {kullanicilar.length === 0 ? (
                    <div className="text-center" style={{ padding: '40px 20px' }}>
                        <Users size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                        <p className="text-muted">Henüz kullanıcı eklenmemiş.</p>
                        <button className="btn btn-primary btn-sm" style={{ marginTop: '12px' }} onClick={openAdd}>
                            <Plus size={14} /> İlk Kullanıcıyı Ekle
                        </button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Kullanıcı</th>
                                    <th>İletişim</th>
                                    <th>Rol</th>
                                    <th>Durum</th>
                                    <th>Yetkiler</th>
                                    <th style={{ width: '80px' }}>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {kullanicilar.map(user => (
                                    <tr key={user.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{user.ad}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.8rem' }}>{user.email || '—'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.telefon || ''}</div>
                                        </td>
                                        <td>{getRolBadge(user.rol)}</td>
                                        <td>
                                            <span style={{
                                                display: 'inline-block',
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: user.aktif !== false ? '#107c10' : '#a19f9d',
                                                marginRight: '6px',
                                            }} />
                                            <span style={{ fontSize: '0.78rem' }}>{user.aktif !== false ? 'Aktif' : 'Pasif'}</span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                {(user.yetkiler || []).length} sayfa
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button className="btn-icon" onClick={() => openEdit(user)} title="Düzenle">
                                                    <Edit2 size={15} />
                                                </button>
                                                <button className="btn-icon" onClick={() => handleDelete(user.id)} title="Sil" style={{ color: 'var(--accent-danger)' }}>
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Roller Açıklaması */}
            <div className="card" style={{ marginTop: '20px' }}>
                <div className="card-header">
                    <h3 className="card-title"><Shield size={18} /> Rol Açıklamaları</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {ROLLER.map(r => (
                        <div key={r.value} style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                {getRolBadge(r.value)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {modal && (
                <Modal
                    title={editId ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}
                    onClose={() => setModal(null)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!form.ad.trim()}>
                                {editId ? 'Güncelle' : 'Ekle'}
                            </button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">Ad Soyad *</label>
                        <input className="form-input" value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Kullanıcı adı" />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">E-posta</label>
                            <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ornek@email.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Telefon</label>
                            <input className="form-input" value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} placeholder="0555 123 45 67" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Şifre {editId ? '(Boş bırakılırsa değişmez)' : ''}</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="form-input"
                                type={showPassword ? 'text' : 'password'}
                                value={form.sifre}
                                onChange={e => setForm({ ...form, sifre: e.target.value })}
                                placeholder={editId ? '••••••••' : 'Şifre belirleyin'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px',
                                }}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Rol *</label>
                        <select className="form-input" value={form.rol} onChange={e => handleRolChange(e.target.value)}>
                            {ROLLER.map(r => (
                                <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                            ))}
                        </select>
                    </div>

                    {form.rol === 'fasoncu' && (
                        <div className="form-group">
                            <label className="form-label">Bağlı Firma *</label>
                            <select className="form-input" value={form.firmaId} onChange={e => setForm({ ...form, firmaId: e.target.value })}>
                                <option value="">— Firma seçin —</option>
                                {firmalar.map(f => (
                                    <option key={f.id} value={f.id}>{f.ad}</option>
                                ))}
                            </select>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Fasoncu, "İşlerim" sayfasında yalnızca bu firmanın üzerindeki işleri görür.
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Shield size={14} /> Sayfa Yetkileri
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                (Fasoncu için özelleştirin)
                            </span>
                        </label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                            gap: '6px',
                            padding: '12px',
                            background: 'rgba(0,0,0,0.02)',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                        }}>
                            {TUM_YETKILER.map(y => {
                                const checked = form.yetkiler.includes(y.key);
                                return (
                                    <label
                                        key={y.key}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            padding: '6px 8px',
                                            borderRadius: '3px',
                                            background: checked ? 'rgba(0,120,212,0.08)' : 'transparent',
                                            border: checked ? '1px solid rgba(0,120,212,0.2)' : '1px solid transparent',
                                            transition: 'all 150ms ease',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleYetki(y.key)}
                                            style={{ accentColor: '#0078d4' }}
                                        />
                                        {y.label}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input
                                type="checkbox"
                                checked={form.aktif}
                                onChange={e => setForm({ ...form, aktif: e.target.checked })}
                                style={{ accentColor: '#0078d4' }}
                            />
                            Kullanıcı aktif
                        </label>
                    </div>
                </Modal>
            )}
        </div>
    );
}
