import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MapPin } from 'lucide-react';
import { DURUM_LABELS, FIRMA_TIP_LABELS } from '../data/db';

const KANBAN_COLUMNS = [
    { key: 'kesimde', label: 'Kesimde' },
    { key: 'dikimde', label: 'Dikimde' },
    { key: 'utupakette', label: 'Ütü/Paket' },
    { key: 'tamamlandi', label: 'Tamamlandı' },
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
                        <div key={col.key} className="kanban-column" data-durum={col.key}>
                            <div className="kanban-column-header">
                                <span>{col.label}</span>
                                <span className="kanban-column-count">{totalCount}</span>
                            </div>
                            <div className="kanban-column-body">
                                {items.length === 0 ? (
                                    <div className="kanban-empty">Parti yok</div>
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
                                                        <div className="kanban-card-info kanban-card-info--firma">
                                                            <MapPin size={14} /> <span className="truncate">{atananFirma.ad}</span>
                                                        </div>
                                                    )}
                                                    <div className="kanban-card-info">
                                                        {p.toplamAdet - (p.kalanAdet || 0)} / {p.toplamAdet} adet
                                                    </div>
                                                    <div className="progress-bar">
                                                        <div
                                                            className="progress-bar-fill"
                                                            style={{ width: `${ilerleme}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {col.key === 'tamamlandi' && totalCount > 15 && (
                                            <div className="kanban-more">
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
