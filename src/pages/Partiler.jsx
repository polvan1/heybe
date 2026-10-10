import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { yazdirIrsaliye } from '../utils/irsaliyePrint';
import { Plus, Eye, Layers, Printer, Search, Download, Edit2, Archive, ArchiveRestore, MapPin } from 'lucide-react';
import { DURUM_LABELS, exportToCSV, isPartiArsivde, firmaFiyatBul } from '../data/db';

const DURUM_FILTERS = [
    { value: 'all', label: 'Tümü' },
    { value: 'kesimde', label: 'Kesimde' },
    { value: 'dikimde', label: 'Dikimde' },
    { value: 'utupakette', label: 'Ütü/Paket' },
    { value: 'tamamlandi', label: 'Tamamlandı' },
    { value: 'arsiv', label: 'Arşiv' },
];

export default function Partiler() {
    const { partiler, urunler, firmalar, cariHareketler, partiEkle, partiArsivle } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const [filter, setFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [showIrsaliye, setShowIrsaliye] = useState(null);
    const [irsaliyeHedef, setIrsaliyeHedef] = useState('dikimhane'); // dikimhane | baskici | utupaketci
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (location.state?.openNewModal) {
            setShowModal(true);
            // Clear state so it doesn't reopen on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Yeni parti formu
    const [selectedUrunId, setSelectedUrunId] = useState('');
    const [renkler, setRenkler] = useState([]);
    const [yeniRenk, setYeniRenk] = useState('');
    const [kesimhaneId, setKesimhaneId] = useState('');
    const [dikimhaneId, setDikimhaneId] = useState('');
    const [utupaketciId, setUtupaketciId] = useState('');
    const [customAsorti, setCustomAsorti] = useState(null);
    const [isEditingAsorti, setIsEditingAsorti] = useState(false);

    const selectedUrun = urunler.find(u => u.id === selectedUrunId);
    const kesimhaneler = firmalar.filter(f => f.tip === 'kesimhane');
    const dikimhaneler = firmalar.filter(f => f.tip === 'atolye');
    const utupaketciler = firmalar.filter(f => f.tip === 'utupaketci');

    useEffect(() => {
        if (selectedUrunId && urunler.length > 0) {
            const u = urunler.find(urun => urun.id === selectedUrunId);
            if (u) {
                setCustomAsorti(JSON.parse(JSON.stringify(u.asorti)));
                setRenkler([]);
                setIsEditingAsorti(false);
            } else {
                setCustomAsorti(null);
            }
        } else {
            setCustomAsorti(null);
        }
    }, [selectedUrunId, urunler]);

    const filtered = partiler.filter(p => {
        // Arşiv ayrımı: hesabı görülen (veya manuel arşivlenen) partiler
        // yalnızca Arşiv sekmesinde görünür, diğer tüm sekmelerden düşer
        const arsivde = isPartiArsivde(p, cariHareketler);
        if (filter === 'arsiv') {
            if (!arsivde) return false;
        } else {
            if (arsivde) return false;
            if (filter !== 'all' && p.durum !== filter) return false;
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            return (p.partiNo || '').toLowerCase().includes(q) ||
                   (p.urunAdi || '').toLowerCase().includes(q) ||
                   (p.urunKodu || '').toLowerCase().includes(q);
        }
        return true;
    });
    const arsivSayisi = partiler.filter(p => isPartiArsivde(p, cariHareketler)).length;
    const sorted = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const handleExportCSV = () => {
        exportToCSV(sorted, [
            { label: 'Parti No', key: 'partiNo' },
            { label: 'Ürün', key: 'urunAdi' },
            { label: 'Ürün Kodu', key: 'urunKodu' },
            { label: 'Toplam Adet', key: 'toplamAdet' },
            { label: 'Durum', key: r => DURUM_LABELS[r.durum] || r.durum },
            { label: 'Tarih', key: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString('tr-TR') : '' },
        ], 'partiler');
    };

    const addRenk = () => {
        if (!yeniRenk.trim() || !customAsorti) return;
        const bedenAdetleri = {};
        customAsorti.bedenler.forEach(b => { bedenAdetleri[b] = 0; });
        setRenkler([...renkler, { renk: yeniRenk.trim(), katSayisi: 0, bedenAdetleri, toplam: 0 }]);
        setYeniRenk('');
    };

    const removeRenk = (index) => {
        setRenkler(renkler.filter((_, i) => i !== index));
    };

    const updateKatSayisi = (index, katSayisi) => {
        if (!customAsorti) return;
        const kat = parseInt(katSayisi, 10) || 0;
        const newRenkler = [...renkler];
        newRenkler[index].katSayisi = kat;
        const bedenAdetleri = {};
        let toplam = 0;
        customAsorti.bedenler.forEach(b => {
            const adet = kat * (customAsorti.dagilim[b] || 0);
            bedenAdetleri[b] = adet;
            toplam += adet;
        });
        newRenkler[index].bedenAdetleri = bedenAdetleri;
        newRenkler[index].toplam = toplam;
        setRenkler(newRenkler);
    };

    const updateBaseAsorti = (beden, deger) => {
        if (!customAsorti) return;
        const yeniDagilim = { ...customAsorti.dagilim, [beden]: parseInt(deger, 10) || 0 };
        setCustomAsorti({ ...customAsorti, dagilim: yeniDagilim });
        
        // Asorti değişince mevcut renklerin toplam adetlerini güncelle
        const newRenkler = renkler.map(r => {
            const bedenAdetleri = {};
            let toplam = 0;
            customAsorti.bedenler.forEach(b => {
                const adet = r.katSayisi * (yeniDagilim[b] || 0);
                bedenAdetleri[b] = adet;
                toplam += adet;
            });
            return { ...r, bedenAdetleri, toplam };
        });
        setRenkler(newRenkler);
    };

    const toplamAdet = renkler.reduce((t, r) => t + r.toplam, 0);

    const resetForm = () => {
        setSelectedUrunId('');
        setRenkler([]);
        setYeniRenk('');
        setKesimhaneId('');
        setDikimhaneId('');
        setUtupaketciId('');
        setCustomAsorti(null);
        setIsEditingAsorti(false);
    };

    const handleSave = () => {
        if (!selectedUrun || !customAsorti || renkler.length === 0 || !kesimhaneId || !dikimhaneId || toplamAdet === 0) return;
        partiEkle({
            urunId: selectedUrun.id,
            urunKodu: selectedUrun.urunKodu,
            urunAdi: selectedUrun.urunAdi,
            asorti: customAsorti, // Bu partiye özel asortiyi kaydediyoruz
            renkler,
            toplamAdet,
            kesimhaneId,
            dikimhaneId,
            utupaketciId: utupaketciId || null,
            // Firma bazlı fiyat anlaşması varsa o, yoksa ürünün varsayılan fiyatı
            kesimBirimFiyat: firmaFiyatBul(selectedUrun, kesimhaneId, 'kesim'),
            dikimBirimFiyat: firmaFiyatBul(selectedUrun, dikimhaneId, 'dikim'),
            utuBirimFiyat: firmaFiyatBul(selectedUrun, utupaketciId, 'utu'),
        });
        resetForm();
        setShowModal(false);
    };

    // NOT: Silme butonu yanlışlıkla dokunmayı önlemek için listeden kaldırıldı —
    // parti silme artık Parti Detay sayfasında ve güvenlik şifresiyle yapılır.

    const openIrsaliye = (e, parti) => {
        e.stopPropagation();
        // Akıllı hedef seçimi: partinin durumuna göre otomatik ayarla
        if (parti.durum === 'utupakette') setIrsaliyeHedef('utupaketci');
        else setIrsaliyeHedef('dikimhane');
        setShowIrsaliye(parti);
    };

    const printIrsaliye = (boyut = 'A4') => {
        const parti = showIrsaliye;
        const hedef = irsaliyeHedef;
        const kesimhane = firmalar.find(f => f.id === parti.kesimhaneId);
        const dikimhane = firmalar.find(f => f.id === parti.dikimhaneId);
        const utupaketci = firmalar.find(f => f.id === parti.utupaketciId);
        const baskicilar = firmalar.filter(f => f.tip === 'baskici');

        // Gönderen / Alan bilgisi hedef tipine göre
        let gonderen, alan, hedefLabel;
        if (hedef === 'baskici') {
            gonderen = kesimhane; alan = baskicilar[0] || null; hedefLabel = 'BASKIYA GÖNDERİM';
        } else if (hedef === 'utupaketci') {
            gonderen = dikimhane; alan = utupaketci; hedefLabel = 'ÜTÜ/PAKET GÖNDERİM';
        } else {
            gonderen = kesimhane; alan = dikimhane; hedefLabel = 'DİKİME GÖNDERİM';
        }

        // Ortak sade şablonla yazdır (İrsaliyeler sayfasıyla aynı format)
        yazdirIrsaliye({
            partiId: parti.id,
            partiNo: parti.partiNo,
            urunKodu: parti.urunKodu,
            urunAdi: parti.urunAdi,
            toplamAdet: parti.toplamAdet,
            renkler: parti.renkler,
            asorti: parti.asorti,
            tipLabel: hedefLabel,
            gonderenFirmaAdi: gonderen?.ad || '',
            gonderenTel: gonderen?.telefon || '',
            gonderenAdres: gonderen?.adres || '',
            alanFirmaAdi: alan?.ad || '',
            alanTel: alan?.telefon || '',
            alanAdres: alan?.adres || '',
        }, boyut);
    };

    const formatMonthDay = (dateStr) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
        });
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Partiler</h1>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                    <Plus size={18} /> Yeni Parti
                </button>
            </div>

            {/* Arama + Export */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Parti no, ürün adı veya kod ara..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className="btn btn-ghost" onClick={handleExportCSV} title="CSV'ye Aktar" style={{ flexShrink: 0 }}>
                    <Download size={18} />
                </button>
            </div>

            {/* Filter */}
            <div className="filter-row">
                {DURUM_FILTERS.map(d => (
                    <button key={d.value} className={`filter-btn ${filter === d.value ? 'active' : ''}`} onClick={() => setFilter(d.value)}>
                        {d.value === 'arsiv' ? <><Archive size={13} style={{ marginRight: '4px' }} />{d.label} ({arsivSayisi})</> : d.label}
                    </button>
                ))}
            </div>

            {/* List */}
            {sorted.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Layers size={48} /></div>
                    <div className="empty-state-title">Parti bulunamadı</div>
                    <div className="empty-state-text">Yeni bir parti oluşturarak üretim sürecini başlatın</div>
                    <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}><Plus size={18} /> Yeni Parti</button>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="desktop-only">
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left' }}>Tarih</th>
                                        <th>Parti No</th>
                                        <th>Ürün Kodu</th>
                                        <th>Ürün Adı</th>
                                        <th style={{ textAlign: 'right' }}>Kesim Adet</th>
                                        <th style={{ textAlign: 'right' }}>Dikim Adet</th>
                                        <th style={{ textAlign: 'right' }}>Çıkan Adet</th>
                                        <th style={{ textAlign: 'left' }}>Kesimhane</th>
                                        <th style={{ textAlign: 'left' }}>Dikimhane</th>
                                        <th style={{ textAlign: 'left' }}>Ütü/Paket</th>
                                        <th style={{ textAlign: 'left' }}>Durum</th>
                                        <th style={{ textAlign: 'center' }}>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(p => {
                                        const kesimhane = firmalar.find(f => f.id === p.kesimhaneId);
                                        const dikimhane = firmalar.find(f => f.id === p.dikimhaneId);
                                        const utupaketci = firmalar.find(f => f.id === p.utupaketciId);
                                        return (
                                            <tr key={p.id} onClick={() => navigate(`/parti/${p.id}`)} style={{ cursor: 'pointer' }}>
                                                <td style={{ fontSize: '0.85rem' }}>{formatMonthDay(p.createdAt)}</td>
                                                <td style={{ fontWeight: 600 }}>{p.partiNo}</td>
                                                <td>{p.urunKodu}</td>
                                                <td>{p.urunAdi}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.toplamAdet?.toLocaleString('tr-TR')}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.toplamAdet?.toLocaleString('tr-TR')}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)' }}>{p.sonCikanAdet?.toLocaleString('tr-TR') || '—'}</td>
                                                <td>{kesimhane?.ad || '-'}</td>
                                                <td>{dikimhane?.ad || '-'}</td>
                                                <td>{utupaketci?.ad || '-'}</td>
                                                <td><span className={`badge ${p.durum}`}>{DURUM_LABELS[p.durum]}</span></td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); navigate(`/parti/${p.id}`); }} title="Detay"><Eye size={14} /></button>
                                                        <button className="btn btn-sm btn-ghost" onClick={(e) => openIrsaliye(e, p)} title="İrsaliye"><Printer size={14} /></button>
                                                        {filter === 'arsiv' ? (
                                                            p.arsivde === true && (
                                                                <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); partiArsivle(p.id, false); }} title="Arşivden Çıkar"><ArchiveRestore size={14} /></button>
                                                            )
                                                        ) : (
                                                            p.durum === 'tamamlandi' && (
                                                                <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); partiArsivle(p.id, true); }} title="Arşivle"><Archive size={14} /></button>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="mobile-only">
                        <div className="mobile-list">
                            {sorted.map(p => {
                                const ilerleme = p.toplamAdet > 0 ? Math.round(((p.toplamAdet - (p.kalanAdet || 0)) / p.toplamAdet) * 100) : 0;
                                const kesimhane = firmalar.find(f => f.id === p.kesimhaneId);
                                const dikimhane = firmalar.find(f => f.id === p.dikimhaneId);
                                const utupaketci = firmalar.find(f => f.id === p.utupaketciId);
                                return (
                                    <div key={p.id} className="mobile-list-item" onClick={() => navigate(`/parti/${p.id}`)} style={{ cursor: 'pointer' }}>
                                        <div className="mobile-list-item-header">
                                            <span className="mobile-list-item-title">{p.partiNo}</span>
                                            <span className={`badge ${p.durum}`}>{DURUM_LABELS[p.durum]}</span>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '4px' }}>
                                            {p.urunKodu} — {p.urunAdi}
                                        </div>
                                        <div className="mobile-list-item-meta">
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
                                                <span>Tarih: {formatMonthDay(p.createdAt)}</span>
                                                <span style={{ fontWeight: 600 }}>Çıkan: {p.sonCikanAdet || '—'}</span>
                                                <span>Kesim: {kesimhane?.ad || '-'}</span>
                                                <span>Dikim: {dikimhane?.ad || '-'}</span>
                                                <span>Ütü/P: {utupaketci?.ad || '-'}</span>
                                                <span>Adet: {p.toplamAdet}</span>
                                            </div>
                                        </div>
                                        <div className="progress-bar" style={{ marginTop: '8px' }}>
                                            <div className="progress-bar-fill green" style={{ width: `${ilerleme}%` }} />
                                        </div>
                                        <div className="mobile-list-item-actions">
                                            <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); navigate(`/parti/${p.id}`); }}>
                                                <Eye size={14} /> Detay
                                            </button>
                                            <button className="btn btn-sm btn-ghost" onClick={(e) => openIrsaliye(e, p)}>
                                                <Printer size={14} /> İrsaliye
                                            </button>
                                            {filter === 'arsiv' ? (
                                                p.arsivde === true && (
                                                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); partiArsivle(p.id, false); }}>
                                                        <ArchiveRestore size={14} /> Çıkar
                                                    </button>
                                                )
                                            ) : (
                                                p.durum === 'tamamlandi' && (
                                                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); partiArsivle(p.id, true); }}>
                                                        <Archive size={14} /> Arşivle
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* ===== YENİ PARTİ MODAL ===== */}
            {showModal && (
                <Modal
                    title="Yeni Parti Oluştur"
                    onClose={() => setShowModal(false)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!selectedUrun || renkler.length === 0 || !kesimhaneId || !dikimhaneId || toplamAdet === 0}>
                                Parti Oluştur
                            </button>
                        </>
                    }
                >
                    {/* 1. Model Seç */}
                    <div className="form-group">
                        <label className="form-label">Model No (Ürün) Seç *</label>
                        <SearchableSelect
                            value={selectedUrunId}
                            onChange={val => { setSelectedUrunId(val); setRenkler([]); }}
                            options={urunler.map(u => ({ value: u.id, label: `${u.urunKodu} — ${u.urunAdi}` }))}
                            placeholder="Ürün seçin"
                        />
                    </div>

                    {selectedUrun && (
                        <>
                            {customAsorti && (
                                <div style={{ padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', border: '1px solid var(--border-color)', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{selectedUrun.urunAdi}</div>
                                            {!isEditingAsorti ? (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    Asorti (1 Kat): {customAsorti.bedenler.map(b => `${b}:${customAsorti.dagilim[b]}`).join(' / ')}
                                                    {' '}= {customAsorti.bedenler.reduce((t, b) => t + (customAsorti.dagilim[b] || 0), 0)} adet
                                                </div>
                                            ) : (
                                                <div style={{ marginTop: '8px', padding: '12px', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-muted)' }}>BU PARTİYE ÖZEL ASORTİYİ DÜZENLE</div>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        {customAsorti.bedenler.map(b => (
                                                            <div key={b} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{ fontSize: '0.75rem', fontWeight: 600, textAlign: 'center' }}>{b}</label>
                                                                <input
                                                                    type="number"
                                                                    className="form-input"
                                                                    style={{ width: '50px', padding: '4px', textAlign: 'center' }}
                                                                    value={customAsorti.dagilim[b] || 0}
                                                                    onChange={(e) => updateBaseAsorti(b, e.target.value)}
                                                                    min="0"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            className="btn btn-sm btn-ghost" 
                                            onClick={() => setIsEditingAsorti(!isEditingAsorti)}
                                            style={{ fontSize: '0.75rem', padding: '4px 8px', color: isEditingAsorti ? 'var(--accent-success)' : 'var(--accent-info)' }}
                                            type="button"
                                        >
                                            {isEditingAsorti ? <><Plus size={12} style={{ marginRight: '4px', transform: 'rotate(45deg)' }} /> Kapat</> : <><Edit2 size={12} style={{ marginRight: '4px' }} /> Özel Asorti Oluştur</>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 2. Firma Atamaları */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                                {[
                                    { label: 'Kesimhane *', value: kesimhaneId, onChange: setKesimhaneId, options: kesimhaneler, tip: 'kesim', tipAd: 'Kesim', placeholder: 'Seçin' },
                                    { label: 'Dikimhane *', value: dikimhaneId, onChange: setDikimhaneId, options: dikimhaneler, tip: 'dikim', tipAd: 'Dikim', placeholder: 'Seçin' },
                                    { label: 'Ütü/Paket', value: utupaketciId, onChange: setUtupaketciId, options: utupaketciler, tip: 'utu', tipAd: 'Ütü/Paket', placeholder: 'Yok / Sonra', clearLabel: 'Yok / Sonra' },
                                ].map(alan => {
                                    const anlasmaVar = alan.value && selectedUrun?.firmaFiyatlari?.[alan.value]?.[alan.tip] > 0;
                                    const fiyat = alan.value ? firmaFiyatBul(selectedUrun, alan.value, alan.tip) : 0;
                                    return (
                                        <div key={alan.tip} className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">{alan.label}</label>
                                            <SearchableSelect
                                                value={alan.value}
                                                onChange={alan.onChange}
                                                options={alan.options.map(f => ({ value: f.id, label: f.ad }))}
                                                placeholder={alan.placeholder}
                                                clearLabel={alan.clearLabel}
                                            />
                                            {alan.value && (
                                                <div style={{ fontSize: '0.72rem', marginTop: '3px', color: anlasmaVar ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: anlasmaVar ? 600 : 400 }}>
                                                    {alan.tipAd} fiyatı: {fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                                                    {anlasmaVar ? ' — firma anlaşması' : ' (varsayılan)'}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 3. Renk ve Kat Girişi */}
                            <div className="form-group">
                                <label className="form-label">Renkler & Kat Sayısı</label>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <input className="form-input" value={yeniRenk} onChange={e => setYeniRenk(e.target.value)} placeholder="Renk adı (Siyah, Beyaz...)" onKeyDown={e => e.key === 'Enter' && addRenk()} style={{ flex: 1 }} />
                                    <button className="btn btn-primary" onClick={addRenk} type="button"><Plus size={16} /></button>
                                </div>

                                {renkler.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {renkler.map((r, i) => (
                                            <div key={i} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <span style={{ fontWeight: 600 }}>{r.renk}</span>
                                                    <button className="btn-icon" onClick={() => removeRenk(i)} style={{ color: 'var(--accent-danger)', width: '32px', height: '32px' }}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Kat Sayısı:</label>
                                                    <input className="form-input" type="number" min="0" value={r.katSayisi || ''} onChange={e => updateKatSayisi(i, e.target.value)} style={{ width: '80px', padding: '6px 8px', textAlign: 'center' }} />
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{r.toplam} adet</span>
                                                </div>
                                                {r.katSayisi > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                        {selectedUrun.asorti.bedenler.map(b => (
                                                            <span key={b} className="badge devam" style={{ fontSize: '0.7rem' }}>
                                                                {b}: {r.bedenAdetleri[b]}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <div style={{ padding: '10px', background: 'var(--accent-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontWeight: 700 }}>
                                            Toplam: {toplamAdet} adet
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </Modal>
            )}

            {/* ===== İRSALİYE MODAL ===== */}
            {showIrsaliye && (
                <Modal
                    title={`İrsaliye — ${showIrsaliye.partiNo}`}
                    onClose={() => setShowIrsaliye(null)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setShowIrsaliye(null)}>Kapat</button>
                            <button className="btn btn-outline" onClick={() => printIrsaliye('A5')}><Printer size={16} /> A5 Yazdır</button>
                            <button className="btn btn-primary" onClick={() => printIrsaliye('A4')}><Printer size={16} /> A4 Yazdır</button>
                        </>
                    }
                >
                    {/* Hedef Seçimi */}
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-primary-border)' }}>
                        <label className="form-label" style={{ marginBottom: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={16} /> Gönderim Hedefi</label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                                className={`btn btn-sm ${irsaliyeHedef === 'baskici' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setIrsaliyeHedef('baskici')}
                            >Baskıcı</button>
                            <button
                                className={`btn btn-sm ${irsaliyeHedef === 'dikimhane' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setIrsaliyeHedef('dikimhane')}
                            >Dikimhane</button>
                            <button
                                className={`btn btn-sm ${irsaliyeHedef === 'utupaketci' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setIrsaliyeHedef('utupaketci')}
                            >Ütü/Paket</button>
                        </div>
                    </div>
                    <IrsaliyeContent parti={showIrsaliye} firmalar={firmalar} hedef={irsaliyeHedef} />
                </Modal>
            )}
        </div>
    );
}

function IrsaliyeContent({ parti, firmalar, hedef }) {
    const kesimhane = firmalar.find(f => f.id === parti.kesimhaneId);
    const dikimhane = firmalar.find(f => f.id === parti.dikimhaneId);
    const utupaketci = firmalar.find(f => f.id === parti.utupaketciId);
    const baskicilar = firmalar.filter(f => f.tip === 'baskici');

    let gonderen, alan, hedefLabel;
    if (hedef === 'baskici') {
        gonderen = { label: 'Kesimhane', firma: kesimhane };
        alan = { label: 'Baskıcı', firma: baskicilar[0] || null };
        hedefLabel = 'BASKIYA GÖNDERİM';
    } else if (hedef === 'utupaketci') {
        gonderen = { label: 'Dikimhane', firma: dikimhane };
        alan = { label: 'Ütü/Paket', firma: utupaketci };
        hedefLabel = 'ÜTÜ/PAKET GÖNDERİM';
    } else {
        gonderen = { label: 'Kesimhane', firma: kesimhane };
        alan = { label: 'Dikimhane', firma: dikimhane };
        hedefLabel = 'DİKİME GÖNDERİM';
    }

    const irsaliyeStyle = {
        fontFamily: 'Arial, sans-serif',
        color: '#000',
        background: '#fff',
        padding: '20px',
        fontSize: '13px',
        lineHeight: '1.5',
    };

    const thStyle = {
        border: '1px solid #333',
        padding: '6px 10px',
        background: '#e8ecf0',
        fontWeight: '700',
        fontSize: '12px',
        textAlign: 'center',
    };

    const tdStyle = {
        border: '1px solid #999',
        padding: '6px 10px',
        textAlign: 'center',
        fontSize: '12px',
    };

    return (
        <div style={irsaliyeStyle} className="irsaliye-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #1d4ed8', paddingBottom: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#1d4ed8' }}>MY HIS — SEVKİYAT İRSALİYESİ</h2>
                <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'inline-block', background: '#1d4ed8', color: '#fff', padding: '3px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {hedefLabel}
                    </span>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                        Tarih: {new Date().toLocaleDateString('tr-TR')} | Parti No: {parti.partiNo}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ padding: '10px 14px', border: '2px solid #94a3b8', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{gonderen.label} (Çıkış)</div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{gonderen.firma?.ad || '—'}</div>
                    {gonderen.firma?.telefon && <div style={{ fontSize: '11px', color: '#666' }}>Tel: {gonderen.firma.telefon}</div>}
                    {gonderen.firma?.adres && <div style={{ fontSize: '11px', color: '#666' }}>{gonderen.firma.adres}</div>}
                </div>
                <div style={{ padding: '10px 14px', border: '2px solid #1d4ed8', borderRadius: '6px', background: '#f0f5ff' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px', color: '#1d4ed8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{alan.label} (Varış)</div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{alan.firma?.ad || '—'}</div>
                    {alan.firma?.telefon && <div style={{ fontSize: '11px', color: '#666' }}>Tel: {alan.firma.telefon}</div>}
                    {alan.firma?.adres && <div style={{ fontSize: '11px', color: '#666' }}>{alan.firma.adres}</div>}
                </div>
            </div>

            <div style={{ marginBottom: '16px', padding: '8px 12px', background: '#f0f4f8', borderRadius: '4px' }}>
                <strong>Ürün:</strong> {parti.urunKodu} — {parti.urunAdi}
                &nbsp;&nbsp;|&nbsp;&nbsp;
                <strong>Toplam:</strong> {parti.toplamAdet?.toLocaleString('tr-TR')} adet
            </div>

            {parti.renkler && parti.renkler.length > 0 && parti.asorti && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, textAlign: 'left' }}>Renk</th>
                            <th style={thStyle}>Kat</th>
                            {parti.asorti.bedenler.map(b => (
                                <th key={b} style={thStyle}>{b}</th>
                            ))}
                            <th style={thStyle}>Toplam</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parti.renkler.map((r, i) => (
                            <tr key={i}>
                                <td style={{ ...tdStyle, fontWeight: 600, textAlign: 'left' }}>{r.renk}</td>
                                <td style={tdStyle}>{r.katSayisi}</td>
                                {parti.asorti.bedenler.map(b => (
                                    <td key={b} style={tdStyle}>{r.bedenAdetleri?.[b] || 0}</td>
                                ))}
                                <td style={{ ...tdStyle, fontWeight: 700 }}>{r.toplam}</td>
                            </tr>
                        ))}
                        <tr style={{ background: '#e8ecf0' }}>
                            <td style={{ ...tdStyle, fontWeight: 700, textAlign: 'left' }} colSpan={2}>TOPLAM</td>
                            {parti.asorti.bedenler.map(b => (
                                <td key={b} style={{ ...tdStyle, fontWeight: 700 }}>
                                    {parti.renkler.reduce((t, r) => t + (r.bedenAdetleri?.[b] || 0), 0)}
                                </td>
                            ))}
                            <td style={{ ...tdStyle, fontWeight: 700, color: '#1d4ed8' }}>{parti.toplamAdet}</td>
                        </tr>
                    </tbody>
                </table>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                <div>
                    <div style={{ borderTop: '1px solid #333', paddingTop: '8px', textAlign: 'center', fontSize: '11px' }}>
                        Teslim Eden
                    </div>
                </div>
                <div>
                    <div style={{ borderTop: '1px solid #333', paddingTop: '8px', textAlign: 'center', fontSize: '11px' }}>
                        Teslim Alan
                    </div>
                </div>
            </div>
        </div>
    );
}

