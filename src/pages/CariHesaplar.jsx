import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { Wallet, Eye, CreditCard, Search, Power } from 'lucide-react';
import { FIRMA_TIP_LABELS } from '../data/db';
import { FIRMA_TIPLERI, firmaRozetSinifi, firmaAktifMi, firmaSecenekAdi } from '../utils/firma';

const TIP_FILTERS = [
    { value: 'all', label: 'Tümü', icon: Wallet },
    ...FIRMA_TIPLERI.map(t => ({ value: t.value, label: t.kisa, icon: t.ikon })),
];

export default function CariHesaplar() {
    const navigate = useNavigate();
    const { firmalar, getFirmaBakiye, cariHareketEkle } = useApp();
    const [tipFilter, setTipFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState({ firmaId: '', tutar: '', aciklama: '', tarih: new Date().toISOString().split('T')[0] });
    const [pasifleriGoster, setPasifleriGoster] = useState(false);

    const pasifFirmalar = firmalar.filter(f => !firmaAktifMi(f));
    const filtered = firmalar.filter(f => {
        if (tipFilter !== 'all' && f.tip !== tipFilter) return false;
        if (!pasifleriGoster && !firmaAktifMi(f)) return false;
        if (search.trim()) {
            return f.ad.toLowerCase().includes(search.toLowerCase());
        }
        return true;
    });

    const firmaWithBakiye = filtered.map(f => ({
        ...f,
        ...getFirmaBakiye(f.id),
    }));

    // Bakiyesi olan firmaları üste getir
    const sorted = [...firmaWithBakiye].sort((a, b) => b.bakiye - a.bakiye);

    const handleSavePayment = () => {
        if (!paymentForm.firmaId || !paymentForm.tutar || parseFloat(paymentForm.tutar) <= 0) {
            alert('Lütfen firma ve geçerli bir tutar seçin.');
            return;
        }

        cariHareketEkle({
            firmaId: paymentForm.firmaId,
            tip: 'alacak', // Ödeme her zaman firmadan alacak (bizim ödememiz) olarak kaydedilir
            tutar: parseFloat(paymentForm.tutar),
            aciklama: paymentForm.aciklama || 'Hızlı Ödeme',
            tarih: paymentForm.tarih,
        });

        setShowPaymentModal(false);
        setPaymentForm({ firmaId: '', tutar: '', aciklama: '', tarih: new Date().toISOString().split('T')[0] });
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cari Hesaplar</h1>
                    <span className="text-sm text-muted">{sorted.length} firma</span>
                </div>
                <button className="btn btn-primary" onClick={() => setShowPaymentModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={18} /> Hızlı Ödeme Yap
                </button>
            </div>

            {/* Arama */}
            <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    placeholder="Firma adı ara..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Tip Filtreler */}
            <div className="filter-row" style={{ marginBottom: '20px' }}>
                {TIP_FILTERS.map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.value}
                            className={`filter-btn ${tipFilter === t.value ? 'active' : ''}`}
                            onClick={() => setTipFilter(t.value)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Icon size={14} /> {t.label}
                        </button>
                    );
                })}
                {pasifFirmalar.length > 0 && (
                    <button
                        className={`filter-btn ${pasifleriGoster ? 'active' : ''}`}
                        onClick={() => setPasifleriGoster(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
                    >
                        <Power size={14} /> Pasifleri göster ({pasifFirmalar.length})
                    </button>
                )}
            </div>

            {/* Firma Listesi */}
            {sorted.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Wallet size={48} /></div>
                    <div className="empty-state-title">Firma bulunamadı</div>
                    <div className="empty-state-text">Bu kategoride firma bulunmuyor</div>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="desktop-only">
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Firma Adı</th>
                                        <th>Tip</th>
                                        <th>Yetkili</th>
                                        <th style={{ textAlign: 'right' }}>Bakiye</th>
                                        <th style={{ textAlign: 'center' }}>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(f => (
                                        <tr key={f.id} className={firmaAktifMi(f) ? '' : 'firma-pasif'} onClick={() => navigate(`/cari/${f.id}`)} style={{ cursor: 'pointer' }}>
                                            <td style={{ fontWeight: 600 }}>{f.ad}{!firmaAktifMi(f) && <span className="badge pasif" style={{ marginLeft: '8px' }}>Pasif</span>}</td>
                                            <td>
                                                <span className={`badge ${firmaRozetSinifi(f.tip)}`}>
                                                    {FIRMA_TIP_LABELS[f.tip]}
                                                </span>
                                            </td>
                                            <td className="text-muted">{f.yetkiliKisi || '-'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: f.bakiye > 0 ? 'var(--accent-danger)' : f.bakiye < 0 ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                                                {f.bakiye > 0 ? `${Number(f.bakiye).toLocaleString('tr-TR')} ₺` : f.bakiye < 0 ? `−${Math.abs(Number(f.bakiye)).toLocaleString('tr-TR')} ₺` : '0 ₺'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button className="btn btn-sm btn-soft" onClick={(e) => { e.stopPropagation(); navigate(`/cari/${f.id}`); }}>
                                                    <Eye size={14} /> Hesap Görüntüle
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="mobile-only">
                        <div className="mobile-list">
                            {sorted.map(f => (
                                <div key={f.id} className={`mobile-list-item ${firmaAktifMi(f) ? '' : 'firma-pasif'}`} onClick={() => navigate(`/cari/${f.id}`)} style={{ cursor: 'pointer' }}>
                                    <div className="mobile-list-item-header">
                                        <div>
                                            <span className="mobile-list-item-title">{f.ad}</span>
                                            {!firmaAktifMi(f) && <span className="badge pasif" style={{ marginLeft: '8px' }}>Pasif</span>}
                                            {f.yetkiliKisi && <div className="text-xs text-muted">{f.yetkiliKisi}</div>}
                                        </div>
                                        <span className={`badge ${firmaRozetSinifi(f.tip)}`}>
                                            {FIRMA_TIP_LABELS[f.tip]}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                        <div>
                                            <div className="text-xs text-muted">Bakiye</div>
                                            <div style={{
                                                fontSize: '1.1rem', fontWeight: 700,
                                                color: f.bakiye > 0 ? 'var(--accent-danger)' : f.bakiye < 0 ? 'var(--accent-success)' : 'var(--text-muted)'
                                            }}>
                                                {f.bakiye > 0 ? `${Number(f.bakiye).toLocaleString('tr-TR')} ₺` : f.bakiye < 0 ? `−${Math.abs(Number(f.bakiye)).toLocaleString('tr-TR')} ₺` : '0 ₺'}
                                            </div>
                                        </div>
                                        <button className="btn btn-sm btn-soft">
                                            <Eye size={14} /> Hesap Gör
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Hızlı Ödeme Modalı */}
            {showPaymentModal && (
                <Modal
                    title="Hızlı Ödeme Girişi"
                    onClose={() => setShowPaymentModal(false)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setShowPaymentModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleSavePayment}>Ödemeyi Kaydet</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">Firma Seçin *</label>
                        <SearchableSelect
                            value={paymentForm.firmaId}
                            onChange={val => setPaymentForm({ ...paymentForm, firmaId: val })}
                            options={[...firmalar]
                                .sort((a, b) => (firmaAktifMi(b) - firmaAktifMi(a)) || a.ad.localeCompare(b.ad, 'tr'))
                                .map(f => ({ value: f.id, label: firmaSecenekAdi(f), sub: FIRMA_TIP_LABELS[f.tip] }))}
                            placeholder="Firma seçiniz..."
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Tutar (₺) *</label>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="0.00"
                                value={paymentForm.tutar}
                                onChange={e => setPaymentForm({ ...paymentForm, tutar: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ödeme Tarihi</label>
                            <input
                                type="date"
                                className="form-input"
                                value={paymentForm.tarih}
                                onChange={e => setPaymentForm({ ...paymentForm, tarih: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Açıklama</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Hızlı Ödeme, Nakit, Banka vb."
                            value={paymentForm.aciklama}
                            onChange={e => setPaymentForm({ ...paymentForm, aciklama: e.target.value })}
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
}
