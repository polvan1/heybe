import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import Notice from '../components/ui/Notice';
import SearchableSelect from '../components/SearchableSelect';
import { Plus, FileText, Trash2, Search, Download, Printer, Check, X, Truck, Eye, ArrowRight, MessageCircle, Share2, ScanLine, FileDown, Loader2, Image as ImageIcon } from 'lucide-react';
import { IRSALIYE_DURUM_LABELS, IRSALIYE_TIP_LABELS, DURUM_LABELS, exportToCSV } from '../data/db';
import { yazdirIrsaliye } from '../utils/irsaliyePrint';
import { whatsappAc, irsaliyeMetni } from '../utils/whatsapp';
import { irsaliyePdfPaylas } from '../utils/irsaliyePdf';
import { silmeOnayi } from '../utils/guvenlik';
import { yazdirBosSevkSablonu } from '../utils/irsaliyeSablonu';
import { fotoSrc } from '../utils/foto';
import SevkIrsaliyeOkuma, { sevkIrsaliyesiOkut, okumaBaglami } from '../components/SevkIrsaliyeOkuma';

const DURUM_FILTERS = [
    { value: 'all', label: 'Tümü' },
    { value: 'taslak', label: 'Taslak' },
    { value: 'onaylandi', label: 'Onaylandı' },
    { value: 'teslim_edildi', label: 'Teslim Edildi' },
    { value: 'iptal', label: 'İptal' },
];

export default function Irsaliyeler() {
    const {
        irsaliyeler, partiler, firmalar, urunler,
        irsaliyeEkle, irsaliyeSil, irsaliyeOnayla, irsaliyeTeslimEt, irsaliyeIptal, currentUser
    } = useApp();
    // Kesimhane yetkilisi: irsaliyeleri taslak olarak düzenler; onay/teslim yöneticidedir
    const kesimhaneKullanici = currentUser?.rol === 'kesimhane';
    const onaylayabilir = !kesimhaneKullanici;

    // ---- Boş A5 şablon + okutma ----
    const kameraRef = useRef(null);
    const [sablonModal, setSablonModal] = useState(false);
    const [sablon, setSablon] = useState({ kesimhaneId: '', atolyeId: '', kopya: 1 });
    const [okumaBusy, setOkumaBusy] = useState(false);
    const [okumaSonucu, setOkumaSonucu] = useState(null);
    const [bilgi, setBilgi] = useState('');

    const sablonAc = () => {
        setSablon({ kesimhaneId: kesimhaneKullanici ? (currentUser.firmaId || '') : '', atolyeId: '', kopya: 1 });
        setSablonModal(true);
    };
    const sablonYazdir = () => {
        yazdirBosSevkSablonu({
            kesimhaneAdi: firmalar.find(f => f.id === sablon.kesimhaneId)?.ad || '',
            atolyeAdi: firmalar.find(f => f.id === sablon.atolyeId)?.ad || '',
            kopya: sablon.kopya,
        });
        setSablonModal(false);
    };
    const handleOkutDosya = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setOkumaBusy(true);
        setBilgi('');
        try {
            setOkumaSonucu(await sevkIrsaliyesiOkut(file, okumaBaglami({ urunler, firmalar, partiler })));
        } catch (err) {
            alert(err.anahtarYok ? err.message : 'Okuma başarısız: ' + err.message);
        } finally {
            setOkumaBusy(false);
        }
    };

    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [detay, setDetay] = useState(null);
    const [pdfBusy, setPdfBusy] = useState(false);

    const handlePdfPaylas = async (irsaliye) => {
        setPdfBusy(true);
        try {
            const sonuc = await irsaliyePdfPaylas(irsaliye);
            if (sonuc === 'indirildi') {
                alert('PDF indirildi. Bu cihazda doğrudan paylaşım desteklenmediği için dosyayı WhatsApp\'ta elle ekleyebilirsiniz.');
            }
        } catch (err) {
            alert('PDF oluşturulamadı: ' + err.message);
        } finally {
            setPdfBusy(false);
        }
    };

    // Form state
    const [partiId, setPartiId] = useState('');
    const [tip, setTip] = useState('kesimhane_dikimhane');
    const [gonderenFirmaId, setGonderenFirmaId] = useState('');
    const [alanFirmaId, setAlanFirmaId] = useState('');
    const [notlar, setNotlar] = useState('');

    const selectedParti = partiler.find(p => p.id === partiId);

    const filtered = irsaliyeler.filter(i => {
        if (filter !== 'all' && i.durum !== filter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return (i.irsaliyeNo || '').toLowerCase().includes(q) ||
                   (i.partiNo || '').toLowerCase().includes(q) ||
                   (i.urunAdi || '').toLowerCase().includes(q);
        }
        return true;
    });
    const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const resetForm = () => {
        setPartiId(''); setTip('kesimhane_dikimhane');
        setGonderenFirmaId(kesimhaneKullanici ? (currentUser.firmaId || '') : ''); setAlanFirmaId(''); setNotlar('');
    };

    const handleSave = () => {
        if (!selectedParti || !gonderenFirmaId || !alanFirmaId) return;
        const gonderenFirma = firmalar.find(f => f.id === gonderenFirmaId);
        const alanFirma = firmalar.find(f => f.id === alanFirmaId);
        irsaliyeEkle({
            partiId: selectedParti.id,
            partiNo: selectedParti.partiNo,
            urunKodu: selectedParti.urunKodu,
            urunAdi: selectedParti.urunAdi,
            toplamAdet: selectedParti.toplamAdet,
            renkler: selectedParti.renkler,
            asorti: selectedParti.asorti,
            tip,
            gonderenFirmaId,
            gonderenFirmaAdi: gonderenFirma?.ad || '',
            alanFirmaId,
            alanFirmaAdi: alanFirma?.ad || '',
            gonderenTel: gonderenFirma?.telefon || '',
            gonderenAdres: gonderenFirma?.adres || '',
            alanTel: alanFirma?.telefon || '',
            alanAdres: alanFirma?.adres || '',
            notlar,
        });
        resetForm();
        setShowModal(false);
    };

    // Silme karttan kaldırıldı — irsaliye silme artık detay penceresinde
    // ve güvenlik şifresiyle yapılır (yanlışlıkla dokunma önlemi).
    const handleDetaySil = (irsaliye) => {
        if (!silmeOnayi(`${irsaliye.irsaliyeNo} numaralı irsaliye silinecek.`)) return;
        irsaliyeSil(irsaliye.id);
        setDetay(null);
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';

    const durumBadgeClass = (d) => {
        if (d === 'taslak') return 'beklemede';
        if (d === 'onaylandi') return 'kesimde';
        if (d === 'teslim_edildi') return 'tamamlandi';
        if (d === 'iptal') return 'borc';
        return '';
    };

    const handleExportCSV = () => {
        exportToCSV(sorted, [
            { label: 'İrsaliye No', key: 'irsaliyeNo' },
            { label: 'Parti No', key: 'partiNo' },
            { label: 'Ürün', key: 'urunAdi' },
            { label: 'Gönderen', key: 'gonderenFirmaAdi' },
            { label: 'Alan', key: 'alanFirmaAdi' },
            { label: 'Adet', key: 'toplamAdet' },
            { label: 'Durum', key: r => IRSALIYE_DURUM_LABELS[r.durum] || r.durum },
            { label: 'Tarih', key: r => formatDate(r.tarih) },
        ], 'irsaliyeler');
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">İrsaliyeler</h1>
                <div className="page-header-actions">
                    <button className="btn btn-ghost" onClick={sablonAc} title="Elle doldurulacak boş A5 kesim sevk irsaliyesi">
                        <FileDown size={18} /> Boş Şablon
                    </button>
                    <button className="btn btn-ghost" onClick={() => kameraRef.current?.click()} disabled={okumaBusy} title="Doldurulmuş şablonun fotoğrafını çekin">
                        {okumaBusy ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />} {okumaBusy ? 'Okunuyor…' : 'Şablonu Okut'}
                    </button>
                    <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                        <Plus size={18} /> Yeni İrsaliye
                    </button>
                </div>
            </div>
            {/* Native kamera: telefonda doğrudan arka kamera açılır */}
            <input ref={kameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleOkutDosya} />
            {bilgi && <Notice tone="success" style={{ marginBottom: '12px' }}>{bilgi}</Notice>}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="İrsaliye no, parti no veya ürün ara..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn btn-ghost" onClick={handleExportCSV} title="CSV'ye Aktar" style={{ flexShrink: 0 }}>
                    <Download size={18} />
                </button>
            </div>

            <div className="filter-row">
                {DURUM_FILTERS.map(d => (
                    <button key={d.value} className={`filter-btn ${filter === d.value ? 'active' : ''}`} onClick={() => setFilter(d.value)}>
                        {d.label}
                    </button>
                ))}
            </div>

            {sorted.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><FileText size={48} /></div>
                    <div className="empty-state-title">İrsaliye bulunamadı</div>
                    <div className="empty-state-text">Yeni bir irsaliye oluşturarak sevkiyat sürecini başlatın</div>
                    <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}><Plus size={18} /> Yeni İrsaliye</button>
                </div>
            ) : (
                <div className="mobile-list">
                    {sorted.map(i => (
                        <div key={i.id} className="mobile-list-item" onClick={() => setDetay(i)} style={{ cursor: 'pointer' }}>
                            <div className="mobile-list-item-header">
                                <span className="mobile-list-item-title">{i.irsaliyeNo}</span>
                                <span className={`badge ${durumBadgeClass(i.durum)}`}>{IRSALIYE_DURUM_LABELS[i.durum]}</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>
                                {i.partiNo} — {i.urunAdi || ''}
                            </div>
                            {/* Sevkiyat rotası: tek bakışta kimden kime */}
                            <div className="irs-rota">
                                <span>{i.gonderenFirmaAdi || '—'}</span>
                                <ArrowRight size={14} className="irs-rota-ok" />
                                <span className="irs-rota-alan">{i.alanFirmaAdi || '—'}</span>
                            </div>
                            <div className="text-xs text-muted" style={{ marginBottom: '10px' }}>
                                {(i.toplamAdet || 0).toLocaleString('tr-TR')} adet &nbsp;•&nbsp; {formatDate(i.tarih)}
                            </div>
                            <div className="mobile-list-item-actions irs-actions">
                                <button className="btn btn-sm btn-soft irs-goruntule" onClick={(e) => { e.stopPropagation(); setDetay(i); }}>
                                    <Eye size={15} /> Görüntüle
                                </button>
                                <button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); yazdirIrsaliye(i); }} title="Yazdır (A4)">
                                    <Printer size={15} />
                                </button>
                                {i.durum === 'taslak' && onaylayabilir && (
                                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); irsaliyeOnayla(i.id); }}>
                                        <Check size={14} /> Onayla
                                    </button>
                                )}
                                {i.durum === 'onaylandi' && onaylayabilir && (
                                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); irsaliyeTeslimEt(i.id); }}>
                                        <Truck size={14} /> Teslim
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* YENİ İRSALİYE MODAL */}
            {showModal && (
                <Modal title="Yeni İrsaliye Oluştur" onClose={() => setShowModal(false)}
                    footer={<>
                        <button className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!selectedParti || !gonderenFirmaId || !alanFirmaId}>{kesimhaneKullanici ? 'Taslak Oluştur' : 'İrsaliye Oluştur'}</button>
                    </>}>
                    <div className="form-group">
                        <label className="form-label">Parti Seç *</label>
                        <SearchableSelect
                            value={partiId}
                            onChange={setPartiId}
                            options={partiler.filter(p => p.durum !== 'tamamlandi').map(p => ({
                                value: p.id,
                                label: `${p.partiNo} — ${p.urunAdi}`,
                                sub: DURUM_LABELS[p.durum],
                            }))}
                            placeholder="Parti seçin"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Sevkiyat Tipi</label>
                        <select className="form-input" value={tip} onChange={e => setTip(e.target.value)}>
                            {Object.entries(IRSALIYE_TIP_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Gönderen Firma *</label>
                        <SearchableSelect
                            value={gonderenFirmaId}
                            onChange={setGonderenFirmaId}
                            options={(kesimhaneKullanici ? firmalar.filter(f => f.id === currentUser.firmaId) : firmalar).map(f => ({ value: f.id, label: f.ad }))}
                            placeholder="Firma seçin"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Alan Firma *</label>
                        <SearchableSelect
                            value={alanFirmaId}
                            onChange={setAlanFirmaId}
                            options={firmalar.map(f => ({ value: f.id, label: f.ad }))}
                            placeholder="Firma seçin"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notlar</label>
                        <textarea className="form-input" value={notlar} onChange={e => setNotlar(e.target.value)} rows={3} placeholder="Ek açıklama..." />
                    </div>
                    <Notice tone={kesimhaneKullanici ? 'warning' : 'info'} style={{ marginBottom: '12px' }}>
                        {kesimhaneKullanici
                            ? 'İrsaliye TASLAK olarak kaydedilir; yönetici onayladığında "Onaylandı" bölümüne geçer.'
                            : 'İrsaliye doğrudan "Onaylandı" olarak kaydedilir.'}
                    </Notice>
                    {selectedParti && (
                        <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{selectedParti.partiNo} — {selectedParti.urunAdi}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toplam: {selectedParti.toplamAdet} adet</div>
                        </div>
                    )}
                </Modal>
            )}

            {/* DETAY MODAL */}
            {detay && (
                <Modal title={`İrsaliye Detay — ${detay.irsaliyeNo}`} onClose={() => setDetay(null)}
                    footer={<>
                        <button className="btn btn-ghost" onClick={() => setDetay(null)}>Kapat</button>
                        <button
                            className="btn btn-success"
                            onClick={() => handlePdfPaylas(detay)}
                            disabled={pdfBusy}
                            title="PDF oluşturup paylaşım sayfasını açar — WhatsApp'ı seçin, dosya ekli gider"
                        >
                            <Share2 size={16} /> {pdfBusy ? 'Hazırlanıyor...' : 'PDF Gönder'}
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={() => whatsappAc(detay.alanTel, irsaliyeMetni(detay))}
                            title={detay.alanTel ? `${detay.alanFirmaAdi} firmasına metin olarak gönder` : 'Kişi seçerek metin gönder'}
                        >
                            <MessageCircle size={16} /> Metin
                        </button>
                        <button className="btn btn-outline" onClick={() => yazdirIrsaliye(detay, 'A5')}><Printer size={16} /> A5</button>
                        <button className="btn btn-primary" onClick={() => yazdirIrsaliye(detay, 'A4')}><Printer size={16} /> A4</button>
                    </>}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div><span className="text-xs text-muted">İrsaliye No</span><div style={{ fontWeight: 700 }}>{detay.irsaliyeNo}</div></div>
                            <div><span className="text-xs text-muted">Durum</span><div><span className={`badge ${durumBadgeClass(detay.durum)}`}>{IRSALIYE_DURUM_LABELS[detay.durum]}</span></div></div>
                            <div><span className="text-xs text-muted">Parti No</span><div style={{ fontWeight: 600 }}>{detay.partiNo}</div></div>
                            <div><span className="text-xs text-muted">Tarih</span><div>{formatDate(detay.tarih)}</div></div>
                        </div>
                        <div style={{ padding: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600 }}>{detay.urunKodu} — {detay.urunAdi}</div>
                            <div className="text-sm text-muted">Toplam: {detay.toplamAdet} adet</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ padding: '10px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted" style={{ fontWeight: 700, marginBottom: '4px' }}>GÖNDEREN</div>
                                <div style={{ fontWeight: 600 }}>{detay.gonderenFirmaAdi}</div>
                                {detay.gonderenTel && <div className="text-xs text-muted">{detay.gonderenTel}</div>}
                            </div>
                            <div style={{ padding: '10px', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary-soft)' }}>
                                <div className="text-xs" style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--accent-primary)' }}>ALAN</div>
                                <div style={{ fontWeight: 600 }}>{detay.alanFirmaAdi}</div>
                                {detay.alanTel && <div className="text-xs text-muted">{detay.alanTel}</div>}
                            </div>
                        </div>
                        {detay.formFotoUrl && (
                            <a className="btn btn-sm btn-ghost" href={fotoSrc(detay.formFotoUrl)} target="_blank" rel="noopener noreferrer" style={{ justifySelf: 'start' }}>
                                <ImageIcon size={14} /> Okutulan formu gör
                            </a>
                        )}
                        {detay.notlar && (
                            <div style={{ padding: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>Notlar</div>
                                <div className="text-sm">{detay.notlar}</div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {detay.durum === 'taslak' && onaylayabilir && <button className="btn btn-sm btn-primary" onClick={() => { irsaliyeOnayla(detay.id); setDetay({...detay, durum:'onaylandi'}); }}><Check size={14}/> Onayla</button>}
                            {detay.durum === 'onaylandi' && onaylayabilir && <button className="btn btn-sm btn-success" onClick={() => { irsaliyeTeslimEt(detay.id); setDetay({...detay, durum:'teslim_edildi'}); }}><Truck size={14}/> Teslim Edildi</button>}
                            {(detay.durum === 'taslak' || (detay.durum === 'onaylandi' && onaylayabilir)) && <button className="btn btn-sm btn-danger" onClick={() => { irsaliyeIptal(detay.id); setDetay({...detay, durum:'iptal'}); }}><X size={14}/> İptal Et</button>}
                            {!kesimhaneKullanici && <button className="btn btn-sm btn-ghost" onClick={() => handleDetaySil(detay)} style={{ color: 'var(--accent-danger)' }}><Trash2 size={14}/> Sil</button>}
                        </div>
                    </div>
                </Modal>
            )}
            {/* Boş A5 şablon yazdırma */}
            {sablonModal && (
                <Modal
                    title="Boş kesim sevk irsaliyesi (A5)"
                    onClose={() => setSablonModal(false)}
                    footer={<>
                        <button className="btn btn-ghost" onClick={() => setSablonModal(false)}>İptal</button>
                        <button className="btn btn-primary" onClick={sablonYazdir}><Printer size={16} /> Yazdır</button>
                    </>}
                >
                    <p className="text-sm text-muted" style={{ marginBottom: '16px' }}>
                        Kesimhane formu elle doldurur (model no, renk, adet). Sonra "Şablonu Okut" ile fotoğrafı çekilir ve irsaliye otomatik oluşur.
                        İsterseniz firma adları formda basılı gelsin.
                    </p>
                    <div className="form-group">
                        <label className="form-label">Gönderen kesimhane (basılı)</label>
                        {kesimhaneKullanici ? (
                            <input className="form-input" value={firmalar.find(f => f.id === sablon.kesimhaneId)?.ad || ''} readOnly />
                        ) : (
                            <SearchableSelect value={sablon.kesimhaneId} onChange={v => setSablon({ ...sablon, kesimhaneId: v })}
                                options={firmalar.filter(f => f.tip === 'kesimhane').map(f => ({ value: f.id, label: f.ad }))}
                                placeholder="Boş bırak (elle yazılsın)" clearLabel="Boş bırak" />
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">Alan atölye (basılı)</label>
                        <SearchableSelect value={sablon.atolyeId} onChange={v => setSablon({ ...sablon, atolyeId: v })}
                            options={firmalar.filter(f => f.tip === 'atolye').map(f => ({ value: f.id, label: f.ad }))}
                            placeholder="Boş bırak (elle yazılsın)" clearLabel="Boş bırak" />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="sablon-kopya">Kaç sayfa?</label>
                        <input id="sablon-kopya" type="number" min="1" max="20" className="form-input" value={sablon.kopya}
                            onChange={e => setSablon({ ...sablon, kopya: e.target.value })} />
                    </div>
                </Modal>
            )}

            {/* Okunan şablonu kontrol et → irsaliye oluştur */}
            {okumaSonucu && (
                <SevkIrsaliyeOkuma
                    sonuc={okumaSonucu}
                    onClose={() => setOkumaSonucu(null)}
                    onKaydedildi={(n) => setBilgi(`${n} irsaliye okutulan formdan oluşturuldu.`)}
                />
            )}
        </div>
    );
}
