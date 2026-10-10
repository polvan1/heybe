import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { ArrowLeft, CheckCircle, UserPlus, ChevronRight, Edit2, Printer, AlertTriangle, TrendingDown, DollarSign, History, Camera, X, Trash2 } from 'lucide-react';
import { DURUM_LABELS, DURUM_SIRALAMA, ADIM_FIRMA_TIP, FIRMA_TIP_LABELS, getPartiById, firmaFiyatBul } from '../data/db';
import { fotoYukle, fotoSil, fotoSrc } from '../utils/foto';
import { silmeOnayi } from '../utils/guvenlik';

export default function PartiDetay() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { firmalar, urunler, partiGuncelle, partiIlerlet, partiSil, partiler } = useApp();

    const parti = partiler.find(p => p.id === id);

    const [showEditModal, setShowEditModal] = useState(false);
    const [showIlerletModal, setShowIlerletModal] = useState(false);
    const [ilerletCikanAdet, setIlerletCikanAdet] = useState('');
    const [editUtupaketciId, setEditUtupaketciId] = useState('');
    const [fotoBusy, setFotoBusy] = useState(false);
    const [buyukFoto, setBuyukFoto] = useState(null);

    if (!parti) {
        return (
            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <h2>Parti bulunamadı</h2>
                <button className="btn btn-primary" onClick={() => navigate('/partiler')} style={{ marginTop: '16px' }}>
                    <ArrowLeft size={16} /> Partilere Dön
                </button>
            </div>
        );
    }

    const currentStep = DURUM_SIRALAMA.indexOf(parti.durum);
    const kesimhane = firmalar.find(f => f.id === parti.kesimhaneId);
    const dikimhane = firmalar.find(f => f.id === parti.dikimhaneId);
    const utupaketci = firmalar.find(f => f.id === parti.utupaketciId);

    const currentTip = ADIM_FIRMA_TIP[parti.durum];

    // Fire hesaplama
    const teslimatlar = parti.teslimatGecmisi || [];
    const toplamFire = teslimatlar.reduce((total, d) => total + (d.fire || 0), 0);
    const toplamGiren = parti.toplamAdet || 0;
    const toplamCikan = Math.max(0, toplamGiren - toplamFire);
    const fireOrani = toplamGiren > 0 ? ((toplamFire / toplamGiren) * 100).toFixed(1) : '0.0';

    // Maliyet hesaplama
    const kesimMaliyet = (parti.sonCikanAdet || parti.toplamAdet || 0) * (parti.kesimBirimFiyat || 0);
    const dikimMaliyet = (parti.sonCikanAdet || parti.toplamAdet || 0) * (parti.dikimBirimFiyat || 0);
    const utuMaliyet = (parti.sonCikanAdet || parti.toplamAdet || 0) * (parti.utuBirimFiyat || 0);
    const toplamMaliyet = kesimMaliyet + dikimMaliyet + utuMaliyet;
    const adetBasiMaliyet = parti.toplamAdet > 0 ? (toplamMaliyet / parti.toplamAdet).toFixed(2) : '0.00';



    const handleEditFirmalar = () => {
        setEditUtupaketciId(parti.utupaketciId || '');
        setShowEditModal(true);
    };

    const handleSaveEditFirmalar = () => {
        // Firma değişince ütü fiyatını da yeni firmanın anlaşmasına göre güncelle
        const urun = urunler.find(u => u.id === parti.urunId);
        partiGuncelle(parti.id, {
            utupaketciId: editUtupaketciId || null,
            utuBirimFiyat: editUtupaketciId && urun ? firmaFiyatBul(urun, editUtupaketciId, 'utu') : (parti.utuBirimFiyat || 0),
        });
        setShowEditModal(false);
    };

    const utupaketciler = firmalar.filter(f => f.tip === 'utupaketci');

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <button className="btn btn-ghost" onClick={() => navigate('/partiler')}>
                    <ArrowLeft size={18} /> Geri
                </button>
                <h1 className="page-title">{parti.partiNo} — {parti.urunKodu}</h1>
            </div>

            {/* Parti Bilgisi */}
            <div className="card mb-4">
                <div className="card-header">
                    <h3 className="card-title">Parti Bilgisi</h3>
                    <span className={`badge ${parti.durum}`}>{DURUM_LABELS[parti.durum]}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Ürün:</span> {parti.urunAdi}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Toplam:</span> {parti.toplamAdet?.toLocaleString('tr-TR')} adet</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Kesimhane:</span> {kesimhane?.ad || '-'}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Dikimhane:</span> {dikimhane?.ad || '-'}</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Ütü/Paket:</span> {utupaketci?.ad || '-'}</div>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={handleEditFirmalar} style={{ marginTop: '12px' }}>
                    <Edit2 size={14} /> Ütü/Paket Değiştir
                </button>
            </div>

            {/* Fire Kartı */}
            {teslimatlar.length > 0 && (
                <div className="card mb-4" style={{ borderColor: parseFloat(fireOrani) > 5 ? 'var(--accent-danger)' : 'var(--accent-success)', borderWidth: '1px' }}>
                    <div className="card-header">
                        <h3 className="card-title">
                            {parseFloat(fireOrani) > 5 ? <AlertTriangle size={16} style={{ color: 'var(--accent-danger)' }} /> : <TrendingDown size={16} style={{ color: 'var(--accent-success)' }} />}
                            {' '}Fire / Eksik Takibi
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', textAlign: 'center' }}>
                        <div style={{ padding: '12px', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                            <div className="text-xs text-muted">Giren</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{toplamGiren.toLocaleString('tr-TR')}</div>
                        </div>
                        <div style={{ padding: '12px', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                            <div className="text-xs text-muted">Çıkan</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{toplamCikan.toLocaleString('tr-TR')}</div>
                        </div>
                        <div style={{ padding: '12px', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                            <div className="text-xs text-muted">Fire</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: toplamFire > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>{toplamFire}</div>
                        </div>
                        <div style={{ padding: '12px', background: parseFloat(fireOrani) > 5 ? 'var(--color-danger-soft)' : 'var(--color-success-soft)', borderRadius: 'var(--radius-sm)' }}>
                            <div className="text-xs text-muted">Oran</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: parseFloat(fireOrani) > 5 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>%{fireOrani}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Maliyet Özeti */}
            {toplamMaliyet > 0 && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title"><DollarSign size={16} /> Maliyet Özeti</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                        {kesimMaliyet > 0 && (
                            <div style={{ padding: '10px', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Kesim</div>
                                <div style={{ fontWeight: 600 }}>{kesimMaliyet.toLocaleString('tr-TR')} ₺</div>
                            </div>
                        )}
                        {dikimMaliyet > 0 && (
                            <div style={{ padding: '10px', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Dikim</div>
                                <div style={{ fontWeight: 600 }}>{dikimMaliyet.toLocaleString('tr-TR')} ₺</div>
                            </div>
                        )}
                        {utuMaliyet > 0 && (
                            <div style={{ padding: '10px', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Ütü/Paket</div>
                                <div style={{ fontWeight: 600 }}>{utuMaliyet.toLocaleString('tr-TR')} ₺</div>
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-sm" style={{ fontWeight: 600 }}>Toplam Maliyet</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{toplamMaliyet.toLocaleString('tr-TR')} ₺</span>
                    </div>
                    <div className="text-xs text-muted" style={{ marginTop: '6px', textAlign: 'right' }}>Adet başı: {adetBasiMaliyet} ₺</div>
                </div>
            )}

            {/* Renk Tablosu */}
            {parti.renkler && parti.renkler.length > 0 && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title">Renk / Beden Dağılımı</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>Renk</th>
                                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid var(--border-color)' }}>Kat</th>
                                    {parti.asorti?.bedenler?.map(b => (
                                        <th key={b} style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid var(--border-color)' }}>{b}</th>
                                    ))}
                                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid var(--border-color)', fontWeight: 700 }}>Toplam</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parti.renkler.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ padding: '8px', fontWeight: 600 }}>{r.renk}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>{r.katSayisi}</td>
                                        {parti.asorti?.bedenler?.map(b => (
                                            <td key={b} style={{ padding: '8px', textAlign: 'center' }}>{r.bedenAdetleri?.[b] || 0}</td>
                                        ))}
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>{r.toplam}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Üretim Akışı Timeline */}
            <div className="card mb-4">
                <div className="card-header">
                    <h3 className="card-title">Üretim Akışı</h3>
                    {parti.durum !== 'tamamlandi' && (
                        <button className="btn btn-sm btn-primary" onClick={() => {
                            setIlerletCikanAdet(parti.toplamAdet?.toString() || '');
                            setShowIlerletModal(true);
                        }}>
                            İlerlet <ChevronRight size={14} />
                        </button>
                    )}
                </div>
                <div className="timeline">
                    {DURUM_SIRALAMA.map((durum, index) => {
                        const isPast = index < currentStep;
                        const isCurrent = index === currentStep;
                        
                        let assignedFirma = null;
                        if (durum === 'kesimde') assignedFirma = kesimhane;
                        else if (durum === 'dikimde') assignedFirma = dikimhane;
                        else if (durum === 'utupakette') assignedFirma = utupaketci;

                        return (
                            <div key={durum} className={`timeline-step ${isPast ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                                <div className="timeline-dot" />
                                <div className="timeline-content">
                                    <div className="timeline-label">{DURUM_LABELS[durum]}</div>
                                    {assignedFirma && (
                                        <div style={{ marginTop: '4px', fontSize: '0.8rem', color: isPast ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                                            {isPast ? <CheckCircle size={12} style={{ display: 'inline', marginRight: '4px' }} /> : null}
                                            {assignedFirma.ad}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Teslimat Geçmişi */}
            {teslimatlar.length > 0 && (
                <div className="card mb-4">
                    <div className="card-header">
                        <h3 className="card-title"><History size={16} /> Teslimat Geçmişi</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>Tarih</th>
                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>Firma / Adım</th>
                                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid var(--border-color)' }}>Giren</th>
                                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid var(--border-color)' }}>Çıkan</th>
                                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid var(--border-color)' }}>Fire</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teslimatlar.map((t, i) => (
                                    <tr key={t.id || i}>
                                        <td style={{ padding: '8px' }}>{new Date(t.tarih).toLocaleDateString('tr-TR')}</td>
                                        <td style={{ padding: '8px' }}>{t.firmaAdi || t.adim}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>{(t.girenAdet || 0).toLocaleString('tr-TR')}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>{(t.cikanAdet || 0).toLocaleString('tr-TR')}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: t.fire > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                                            {t.fire || 0}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}



            {/* Fotoğraflar */}
            <div className="card mb-4">
                <div className="card-header">
                    <h3 className="card-title"><Camera size={16} /> Fotoğraflar ({(parti.fotolar || []).length})</h3>
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                        <Camera size={14} /> {fotoBusy ? 'Yükleniyor...' : 'Fotoğraf Ekle'}
                        <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            disabled={fotoBusy}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file) return;
                                setFotoBusy(true);
                                try {
                                    const url = await fotoYukle(file);
                                    partiGuncelle(parti.id, { fotolar: [...(parti.fotolar || []), { id: Date.now().toString(36), url, tarih: new Date().toISOString() }] });
                                } catch (err) {
                                    alert('Fotoğraf yüklenemedi: ' + err.message);
                                } finally {
                                    setFotoBusy(false);
                                }
                            }}
                        />
                    </label>
                </div>
                {(parti.fotolar || []).length === 0 ? (
                    <div className="text-center text-muted" style={{ padding: '20px', fontSize: '0.82rem' }}>
                        Henüz fotoğraf eklenmemiş. Numune, kalite kontrol veya sevkiyat fotoğrafı ekleyebilirsiniz.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px' }}>
                        {(parti.fotolar || []).map(f => (
                            <div key={f.id} style={{ position: 'relative' }}>
                                <img
                                    src={fotoSrc(f.url)}
                                    alt=""
                                    onClick={() => setBuyukFoto(f)}
                                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                                />
                                <button
                                    onClick={() => {
                                        if (!confirm('Bu fotoğrafı silmek istiyor musunuz?')) return;
                                        fotoSil(f.url);
                                        partiGuncelle(parti.id, { fotolar: (parti.fotolar || []).filter(x => x.id !== f.id) });
                                    }}
                                    style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Sil"
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Büyük fotoğraf görüntüleme */}
            {buyukFoto && (
                <div
                    onClick={() => setBuyukFoto(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'zoom-out' }}
                >
                    <img src={fotoSrc(buyukFoto.url)} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 'var(--radius-sm)' }} />
                </div>
            )}

            {/* Tehlikeli işlem: parti silme — yalnızca burada ve güvenlik şifresiyle */}
            <div className="card mb-4" style={{ borderColor: 'var(--color-danger-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-danger)' }}>Partiyi Sil</div>
                        <div className="text-xs text-muted">Parti, bağlı cari hareketler, iş akışı ve irsaliyelerle birlikte kalıcı olarak silinir.</div>
                    </div>
                    <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                            if (!silmeOnayi(`${parti.partiNo} — ${parti.urunAdi} partisi silinecek.`)) return;
                            partiSil(parti.id);
                            navigate('/partiler');
                        }}
                    >
                        <Trash2 size={15} /> Partiyi Sil
                    </button>
                </div>
            </div>

            {/* Ütü Düzenle Modal */}
            {showEditModal && (
                <Modal
                    title="Ütü/Paket Firmasını Düzenle"
                    onClose={() => setShowEditModal(false)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleSaveEditFirmalar}>Kaydet</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">Ütü/Paket</label>
                        <SearchableSelect
                            value={editUtupaketciId}
                            onChange={setEditUtupaketciId}
                            options={utupaketciler.map(f => ({ value: f.id, label: f.ad }))}
                            placeholder="Yok"
                            clearLabel="Yok"
                        />
                    </div>
                </Modal>
            )}

            {/* İlerlet Modal */}
            {showIlerletModal && (
                <Modal
                    title={`İlerlet — ${DURUM_LABELS[parti.durum]} → ${DURUM_LABELS[DURUM_SIRALAMA[DURUM_SIRALAMA.indexOf(parti.durum) + 1]] || '?'}`}
                    onClose={() => setShowIlerletModal(false)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setShowIlerletModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={() => {
                                const adet = parseInt(ilerletCikanAdet, 10);
                                if (!adet || adet <= 0) return;
                                partiIlerlet(parti.id, adet);
                                setShowIlerletModal(false);
                            }}>
                                <ChevronRight size={16} /> İlerlet
                            </button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">Çıkan Adet *</label>
                        <input
                            className="form-input"
                            type="number"
                            value={ilerletCikanAdet}
                            onChange={e => setIlerletCikanAdet(e.target.value)}
                            placeholder="Üretimden çıkan adet"
                            style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}
                        />
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                            Parti toplam: {parti.toplamAdet?.toLocaleString('tr-TR')} adet
                        </div>
                    </div>

                    <div style={{ marginTop: '12px', padding: '12px 16px', background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-primary-border)', fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--accent-primary)' }}>Bu adet ile borç düşecek firmalar:</div>
                        {parti.kesimhaneId && parti.kesimBirimFiyat > 0 && (
                            <div>Kesim: {parseInt(ilerletCikanAdet || 0)} × {parti.kesimBirimFiyat} ₺ = <strong>{(parseInt(ilerletCikanAdet || 0) * parti.kesimBirimFiyat).toLocaleString('tr-TR')} ₺</strong></div>
                        )}
                        {parti.dikimhaneId && parti.dikimBirimFiyat > 0 && (
                            <div>Dikim: {parseInt(ilerletCikanAdet || 0)} × {parti.dikimBirimFiyat} ₺ = <strong>{(parseInt(ilerletCikanAdet || 0) * parti.dikimBirimFiyat).toLocaleString('tr-TR')} ₺</strong></div>
                        )}
                        {parti.utupaketciId && parti.utuBirimFiyat > 0 && (
                            <div>Ütü/Paket: {parseInt(ilerletCikanAdet || 0)} × {parti.utuBirimFiyat} ₺ = <strong>{(parseInt(ilerletCikanAdet || 0) * parti.utuBirimFiyat).toLocaleString('tr-TR')} ₺</strong></div>
                        )}
                        {(!parti.kesimBirimFiyat && !parti.dikimBirimFiyat && !parti.utuBirimFiyat) && (
                            <div className="text-muted">Birim fiyat girilmemiş, borç yazılmayacak</div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
}
