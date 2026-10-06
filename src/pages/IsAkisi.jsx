import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { DURUM_LABELS, FIRMA_TIP_LABELS } from '../data/db';

const KANBAN_COLUMNS = [
    { key: 'kesimde', label: 'Kesimde', color: '#0ea5e9' },
    { key: 'dikimde', label: 'Dikimde', color: '#fbbf24' },
    { key: 'utupakette', label: 'Ütü/Paket', color: '#f472b6' },
    { key: 'tamamlandi', label: 'Tamamlandı', color: '#34d399' },
];

export default function IsAkisi() {
    const { partiler, firmalar } = useApp();
    const navigate = useNavigate();

    const getPartilerByDurum = (durum) => partiler.filter(p => p.durum === durum);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">İş Akışı</h1>
                <span className="text-sm text-muted">{partiler.filter(p => p.durum !== 'tamamlandi' && p.durum !== 'beklemede').length} aktif iş</span>
            </div>

            <div className="kanban-container">
                {KANBAN_COLUMNS.map(col => {
                    let items = getPartilerByDurum(col.key);
                    const totalCount = items.length;
                    
                    // Tamamlanan partileri tarihe göre sırala ve son 15'i göster
                    if (col.key === 'tamamlandi') {
                        items = items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 15);
                    } else {
                        items = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    }

                    return (
                        <div key={col.key} className="kanban-column">
                            <div className="kanban-column-header" style={{ borderLeft: `3px solid ${col.color}` }}>
                                <span>{col.label}</span>
                                <span className="kanban-column-count">{totalCount}</span>
                            </div>
                            <div className="kanban-column-body">
                                {items.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        Parti yok
                                    </div>
                                ) : (
                                    <>
                                        {items.map(p => {
                                            const ilerleme = p.toplamAdet > 0
                                                ? Math.round(((p.toplamAdet - (p.kalanAdet || 0)) / p.toplamAdet) * 100)
                                                : 0;
                                            const aktifAtamalar = p.firmaAtamalari?.filter(a => !a.tamamlandi) || [];
                                            const atananFirma = aktifAtamalar[0] ? firmalar.find(f => f.id === aktifAtamalar[0].firmaId) : null;

                                            return (
                                                <div
                                                    key={p.id}
                                                    className="kanban-card"
                                                    onClick={() => navigate(`/parti/${p.id}`)}
                                                >
                                                    <div className="kanban-card-title">{p.partiNo}</div>
                                                    <div className="kanban-card-info">{p.urunAdi}</div>
                                                    {atananFirma && (
                                                        <div className="kanban-card-info" style={{ color: 'var(--accent-info)' }}>
                                                            📍 {atananFirma.ad}
                                                        </div>
                                                    )}
                                                    <div className="kanban-card-info">
                                                        {p.toplamAdet - (p.kalanAdet || 0)} / {p.toplamAdet} adet
                                                    </div>
                                                    <div className="progress-bar">
                                                        <div
                                                            className={`progress-bar-fill ${col.key === 'tamamlandi' ? 'green' : ''}`}
                                                            style={{ width: `${ilerleme}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {col.key === 'tamamlandi' && totalCount > 15 && (
                                            <div style={{ 
                                                textAlign: 'center', 
                                                fontSize: '0.75rem', 
                                                color: 'var(--text-muted)', 
                                                padding: '12px 4px',
                                                borderTop: '1px dashed var(--border-color)',
                                                marginTop: '8px'
                                            }}>
                                                Son 15 parti gösteriliyor. Diğerleri <b>Partiler</b> sayfasındadır.
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
