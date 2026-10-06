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

// Mini CSS bar chart component
function MiniBarChart({ data, maxValue, color }) {
    const max = maxValue || Math.max(...data.map(d => d.value), 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px' }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div
                        style={{
                            width: '100%',
                            maxWidth: '32px',
                            height: `${Math.max((d.value / max) * 70, 2)}px`,
                            background: d.color || color || '#0078d4',
                            borderRadius: '2px 2px 0 0',
                            transition: 'height 300ms ease',
                        }}
                        title={`${d.label}: ${d.value}`}
                    />
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.label}</span>
                </div>
            ))}
        </div>
    );
}

// Donut chart component
function DonutChart({ segments, size = 120, strokeWidth = 16 }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    let offset = 0;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#edebe9" strokeWidth={strokeWidth} />
            {segments.map((seg, i) => {
                const pct = total > 0 ? seg.value / total : 0;
                const dashLength = pct * circumference;
                const currentOffset = offset;
                offset += dashLength;
                return (
                    <circle
                        key={i}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                        strokeDashoffset={-currentOffset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        style={{ transition: 'stroke-dasharray 500ms ease' }}
                    />
                );
            })}
            <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--text-primary)">{total}</text>
            <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fontSize="9" fill="var(--text-muted)">TOPLAM</text>
        </svg>
    );
}

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
        const durumColors = {
            beklemede: '#a19f9d',
            kesimde: '#0078d4',
            baskida: '#5c2d91',
            dikimde: '#d83b01',
            utupakette: '#a4262c',
            tamamlandi: '#107c10',
        };
        return DURUM_SIRALAMA.map(d => ({
            label: DURUM_LABELS[d],
            value: partiler.filter(p => p.durum === d).length,
            color: durumColors[d] || '#0078d4',
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
            gunler.push({ label: gunAdlari[d.getDay()], value: adet, color: '#107c10' });
        }
        return gunler;
    }, [partiler]);

    const QUICK_ACTIONS = [
        { label: 'Parti Oluştur', icon: Plus, color: '#0078d4', onClick: () => navigate('/partiler', { state: { openNewModal: true } }) },
        { label: 'Parti Giriş', icon: Layers, color: '#5c2d91', onClick: () => navigate('/partiler') },
        { label: 'Hızlı Ödeme', icon: CreditCard, color: '#107c10', onClick: () => setShowOdemeModal(true) },
        { label: 'İrsaliyeler', icon: FileText, color: '#d83b01', onClick: () => navigate('/irsaliyeler') },
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
                    <div key={idx} className="quick-action-card" onClick={action.onClick}>
                        <div className="quick-action-icon" style={{ backgroundColor: action.color }}>
                            <action.icon size={22} />
                        </div>
                        <div className="quick-action-label">{action.label}</div>
                    </div>
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
                                        className="btn btn-sm btn-primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleHizliIlerlet(p);
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '6px 10px' }}
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
                <div className="card mb-4" style={{ borderColor: 'var(--accent-danger)', borderWidth: '1px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '8px 0' }}>
                        <DonutChart segments={durumDagilimi.filter(d => d.value > 0)} size={130} strokeWidth={18} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {durumDagilimi.filter(d => d.value > 0).map((d, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color, flexShrink: 0 }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                                    <span style={{ fontWeight: 700, marginLeft: 'auto' }}>{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Haftalık Üretim */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Haftalık Tamamlanan</h3>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                        <MiniBarChart data={haftalikUretim} color="#107c10" />
                    </div>
                </div>

                {/* Firma İş Dağılımı */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Firma İş Dağılımı</h3>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                        {firmaDagilimi.length > 0 ? (
                            <MiniBarChart data={firmaDagilimi} color="#0078d4" />
                        ) : (
                            <div className="text-center text-muted text-sm" style={{ padding: '20px' }}>Veri yok</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Özet Bilgiler */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    <div className="card" onClick={() => navigate('/cari-hesaplar')} style={{ cursor: 'pointer' }}>
                        <div className="card-header">
                            <h3 className="card-title"><TrendingUp size={18} /> Cari Durum Özeti</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', padding: '8px 0' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div className="text-xs text-muted">Borç</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-danger)' }}>{toplamBorc.toLocaleString('tr-TR')} ₺</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div className="text-xs text-muted">Ödenen</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-success)' }}>{toplamAlacak.toLocaleString('tr-TR')} ₺</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div className="text-xs text-muted">Bakiye</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{bakiye.toLocaleString('tr-TR')} ₺</div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title"><Clock size={18} /> Hızlı İstatistikler</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Devam Eden</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{aktifPartiler.length}</div>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Ürün Çeşidi</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{urunler.length}</div>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Vade Uyarısı</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: vadesiGelenler.length > 0 ? 'var(--accent-danger)' : 'inherit' }}>{vadesiGelenler.length}</div>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Toplam Parti</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{partiler.length}</div>
                            </div>
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
                            style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'center' }}
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
