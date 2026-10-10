import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Layers,
    ChevronRight,
    TrendingUp,
    CreditCard,
    AlertTriangle,
    Clock,
    FileText,
} from 'lucide-react';
import { DURUM_LABELS, DURUM_SIRALAMA, FIRMA_TIP_LABELS } from '../data/db';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import BarChart from '../components/ui/BarChart';
import DonutChart from '../components/ui/DonutChart';
import MetricTile from '../components/ui/MetricTile';

export default function Dashboard() {
    const { partiler, firmalar, urunler, cariHareketler, partiIlerlet, cariHareketEkle, getVadesiGelenFirmalar } = useApp();
    const navigate = useNavigate();

    const [ilerletParti, setIlerletParti] = useState(null);
    const [cikanAdet, setCikanAdet] = useState('');
    const [showOdemeModal, setShowOdemeModal] = useState(false);
    const [odemeFirmaId, setOdemeFirmaId] = useState('');
    const [odemeTutar, setOdemeTutar] = useState('');
    const [odemeAciklama, setOdemeAciklama] = useState('');

    const aktifPartiler = partiler.filter(p => p.durum !== 'tamamlandi');
    const toplamBorc = cariHareketler.filter(h => h.tip === 'borc').reduce((t, h) => t + (Number(h.tutar) || 0), 0);
    const toplamAlacak = cariHareketler.filter(h => h.tip === 'alacak').reduce((t, h) => t + (Number(h.tutar) || 0), 0);
    const bakiye = toplamBorc - toplamAlacak;

    const vadesiGelenler = getVadesiGelenFirmalar();

    // Durum dağılımı
    const durumDagilimi = useMemo(() => {
        return DURUM_SIRALAMA.map(d => ({
            label: DURUM_LABELS[d],
            value: partiler.filter(p => p.durum === d).length,
            color: `var(--status-${d}, var(--chart-bar))`,
        }));
    }, [partiler]);

    // Firma bazlı iş dağılımı
    const firmaDagilimi = useMemo(() => {
        const firmaMap = {};
        partiler.forEach(p => {
            [p.kesimhaneId, p.dikimhaneId, p.utupaketciId].forEach(fId => {
                if (fId) {
                    const f = firmalar.find(fr => fr.id === fId);
                    if (f) firmaMap[f.ad] = (firmaMap[f.ad] || 0) + 1;
                }
            });
        });
        return Object.entries(firmaMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([label, value]) => ({ label: label.substring(0, 8), value }));
    }, [partiler, firmalar]);

    // Son 7 gün üretim sayısı
    const haftalikUretim = useMemo(() => {
        const gunler = [];
        const gunAdlari = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toDateString();
            const adet = partiler.filter(p => {
                if (!p.updatedAt) return false;
                return new Date(p.updatedAt).toDateString() === dateStr && p.durum === 'tamamlandi';
            }).length;
            gunler.push({ label: gunAdlari[d.getDay()], value: adet });
        }
        return gunler;
    }, [partiler]);

    const QUICK_ACTIONS = [
        { label: 'Parti Oluştur', icon: Plus, onClick: () => navigate('/partiler', { state: { openNewModal: true } }) },
        { label: 'Parti Giriş', icon: Layers, onClick: () => navigate('/partiler') },
        { label: 'Hızlı Ödeme', icon: CreditCard, onClick: () => setShowOdemeModal(true) },
        { label: 'İrsaliyeler', icon: FileText, onClick: () => navigate('/irsaliyeler') },
    ];

    const handleHizliIlerlet = (parti) => {
        setIlerletParti(parti);
        setCikanAdet(parti.toplamAdet?.toString() || '');
    };

    const confirmIlerlet = () => {
        if (!ilerletParti) return;
        const adet = parseInt(cikanAdet, 10);
        if (isNaN(adet) || adet <= 0) return;
        partiIlerlet(ilerletParti.id, adet);
        setIlerletParti(null);
        setCikanAdet('');
    };

    const handleHizliOdeme = () => {
        if (!odemeFirmaId || !odemeTutar) return;
        cariHareketEkle({
            firmaId: odemeFirmaId,
            tip: 'alacak',
            tutar: parseFloat(odemeTutar),
            aciklama: odemeAciklama || 'Hızlı Ödeme',
            tarih: new Date().toISOString().split('T')[0],
        });
        setShowOdemeModal(false);
        setOdemeFirmaId('');
        setOdemeTutar('');
        setOdemeAciklama('');
    };

    return (
        <div className="animate-fade-in">
            {/* Hızlı Erişim — en üstte */}
            <div className="quick-actions-grid">
                {QUICK_ACTIONS.map((action, idx) => (
                    <button key={idx} type="button" className="quick-action-card" onClick={action.onClick}>
                        <span className="quick-action-icon">
                            <action.icon size={20} />
                        </span>
                        <span className="quick-action-label">{action.label}</span>
                    </button>
                ))}
            </div>

            {/* Aktif İş Listesi — hızlı erişimin hemen altında */}
            <div className="card mb-4">
                <div className="card-header">
                    <h3 className="card-title"><Layers size={18} /> Aktif İş Listesi</h3>
                    <span className="badge devam">{aktifPartiler.length} İş</span>
                </div>
                {aktifPartiler.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-muted text-sm">Şu an aktif bir iş bulunmuyor.</p>
                        <button className="btn btn-sm btn-ghost mt-2" onClick={() => navigate('/partiler', { state: { openNewModal: true } })}>
                            <Plus size={14} /> Yeni Parti Oluştur
                        </button>
                    </div>
                ) : (
                    <div className="mobile-list dashboard-active-list">
                        {aktifPartiler.slice(0, 8).map(p => {
                            const nextStepIndex = DURUM_SIRALAMA.indexOf(p.durum) + 1;
                            const nextStepLabel = DURUM_LABELS[DURUM_SIRALAMA[nextStepIndex]] || 'Bitti';

                            return (
                                <div key={p.id} className="mobile-list-item">
                                    <div onClick={() => navigate(`/parti/${p.id}`)} style={{ flex: 1, cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="mobile-list-item-title">{p.partiNo}</span>
                                            <span className={`badge ${p.durum}`}>{DURUM_LABELS[p.durum]}</span>
                                        </div>
                                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                                            {p.urunAdi} • {p.toplamAdet} Adet
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-sm btn-soft"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleHizliIlerlet(p);
                                        }}
                                    >
                                        {nextStepLabel} <ChevronRight size={14} />
                                    </button>
                                </div>
                            );
                        })}
                        {aktifPartiler.length > 8 && (
                            <button className="btn btn-ghost w-full text-xs py-2" onClick={() => navigate('/partiler')}>
                                Tümünü Gör ({aktifPartiler.length})
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Vade Uyarıları */}
            {vadesiGelenler.length > 0 && (
                <div className="card mb-4" style={{ borderColor: 'var(--color-danger-border)' }}>
                    <div className="card-header">
                        <h3 className="card-title" style={{ color: 'var(--accent-danger)' }}>
                            <AlertTriangle size={18} /> Ödeme Vade Uyarıları
                        </h3>
                    </div>
                    {vadesiGelenler.map((v, i) => (
                        <div
                            key={i}
                            className={`vade-uyari-card ${v.durum}`}
                            onClick={() => navigate(`/cari/${v.firma.id}`)}
                        >
                            <div>
                                <div style={{ fontWeight: 600 }}>{v.firma.ad}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    {v.durum === 'gecikti'
                                        ? `${Math.abs(v.fark)} gün gecikti!`
                                        : `${v.fark} gün kaldı (Ayın ${v.vadeGunu}'i)`
                                    }
                                </div>
                            </div>
                            <div style={{ fontWeight: 700, color: 'var(--accent-danger)' }}>
                                {v.bakiye.toLocaleString('tr-TR')} ₺
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Dashboard Charts Row */}
            <div className="dashboard-charts-row">
                {/* Parti Durum Dağılımı - Donut */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Üretim Durumu</h3>
                    </div>
                    <div className="donut-wrap">
                        <DonutChart segments={durumDagilimi.filter(d => d.value > 0)} size={128} strokeWidth={14} />
                        <div className="chart-legend">
                            {durumDagilimi.filter(d => d.value > 0).map((d, i) => (
                                <div key={i} className="chart-legend-item">
                                    <span className="chart-legend-swatch" style={{ background: d.color }} />
                                    <span>{d.label}</span>
                                    <strong>{d.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Haftalık Üretim */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Haftalık Tamamlanan</h3>
                        <span className="text-xs text-muted">Son 7 gün</span>
                    </div>
                    <BarChart data={haftalikUretim} height={150} highlight="last" />
                </div>

                {/* Firma İş Dağılımı */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Firma İş Dağılımı</h3>
                    </div>
                    {firmaDagilimi.length > 0 ? (
                        <BarChart data={firmaDagilimi} height={150} highlight="max" />
                    ) : (
                        <div className="text-center text-muted text-sm" style={{ padding: '20px' }}>Veri yok</div>
                    )}
                </div>
            </div>

            {/* Özet Bilgiler */}
            <div className="dashboard-summary-grid">
                <div
                    className="card card--interactive"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate('/cari-hesaplar')}
                    onKeyDown={e => { if (e.key === 'Enter') navigate('/cari-hesaplar'); }}
                >
                    <div className="card-header">
                        <h3 className="card-title"><TrendingUp size={18} /> Cari Durum Özeti</h3>
                        <ChevronRight size={18} className="text-muted" />
                    </div>
                    <div className="cari-ozet">
                        <MetricTile label="Borç" value={`${toplamBorc.toLocaleString('tr-TR')} ₺`} tone="danger" />
                        <MetricTile label="Ödenen" value={`${toplamAlacak.toLocaleString('tr-TR')} ₺`} tone="success" />
                        <MetricTile label="Bakiye" value={`${bakiye.toLocaleString('tr-TR')} ₺`} />
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Clock size={18} /> Hızlı İstatistikler</h3>
                    </div>
                    <div className="metric-grid">
                        <MetricTile label="Devam Eden" value={aktifPartiler.length} />
                        <MetricTile label="Ürün Çeşidi" value={urunler.length} />
                        <MetricTile label="Vade Uyarısı" value={vadesiGelenler.length} tone={vadesiGelenler.length > 0 ? 'danger' : undefined} />
                        <MetricTile label="Toplam Parti" value={partiler.length} />
                    </div>
                </div>
            </div>

            {/* Hızlı İlerlet Modalı */}
            {ilerletParti && (
                <Modal
                    title={`Hızlı İlerlet — ${ilerletParti.partiNo}`}
                    onClose={() => setIlerletParti(null)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setIlerletParti(null)}>İptal</button>
                            <button className="btn btn-primary" onClick={confirmIlerlet}>
                                Onayla ve İlerlet
                            </button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">Üretimden Çıkan Adet (Hedef: {ilerletParti.toplamAdet})</label>
                        <input
                            className="form-input"
                            type="number"
                            value={cikanAdet}
                            onChange={e => setCikanAdet(e.target.value)}
                            style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' }}
                            autoFocus
                        />
                        <div className="text-xs text-muted mt-2">
                            Bu işlem partiyi <strong>{DURUM_LABELS[ilerletParti.durum]}</strong> aşamasından bir sonraki aşamaya taşıyacak.
                        </div>
                    </div>
                </Modal>
            )}

            {/* Hızlı Ödeme Modalı */}
            {showOdemeModal && (
                <Modal
                    title="Hızlı Ödeme Girişi"
                    onClose={() => setShowOdemeModal(false)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setShowOdemeModal(false)}>İptal</button>
                            <button className="btn btn-success" onClick={handleHizliOdeme} disabled={!odemeFirmaId || !odemeTutar}>
                                <CreditCard size={16} /> Ödemeyi Kaydet
                            </button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">Firma *</label>
                        <SearchableSelect
                            value={odemeFirmaId}
                            onChange={setOdemeFirmaId}
                            options={firmalar.map(f => ({ value: f.id, label: f.ad, sub: FIRMA_TIP_LABELS[f.tip] }))}
                            placeholder="Firma seçin"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Ödeme Tutarı (₺) *</label>
                        <input
                            className="form-input"
                            type="number"
                            step="0.01"
                            value={odemeTutar}
                            onChange={e => setOdemeTutar(e.target.value)}
                            placeholder="0.00"
                            style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Açıklama</label>
                        <input
                            className="form-input"
                            value={odemeAciklama}
                            onChange={e => setOdemeAciklama(e.target.value)}
                            placeholder="Nakit Ödeme, Havale vb."
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
}
