import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { DURUM_LABELS } from '../data/db';
import { ClipboardList, Send, CheckCircle, Package, AlertCircle } from 'lucide-react';

// Fasoncu paneli: kullanıcının bağlı olduğu firmanın üzerindeki aktif işler.
// Fasoncu "Teslim Bildir" der → yöneticiye bildirim + push düşer,
// yönetici partiyi ilerleterek teslimi onaylar.
export default function Islerim() {
    const { currentUser, partiler, fasoncuTeslimBildir } = useApp();
    const [teslimModal, setTeslimModal] = useState(null); // parti
    const [cikanAdet, setCikanAdet] = useState('');
    const [notu, setNotu] = useState('');
    const [gonderildi, setGonderildi] = useState({}); // partiId -> true (bu oturumda)

    const firmaId = currentUser?.firmaId;

    if (!firmaId) {
        return (
            <div className="card" style={{ margin: '40px auto', maxWidth: '440px', textAlign: 'center', padding: '32px' }}>
                <AlertCircle size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <h3 style={{ marginBottom: '8px' }}>Hesabınıza firma bağlanmamış</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    İşlerinizi görebilmek için yöneticinizin, Kullanıcılar sayfasından hesabınıza
                    bir fason firma ataması gerekiyor.
                </p>
            </div>
        );
    }

    // Bu firmanın üzerinde bekleyen işler: partinin aktif adımı bu firmadaysa
    const aktifIsler = partiler.filter(p =>
        (p.durum === 'kesimde' && p.kesimhaneId === firmaId) ||
        (p.durum === 'dikimde' && p.dikimhaneId === firmaId) ||
        (p.durum === 'utupakette' && p.utupaketciId === firmaId)
    );

    // Geçmiş: teslimat geçmişinde bu firmanın yaptığı çıkışlar
    const gecmisTeslimler = partiler
        .flatMap(p => (p.teslimatGecmisi || [])
            .filter(t => t.firmaId === firmaId)
            .map(t => ({ ...t, partiNo: p.partiNo, urunAdi: p.urunAdi })))
        .sort((a, b) => new Date(b.tarih) - new Date(a.tarih))
        .slice(0, 20);

    const openTeslim = (parti) => {
        setCikanAdet(String(parti.toplamAdet || ''));
        setNotu('');
        setTeslimModal(parti);
    };

    const handleTeslimBildir = () => {
        const adet = parseInt(cikanAdet, 10);
        if (!adet || adet <= 0) return;
        fasoncuTeslimBildir(teslimModal.id, adet, notu.trim());
        setGonderildi(prev => ({ ...prev, [teslimModal.id]: true }));
        setTeslimModal(null);
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ClipboardList size={22} /> İşlerim
                </h1>
            </div>

            {/* Aktif İşler */}
            <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-header">
                    <h3 className="card-title"><Package size={17} /> Üzerimdeki İşler ({aktifIsler.length})</h3>
                </div>
                {aktifIsler.length === 0 ? (
                    <div className="p-8 text-center text-muted">Şu an üzerinizde bekleyen iş yok.</div>
                ) : (
                    <div className="mobile-list">
                        {aktifIsler.map(p => (
                            <div key={p.id} className="mobile-list-item">
                                <div className="mobile-list-item-header">
                                    <span className="mobile-list-item-title">{p.partiNo}</span>
                                    <span className={`badge ${p.durum}`}>{DURUM_LABELS[p.durum]}</span>
                                </div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '4px' }}>
                                    {p.urunKodu} — {p.urunAdi}
                                </div>
                                <div className="text-xs text-muted" style={{ marginBottom: '10px' }}>
                                    {(p.toplamAdet || 0).toLocaleString('tr-TR')} adet
                                    &nbsp;•&nbsp; Giriş: {new Date(p.updatedAt || p.createdAt).toLocaleDateString('tr-TR')}
                                </div>
                                {gonderildi[p.id] ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--color-success)', fontWeight: 600 }}>
                                        <CheckCircle size={15} /> Teslim bildirildi — yönetici onayı bekleniyor
                                    </div>
                                ) : (
                                    <button className="btn btn-sm btn-soft" style={{ width: '100%', justifyContent: 'center' }} onClick={() => openTeslim(p)}>
                                        <Send size={14} /> Teslim Bildir
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Geçmiş Teslimler */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><CheckCircle size={17} /> Geçmiş Teslimlerim</h3>
                </div>
                {gecmisTeslimler.length === 0 ? (
                    <div className="p-8 text-center text-muted">Henüz teslim kaydınız yok.</div>
                ) : (
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Parti</th>
                                    <th style={{ textAlign: 'right' }}>Giren</th>
                                    <th style={{ textAlign: 'right' }}>Çıkan</th>
                                    <th style={{ textAlign: 'right' }}>Fire</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gecmisTeslimler.map(t => (
                                    <tr key={t.id}>
                                        <td className="text-xs">{new Date(t.tarih).toLocaleDateString('tr-TR')}</td>
                                        <td>
                                            <div className="font-semibold text-sm">{t.partiNo}</div>
                                            <div className="text-xs text-muted">{t.urunAdi}</div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{t.girenAdet}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{t.cikanAdet}</td>
                                        <td style={{ textAlign: 'right', color: (t.fire || 0) > 0 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                                            {t.fire || 0}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Teslim Bildir Modalı */}
            {teslimModal && (
                <Modal
                    title={`Teslim Bildir — ${teslimModal.partiNo}`}
                    onClose={() => setTeslimModal(null)}
                    footer={<>
                        <button className="btn btn-ghost" onClick={() => setTeslimModal(null)}>İptal</button>
                        <button className="btn btn-primary" onClick={handleTeslimBildir} disabled={!parseInt(cikanAdet, 10)}>
                            <Send size={15} /> Bildir
                        </button>
                    </>}
                >
                    <div style={{ padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                        <div style={{ fontWeight: 600 }}>{teslimModal.urunKodu} — {teslimModal.urunAdi}</div>
                        <div className="text-xs text-muted">Giriş: {(teslimModal.toplamAdet || 0).toLocaleString('tr-TR')} adet</div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Çıkan Adet *</label>
                        <input className="form-input" type="number" inputMode="numeric" value={cikanAdet} onChange={e => setCikanAdet(e.target.value)} placeholder="Örn: 480" />
                        {parseInt(cikanAdet, 10) > 0 && (teslimModal.toplamAdet || 0) > 0 && (
                            <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                                Fire: {Math.max(0, (teslimModal.toplamAdet || 0) - parseInt(cikanAdet, 10))} adet
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">Not (isteğe bağlı)</label>
                        <textarea className="form-input" rows={2} value={notu} onChange={e => setNotu(e.target.value)} placeholder="Örn: 20 adet kumaş hatası" />
                    </div>
                    <div className="text-xs text-muted">
                        Bildiriminiz yöneticiye anında iletilir; teslim, yönetici onayıyla kesinleşir.
                    </div>
                </Modal>
            )}
        </div>
    );
}
