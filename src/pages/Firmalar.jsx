import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { Plus, Edit2, Trash2, Phone, MapPin, User, Search, Calendar, Power, Download, Upload } from 'lucide-react';
import { FIRMA_TIP_LABELS } from '../data/db';
import { FIRMA_TIPLERI, firmaRozetSinifi, firmaAktifMi, firmaTipi } from '../utils/firma';
import Notice from '../components/ui/Notice';
import { silmeOnayi } from '../utils/guvenlik';
import { tabloDosyasiOku } from '../utils/excelOku';
import { firmaSatirlariniCoz, firmaSablonuIndir, firmaAdiAnahtari, firmaGuncellemesi, yeniFirmaVerisi } from '../utils/firmaAktar';

const TIPLER = [
    { value: 'all', label: 'Tümü' },
    ...FIRMA_TIPLERI.map(t => ({ value: t.value, label: t.kisa })),
];

const EMPTY_FORM = { ad: '', tip: 'atolye', telefon: '', adres: '', yetkiliKisi: '', notlar: '', gunlukKapasite: '', odemeVadesi: '', aktif: true };

export default function Firmalar() {
    const { firmalar, firmaEkle, firmaGuncelle, firmaSil, partiler, getFirmaPerformans } = useApp();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(null);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [pasifleriGoster, setPasifleriGoster] = useState(false);
    const dosyaRef = useRef(null);
    const [aktarSatirlari, setAktarSatirlari] = useState(null);   // okunan Excel satırları
    const [varsayilanTip, setVarsayilanTip] = useState('atolye');  // türü boş satırlar için

    const pasifSayisi = firmalar.filter(f => !firmaAktifMi(f)).length;
    const filtered = firmalar.filter(f => {
        if (filter !== 'all' && f.tip !== filter) return false;
        if (!pasifleriGoster && !firmaAktifMi(f)) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return f.ad.toLowerCase().includes(q) ||
                   (f.yetkiliKisi || '').toLowerCase().includes(q) ||
                   (f.telefon || '').includes(q);
        }
        return true;
    });

    const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setModal('add'); };
    const openEdit = (firma) => { setForm({ ...EMPTY_FORM, ...firma, aktif: firmaAktifMi(firma) }); setEditId(firma.id); setModal('edit'); };

    const handleSave = () => {
        if (!form.ad.trim()) return;
        const data = { ...form, odemeVadesi: form.odemeVadesi ? parseInt(form.odemeVadesi, 10) : null };
        // Boş sayı alanları null gönderilir (sunucu MySQL'de boş metni sayı kolonuna yazamaz)
        data.gunlukKapasite = data.tip === 'kumasci' || form.gunlukKapasite === '' ? null : (parseInt(form.gunlukKapasite, 10) || null);
        if (editId) {
            firmaGuncelle(editId, data);
        } else {
            firmaEkle(data);
        }
        setModal(null);
    };

    // Silme, yanlışlıkla dokunmayı önlemek için karttan kaldırıldı —
    // firma silme artık Düzenle penceresinde ve güvenlik şifresiyle yapılır.
    const handleModalSil = async () => {
        const firma = firmalar.find(f => f.id === editId);
        if (!(await silmeOnayi(`${firma?.ad || ''} firması silinecek.`))) return;
        const result = firmaSil(editId);
        if (result && result.ok === false) {
            alert(result.reason);
            return;
        }
        setModal(null);
    };

    const getAktifPartiSayisi = (firmaId) => {
        return partiler.filter(p =>
            p.durum !== 'tamamlandi' && !p.arsivde && (
                p.kesimhaneId === firmaId || p.dikimhaneId === firmaId || p.utupaketciId === firmaId ||
                p.firmaAtamalari?.some(a => a.firmaId === firmaId))
        ).length;
    };
    const duzenlenenAktifParti = editId ? getAktifPartiSayisi(editId) : 0;

    const getPerfBadge = (skor) => {
        if (skor >= 85) return { label: `${skor}`, cls: 'excellent' };
        if (skor >= 70) return { label: `${skor}`, cls: 'good' };
        if (skor >= 50) return { label: `${skor}`, cls: 'average' };
        return { label: `${skor}`, cls: 'poor' };
    };

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    // ---- EXCEL / CSV İÇE AKTARMA ----
    // Aynı adlı firma zaten varsa yeni kayıt açılmaz; dosyada dolu olan bilgileri güncellenir.
    const handleDosyaSec = async (e) => {
        const dosya = e.target.files[0];
        e.target.value = '';
        if (!dosya) return;
        try {
            const satirlar = await tabloDosyasiOku(dosya);
            if (firmaSatirlariniCoz(satirlar).length === 0) {
                alert('Geçerli firma bulunamadı. İlk satır başlık (Firma Adı, Firma Türü, Telefon, Adres...), sonraki satırlar firmalar olmalıdır.');
                return;
            }
            setAktarSatirlari(satirlar);
        } catch (hata) {
            alert(hata.message || 'Dosya okunamadı.');
        }
    };
    const adaGore = new Map(firmalar.map(f => [firmaAdiAnahtari(f.ad), f]));
    const aktarilacak = aktarSatirlari
        ? firmaSatirlariniCoz(aktarSatirlari, { varsayilanTip }).map(f => ({ ...f, mevcut: adaGore.get(firmaAdiAnahtari(f.ad)) || null }))
        : [];
    const tipsizSayisi = aktarilacak.filter(f => !f.tipVerildi && !f.mevcut).length;
    const handleAktarOnay = () => {
        let yeni = 0, guncel = 0;
        const eklenen = new Set();
        aktarilacak.forEach(f => {
            if (f.mevcut) { firmaGuncelle(f.mevcut.id, firmaGuncellemesi(f)); guncel++; return; }
            const anahtar = firmaAdiAnahtari(f.ad);
            if (eklenen.has(anahtar)) return;   // dosyada aynı firma iki kez yazılmışsa bir kez ekle
            eklenen.add(anahtar);
            firmaEkle(yeniFirmaVerisi(f));
            yeni++;
        });
        setAktarSatirlari(null);
        alert([yeni && `${yeni} firma eklendi`, guncel && `${guncel} firma güncellendi`].filter(Boolean).join(', ') + '.');
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Firmalar</h1>
                <div className="page-header-actions">
                    <button className="btn btn-ghost" onClick={firmaSablonuIndir} title="Excel şablonunu indir">
                        <Download size={16} /> Şablon
                    </button>
                    <button className="btn btn-success" onClick={() => dosyaRef.current?.click()} title="Excel (.xlsx) veya CSV'den firma aktar">
                        <Upload size={16} /> Excel Aktar
                    </button>
                    <button className="btn btn-primary" onClick={openAdd}>
                        <Plus size={18} /> Firma Ekle
                    </button>
                </div>
                <input ref={dosyaRef} type="file" accept=".xlsx,.xlsm,.csv,.txt" style={{ display: 'none' }} onChange={handleDosyaSec} />
            </div>

            {/* Arama */}
            <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    placeholder="Firma adı, yetkili veya telefon ara..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Filter Tabs */}
            <div className="filter-row">
                {TIPLER.map(t => (
                    <button
                        key={t.value}
                        className={`filter-btn ${filter === t.value ? 'active' : ''}`}
                        onClick={() => setFilter(t.value)}
                    >
                        {t.label}
                    </button>
                ))}
                {pasifSayisi > 0 && (
                    <button
                        className={`filter-btn ${pasifleriGoster ? 'active' : ''}`}
                        onClick={() => setPasifleriGoster(v => !v)}
                        style={{ marginLeft: 'auto' }}
                    >
                        <Power size={14} /> Pasifleri göster ({pasifSayisi})
                    </button>
                )}
            </div>

            {/* Firma List */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><FirmaSvg size={48} /></div>
                    <div className="empty-state-title">Firma bulunamadı</div>
                    <div className="empty-state-text">{!pasifleriGoster && pasifSayisi > 0 ? 'Pasif firmalar gizli — "Pasifleri göster" ile listeleyebilirsiniz' : 'Yeni bir firma ekleyerek başlayın'}</div>
                    <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Firma Ekle</button>
                </div>
            ) : (
                <div className="mobile-list">
                    {filtered.map(firma => {
                        const perf = getFirmaPerformans(firma.id);
                        const badge = getPerfBadge(perf.skor);
                        return (
                            <div key={firma.id} className={`mobile-list-item ${firmaAktifMi(firma) ? '' : 'firma-pasif'}`} style={{ cursor: 'pointer' }} onClick={() => navigate(`/cari/${firma.id}`)}>
                                <div className="mobile-list-item-header">
                                    <span className="mobile-list-item-title">{firma.ad}</span>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        {perf.toplamIs > 0 && (
                                            <span className={`perf-badge ${badge.cls}`}>{badge.label}</span>
                                        )}
                                        {!firmaAktifMi(firma) && <span className="badge pasif">Pasif</span>}
                                        <span className={`badge ${firmaRozetSinifi(firma.tip)}`}>
                                            {FIRMA_TIP_LABELS[firma.tip]}
                                        </span>
                                    </div>
                                </div>
                                <div className="mobile-list-item-meta">
                                    {firma.yetkiliKisi && <span><User size={13} style={{ verticalAlign: 'middle' }} /> {firma.yetkiliKisi}</span>}
                                    {firma.telefon && <span><Phone size={13} style={{ verticalAlign: 'middle' }} /> {firma.telefon}</span>}
                                    {firma.adres && <span><MapPin size={13} style={{ verticalAlign: 'middle' }} /> {firma.adres}</span>}
                                    {firma.odemeVadesi && <span><Calendar size={13} style={{ verticalAlign: 'middle' }} /> Vade: Ayın {firma.odemeVadesi}'i</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem' }}>
                                        <span className="text-muted">
                                            Aktif: <strong style={{ color: 'var(--accent-info)' }}>{getAktifPartiSayisi(firma.id)}</strong>
                                        </span>
                                        {perf.toplamIs > 0 && (
                                            <>
                                                <span className="text-muted">
                                                    Fire: <strong style={{ color: parseFloat(perf.fireOrani) > 5 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>{perf.fireOrani}%</strong>
                                                </span>
                                                <span className="text-muted">
                                                    Ort: <strong>{perf.ortTeslimSuresi} gün</strong>
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        <button className="btn-icon" onClick={() => openEdit(firma)}><Edit2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {modal && (
                <Modal
                    title={editId ? 'Firma Düzenle' : 'Yeni Firma Ekle'}
                    onClose={() => setModal(null)}
                    footer={
                        <>
                            {editId && (
                                <button className="btn btn-ghost" onClick={handleModalSil} style={{ color: 'var(--accent-danger)', marginRight: 'auto' }}>
                                    <Trash2 size={15} /> Sil
                                </button>
                            )}
                            <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
                            <button className="btn btn-primary" onClick={handleSave}>Kaydet</button>
                        </>
                    }
                >
                    <div className="form-group">
                        <label className="form-label">Firma Adı *</label>
                        <input className="form-input" value={form.ad} onChange={e => updateField('ad', e.target.value)} placeholder="Firma adı girin" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Firma Tipi</label>
                        <select className="form-input" value={form.tip} onChange={e => updateField('tip', e.target.value)}>
                            {TIPLER.filter(t => t.value !== 'all').map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Yetkili Kişi</label>
                            <input className="form-input" value={form.yetkiliKisi} onChange={e => updateField('yetkiliKisi', e.target.value)} placeholder="Ad Soyad" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Telefon</label>
                            <input className="form-input" value={form.telefon} onChange={e => updateField('telefon', e.target.value)} placeholder="0532 000 0000" type="tel" />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Adres</label>
                            <input className="form-input" value={form.adres} onChange={e => updateField('adres', e.target.value)} placeholder="Adres" />
                        </div>
                        {form.tip !== 'kumasci' && (
                            <div className="form-group">
                                <label className="form-label">Günlük Kapasite (adet)</label>
                                <input className="form-input" type="number" min="0" value={form.gunlukKapasite} onChange={e => updateField('gunlukKapasite', parseInt(e.target.value, 10) || '')} placeholder="Örn: 200" />
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label">Ödeme Vadesi (Ayın Kaçı)</label>
                        <input className="form-input" type="number" min="1" max="31" value={form.odemeVadesi || ''} onChange={e => updateField('odemeVadesi', e.target.value)} placeholder="Örn: 20 (Ayın 20'si)" />
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Her ayın bu gününde ödeme vadesi gelir. Boş bırakılırsa vade takibi yapılmaz.</div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notlar</label>
                        <textarea className="form-input" rows={3} value={form.notlar} onChange={e => updateField('notlar', e.target.value)} placeholder="Ek notlar..." />
                    </div>
                    {form.tip === 'kumasci' && (
                        <Notice tone="info">Kumaş tedarikçileri Kumaş Stok ekranında "Geldiği Firma" olarak seçilir; fiyat girilen kumaş girişleri bu firmanın carisine borç olarak yazılır.</Notice>
                    )}
                    {editId && (
                        <div className="form-group" style={{ marginTop: '12px' }}>
                            <label className="firma-aktif-anahtar">
                                <input type="checkbox" checked={form.aktif !== false} onChange={e => updateField('aktif', e.target.checked)} />
                                <span>
                                    <strong>Firma aktif</strong>
                                    <small>Pasif firmalar yeni parti, irsaliye ve kumaş girişlerinde seçilemez; geçmiş kayıtları ve carisi korunur.</small>
                                </span>
                            </label>
                            {form.aktif === false && duzenlenenAktifParti > 0 && (
                                <Notice tone="warning">Bu firmada {duzenlenenAktifParti} devam eden parti var. Pasife alınca bu partiler etkilenmez, ancak firma yeni işlerde seçilemez.</Notice>
                            )}
                        </div>
                    )}
                </Modal>
            )}
            {aktarSatirlari && (
                <Modal
                    title={`Excel'den Firma Aktarma (${aktarilacak.length} firma)`}
                    onClose={() => setAktarSatirlari(null)}
                    genis
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setAktarSatirlari(null)}>İptal</button>
                            <button className="btn btn-success" onClick={handleAktarOnay}>
                                <Upload size={16} /> {aktarilacak.length} Firmayı Aktar
                            </button>
                        </>
                    }
                >
                    {tipsizSayisi > 0 && (
                        <div className="aktar-varsayilan">
                            <span>Türü boş veya tanınmayan {tipsizSayisi} firma şu türle eklensin:</span>
                            <select className="form-input" value={varsayilanTip} onChange={e => setVarsayilanTip(e.target.value)}>
                                {FIRMA_TIPLERI.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="aktar-tablo">
                        <table>
                            <thead>
                                <tr><th>#</th><th>Firma Adı</th><th>Türü</th><th>Yetkili</th><th>Telefon</th><th>Adres</th><th>Durum</th></tr>
                            </thead>
                            <tbody>
                                {aktarilacak.map((f, i) => (
                                    <tr key={i}>
                                        <td className="aktar-sira">{i + 1}</td>
                                        <td><strong>{f.ad}</strong></td>
                                        <td>
                                            <span className={`badge ${firmaRozetSinifi(f.mevcut && !f.tipVerildi ? f.mevcut.tip : f.tip)}`}>
                                                {firmaTipi(f.mevcut && !f.tipVerildi ? f.mevcut.tip : f.tip)?.kisa}
                                            </span>
                                            {!f.tipVerildi && !f.mevcut && <div className="aktar-uyari">{f.tipMetni ? `"${f.tipMetni}" tanınmadı` : 'Tür boş'}</div>}
                                        </td>
                                        <td>{f.yetkiliKisi || '-'}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{f.telefon || '-'}</td>
                                        <td className="aktar-adres">{f.adres || '-'}</td>
                                        <td><span className={`badge ${f.mevcut ? 'dikimde' : 'tamamlandi'}`}>{f.mevcut ? 'Güncellenecek' : 'Yeni'}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="aktar-bilgi">
                        Aynı adlı firma zaten kayıtlıysa yeni firma açılmaz; dosyada dolu olan bilgileri (telefon, adres, yetkili...) güncellenir.
                    </div>
                </Modal>
            )}
        </div>
    );
}

function FirmaSvg(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M17 18h1" /><path d="M12 18h1" /><path d="M7 18h1" /></svg>
    );
}
