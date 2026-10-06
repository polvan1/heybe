import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Modal from '../components/Modal';
import { ArrowLeft, CheckCircle, Wallet, CreditCard, Eye, Printer, History, ClipboardCheck, AlertCircle, Star, Download } from 'lucide-react';
import { FIRMA_TIP_LABELS, DURUM_LABELS, exportToCSV } from '../data/db';

export default function CariDetay() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { firmalar, cariHareketler, cariHareketEkle, partiler, getFirmaBakiye, setHareketlerHesaplandi, getFirmaPerformans } = useApp();

    const [selectedPartiler, setSelectedPartiler] = useState([]);
    const [showHesapModal, setShowHesapModal] = useState(false);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'

    const firma = firmalar.find(f => f.id === id);
    if (!firma) {
        return (
            <div className="empty-state animate-fade-in">
                <div className="empty-state-title">Firma bulunamadı</div>
                <button className="btn btn-primary mt-4" onClick={() => navigate('/cari-hesaplar')}>Geri Dön</button>
            </div>
        );
    }

    const bakiyeInfo = getFirmaBakiye(id);

    // Tüm hareketler
    const tumHareketler = cariHareketler
        .filter(h => h.firmaId === id)
        .sort((a, b) => new Date(b.tarih || b.createdAt) - new Date(a.tarih || a.createdAt));

    // Bekleyen Borçlar (Hesaplanmamış Borçlar)
    const bekleyenBorclar = tumHareketler.filter(h => h.tip === 'borc' && !h.hesaplandi);

    // Genel Ödeme Havuzu (Hesaplanmamış Alacaklar)
    const odemeHavuzu = tumHareketler.filter(h => h.tip === 'alacak' && !h.hesaplandi);
    const toplamOdemeHavuzu = odemeHavuzu.reduce((t, h) => t + (Number(h.tutar) || 0), 0);

    // Geçmiş (Kapatılmış) Hareketler
    const gecmisHareketler = tumHareketler.filter(h => h.hesaplandi);

    // Bekleyen işleri parti bazlı grupla (UI uyumluluğu için)
    const pendingWork = bekleyenBorclar.map(h => {
        const p = partiler.find(parti => parti.id === h.partiId);
        if (!p) return null;

        let rol = '';
        let birimFiyat = 0;
        if (p.kesimhaneId === id) { rol = 'Kesim'; birimFiyat = p.kesimBirimFiyat || 0; }
        if (p.dikimhaneId === id) { rol = 'Dikim'; birimFiyat = p.dikimBirimFiyat || 0; }
        if (p.utupaketciId === id) { rol = 'Ütü/Paket'; birimFiyat = p.utuBirimFiyat || 0; }

        return {
            id: h.id, // Hareket ID'si
            partiId: p.id,
            parti: p,
            rol,
            birimFiyat,
            borc: h.tutar,
            tarih: h.tarih || h.createdAt
        };
    }).filter(Boolean);

    const seciliHesaplar = pendingWork.filter(h => selectedPartiler.includes(h.id));
    const seciliToplamServisBedeli = seciliHesaplar.reduce((t, h) => t + (Number(h.borc) || 0), 0);
    const netBakiye = seciliToplamServisBedeli - toplamOdemeHavuzu;

    const togglePartiSecim = (hareketId) => {
        setSelectedPartiler(prev =>
            prev.includes(hareketId)
                ? prev.filter(id => id !== hareketId)
                : [...prev, hareketId]
        );
    };

    const toggleTumunuSec = () => {
        if (selectedPartiler.length === pendingWork.length) {
            setSelectedPartiler([]);
        } else {
            setSelectedPartiler(pendingWork.map(h => h.id));
        }
    };

    // HESABI KAPAT MANTIĞI
    const handleHesabıKapat = () => {
        // 1. Seçili borçları 'hesaplandi' olarak işaretle
        setHareketlerHesaplandi(selectedPartiler);

        // 2. Ödeme havuzunu 'hesaplandi' olarak işaretle (çünkü bu hesapta kullanıldı)
        setHareketlerHesaplandi(odemeHavuzu.map(h => h.id));

        // 3. Eğer Borç > Ödeme ise, aradaki fark kadar yeni bir ödeme (alacak) kaydı gir
        // Bu, Borç ile Ödeme'yi eşitleyip hesabı sıfırlamış gibi yapar.
        // Eğer Borç <= Ödeme ise, sadece borçlar ve kullanılan ödemeler kapanır, kalan ödeme (varsa) devretmez çünkü 
        // havuzu komple kapatıyoruz. Ancak istekte "devretmeli" deniyor.
        // DÜZELTME: Sadece borcu kapatacak kadar ödemeyi kapatıp, artanı bırakabiliriz ama basitlik için:

        if (netBakiye > 0) {
            // Borçluyuz, bu hesabı kapatmak için ödeme yapılmış sayıyoruz (veya farkı ödüyoruz)
            cariHareketEkle({
                firmaId: id,
                tip: 'alacak',
                tutar: netBakiye,
                aciklama: `Hesap Kapatma Fark Ödemesi (${selectedPartiler.length} İş)`,
                tarih: new Date().toISOString().split('T')[0],
                hesaplandi: true, // BU HESABI KAPATTIĞI İÇİN ARŞİVE ALINMALI
                hesapTarihi: new Date().toISOString()
            });
        } else if (netBakiye < 0) {
            // Alacaklıyız (fasoncu bize borçlu)
            // Eğer devir geçmesini İSTEMİYORSAK burayı hesaplandi: true yapıyoruz.
            // Fakat önceki isteğinizde "devretmeli" dediğiniz için:
            // Kullanıcı son mesajında "devir geçmemesi gerekiyordu" dediği için bunu da kapatıyoruz.
            cariHareketEkle({
                firmaId: id,
                tip: 'alacak',
                tutar: Math.abs(netBakiye),
                aciklama: 'Önceki Hesaptan Devreden Alacak (Kapatıldı)',
                tarih: new Date().toISOString().split('T')[0],
                hesaplandi: true,
                hesapTarihi: new Date().toISOString()
            });
        }

        setSelectedPartiler([]);
        setShowHesapModal(false);
        setActiveTab('history');
    };

    const formatMonthDay = (dateStr) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=800,height=900');
        const content = `
            <html>
                <head>
                    <title>Cari Ekstre - ${firma.ad}</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #333; line-height: 1.4; }
                        .header { border-bottom: 3px solid #1d4ed8; margin-bottom: 25px; padding-bottom: 15px; }
                        .header h1 { margin: 0; font-size: 28px; color: #1d4ed8; }
                        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .info-box { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                        h2 { font-size: 18px; color: #1e293b; border-left: 4px solid #1d4ed8; padding-left: 10px; margin: 30px 0 15px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                        th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
                        th { background: #f1f5f9; font-weight: 700; color: #475569; }
                        tr:nth-child(even) { background-color: #f8fafc; }
                        .total-row { font-weight: 800; background: #f1f5f9 !important; font-size: 14px; }
                        .summary-card { margin-top: 30px; padding: 20px; background: #1e293b; color: #fff; border-radius: 8px; text-align: right; }
                        .summary-item { font-size: 14px; margin-bottom: 5px; opacity: 0.8; }
                        .summary-total { font-size: 24px; font-weight: 800; }
                        .footer { margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>CARİ HESAP EKSTRESİ</h1>
                        <p style="margin: 5px 0 0 0; color: #64748b;">${new Date().toLocaleString('tr-TR')} tarihinde oluşturuldu</p>
                    </div>

                    <div class="info-grid">
                        <div class="info-box">
                            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 5px;">FİRMA BİLGİLERİ</div>
                            <div style="font-size: 16px; font-weight: 700;">${firma.ad}</div>
                            <div style="font-size: 13px; color: #475569;">${FIRMA_TIP_LABELS[firma.tip]}</div>
                        </div>
                        <div class="info-box" style="text-align: right;">
                            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 5px;">HESAP ÖZETİ</div>
                            <div style="font-size: 14px;">Servis Toplamı: ${seciliToplamServisBedeli.toLocaleString('tr-TR')} ₺</div>
                            <div style="font-size: 14px;">Ödenen/Bakiye: ${toplamOdemeHavuzu.toLocaleString('tr-TR')} ₺</div>
                            <div style="font-size: 20px; font-weight: 800; color: ${netBakiye > 0 ? '#ef4444' : '#10b981'}; margin-top: 5px;">
                                Kalan: ${netBakiye.toLocaleString('tr-TR')} ₺
                            </div>
                        </div>
                    </div>

                    <h2>BORÇLANDIRILAN İŞLER (SERVİS BEDELLERİ)</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Tarih</th>
                                <th>Parti No</th>
                                <th>Ürün / İşlem</th>
                                <th style="text-align: right;">Birim Fiyat</th>
                                <th style="text-align: right;">Toplam Tutar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${seciliHesaplar.map(h => `
                                <tr>
                                    <td>${new Date(h.tarih).toLocaleDateString('tr-TR')}</td>
                                    <td style="font-weight: 600;">${h.parti.partiNo}</td>
                                    <td>${h.parti.urunAdi} [${h.rol}]</td>
                                    <td style="text-align: right;">${Number(h.birimFiyat).toLocaleString('tr-TR')} ₺</td>
                                    <td style="text-align: right; font-weight: 600;">${Number(h.borc).toLocaleString('tr-TR')} ₺</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <h2>YAPILAN ÖDEMELER (TAHSİLATLAR)</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Tarih</th>
                                <th>Açıklama</th>
                                <th style="text-align: right;">Tutar</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${odemeHavuzu.map(h => `
                                <tr>
                                    <td>${new Date(h.tarih).toLocaleDateString('tr-TR')}</td>
                                    <td>${h.aciklama}</td>
                                    <td style="text-align: right;">${Number(h.tutar).toLocaleString('tr-TR')} ₺</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="summary-card">
                        <div class="summary-total">NET ÖDENECEK: ${netBakiye.toLocaleString('tr-TR')} ₺</div>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <button className="btn-icon" onClick={() => navigate('/cari-hesaplar')}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{ flex: 1 }}>
                    <h1 className="page-title" style={{ fontSize: '1.3rem', marginBottom: '2px' }}>{firma.ad}</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge ${firma.tip === 'atolye' ? 'dikimde' : firma.tip === 'kesimhane' ? 'kesimde' : firma.tip === 'baskici' ? 'baskida' : 'utupakette'}`}>
                            {FIRMA_TIP_LABELS[firma.tip]}
                        </span>
                    </div>
                </div>
            </div>

            {/* Bakiye Özeti */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div className="text-xs text-muted">AÇIK HESAP BAKİYESİ</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: bakiyeInfo.bakiye > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                                {bakiyeInfo.bakiye.toLocaleString('tr-TR')} ₺
                            </div>
                        </div>
                        <AlertCircle size={20} className="text-muted" />
                    </div>
                    <div className="text-xs text-muted mt-2">Bu tutar henüz "Hesabı Kapat" işlemi yapılmamış borç ve ödemelerin farkıdır.</div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <div className="text-xs text-muted" style={{ marginBottom: '8px' }}>AKSİYONLAR</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => navigate('/cari-hesaplar')}>
                            <Wallet size={14} /> Hızlı Ödeme Girişi
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={handlePrint}>
                            <Printer size={14} /> Son Durum Çıktısı
                        </button>
                    </div>
                </div>
            </div>

            {/* Firma Karnesi */}
            {(() => {
                const perf = getFirmaPerformans(id);
                if (perf.toplamIs === 0) return null;
                const badgeCls = perf.skor >= 85 ? 'excellent' : perf.skor >= 70 ? 'good' : perf.skor >= 50 ? 'average' : 'poor';
                return (
                    <div className="card" style={{ marginBottom: '20px' }}>
                        <div className="card-header">
                            <h3 className="card-title"><Star size={16} /> Firma Karnesi</h3>
                            <span className={`perf-badge ${badgeCls}`}>Skor: {perf.skor}/100</span>
                        </div>
                        <div className="cari-karne-grid">
                            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                <div className="text-xs text-muted">Toplam İş</div>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{perf.toplamIs}</div>
                            </div>
                            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                <div className="text-xs text-muted">Fire</div>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: parseFloat(perf.fireOrani) > 5 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>%{perf.fireOrani}</div>
                            </div>
                            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                <div className="text-xs text-muted">Ort. Süre</div>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{perf.ortTeslimSuresi} gün</div>
                            </div>
                            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                <div className="text-xs text-muted">Tamamlanan</div>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>%{perf.tamamlanmaOrani}</div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Tabs */}
            <div className="filter-row" style={{ marginBottom: '16px' }}>
                <button className={`filter-btn ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                    <ClipboardCheck size={16} /> Açık İşler ({pendingWork.length})
                </button>
                <button className={`filter-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                    <History size={16} /> Geçmiş Hesaplar
                </button>
            </div>

            <div className={`cari-detay-grid ${activeTab === 'pending' ? 'iki-sutun' : ''}`}>

                {/* SOL TARAF: İş Listesi veya Geçmiş */}
                <div className="cari-detay-main">
                    {activeTab === 'pending' ? (
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Kapanmamış İşler</h3>
                                {pendingWork.length > 0 && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setShowHesapModal(true)} disabled={selectedPartiler.length === 0}>
                                        <Eye size={14} /> Hesabı Gör ({selectedPartiler.length})
                                    </button>
                                )}
                            </div>

                            {pendingWork.length === 0 ? (
                                <div className="p-8 text-center text-muted">Açıkta bekleyen iş bulunmuyor.</div>
                            ) : (
                                <div className="table-container" style={{ border: 'none' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ width: '40px' }}>
                                                    <input type="checkbox" checked={selectedPartiler.length === pendingWork.length} onChange={toggleTumunuSec} />
                                                </th>
                                                <th>Tarih</th>
                                                <th>Parti / Ürün</th>
                                                <th>İşlem</th>
                                                <th style={{ textAlign: 'right' }}>Tutar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendingWork.map(h => (
                                                <tr key={h.id} onClick={() => togglePartiSecim(h.id)} style={{ cursor: 'pointer', background: selectedPartiler.includes(h.id) ? 'rgba(37,99,235,0.04)' : '' }}>
                                                    <td><input type="checkbox" checked={selectedPartiler.includes(h.id)} readOnly /></td>
                                                    <td className="text-xs">{formatMonthDay(h.tarih)}</td>
                                                    <td>
                                                        <div className="font-semibold text-sm">{h.parti.partiNo}</div>
                                                        <div className="text-xs text-muted">{h.parti.urunAdi}</div>
                                                    </td>
                                                    <td><span className="badge devam" style={{ fontSize: '0.65rem' }}>{h.rol}</span></td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }} className="text-sm">
                                                        {Number(h.borc).toLocaleString('tr-TR')} ₺
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Hesaplanmış Geçmiş Hareketler</h3>
                            </div>
                            <div className="table-container" style={{ border: 'none' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Tarih</th>
                                            <th>Tür</th>
                                            <th>Açıklama</th>
                                            <th style={{ textAlign: 'right' }}>Tutar</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gecmisHareketler.map(h => (
                                            <tr key={h.id} style={{ opacity: 0.7 }}>
                                                <td className="text-xs">{formatMonthDay(h.tarih || h.createdAt)}</td>
                                                <td><span className={`badge ${h.tip === 'borc' ? 'kritik' : 'normal'}`}>{h.tip === 'borc' ? 'Borç' : 'Ödeme'}</span></td>
                                                <td className="text-xs">{h.aciklama}</td>
                                                <td style={{ textAlign: 'right' }} className="text-sm font-bold">{Number(h.tutar).toLocaleString('tr-TR')} ₺</td>
                                                <td><CheckCircle size={14} className="text-success" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* SAĞ TARAF: Ödeme Havuzu (Sadece Bekleyen Tabında) */}
                {activeTab === 'pending' && (
                    <div className="cari-detay-side">
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title text-sm"><CreditCard size={16} /> Ödeme Havuzu</h3>
                            </div>
                            <div className="p-4 bg-primary text-white text-center rounded-sm mx-4 my-2">
                                <div className="text-xs opacity-80">BU AY YAPILAN TOPLAM ÖDEME</div>
                                <div className="text-xl font-bold">{toplamOdemeHavuzu.toLocaleString('tr-TR')} ₺</div>
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {odemeHavuzu.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-muted">Bu ay henüz ödeme girilmedi.</div>
                                ) : (
                                    odemeHavuzu.map(h => (
                                        <div key={h.id} className="p-3 border-bottom">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold">{formatMonthDay(h.tarih)}</span>
                                                <span className="text-sm font-bold text-success">{Number(h.tutar).toLocaleString('tr-TR')} ₺</span>
                                            </div>
                                            <div className="text-xs text-muted">{h.aciklama}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* HESAP ÖZET/GÖR MODALI */}
            {showHesapModal && (
                <Modal
                    title="Hesap Uzlaşma Özeti"
                    onClose={() => setShowHesapModal(false)}
                    footer={
                        <>
                            <button className="btn btn-ghost" onClick={() => setShowHesapModal(false)}>İptal</button>
                            <button className="btn btn-outline" onClick={handlePrint}><Printer size={16} /> Yazdır</button>
                            <button className="btn btn-primary" onClick={handleHesabıKapat}>
                                <ClipboardCheck size={16} /> Hesabı Kapat ve Uzlaş
                            </button>
                        </>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="p-3 bg-muted rounded-sm text-center">
                                <div className="text-xs text-muted">SEÇİLİ İŞLER TOPLAMI</div>
                                <div className="text-lg font-bold">{seciliToplamServisBedeli.toLocaleString('tr-TR')} ₺</div>
                            </div>
                            <div className="p-3 bg-muted rounded-sm text-center">
                                <div className="text-xs text-muted">YAPILAN ÖDEMELER</div>
                                <div className="text-lg font-bold text-success">{toplamOdemeHavuzu.toLocaleString('tr-TR')} ₺</div>
                            </div>
                        </div>

                        <div className={`p-4 rounded-sm text-center ${netBakiye > 0 ? 'bg-danger-light' : 'bg-success-light'}`}>
                            <div className="text-sm font-semibold">{netBakiye >= 0 ? 'KALAN BORCUNUZ' : 'FAZLA ÖDEMENİZ (ALACAK)'}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: netBakiye > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                                {Math.abs(netBakiye).toLocaleString('tr-TR')} ₺
                            </div>
                        </div>

                        <div className="text-xs text-muted p-3 border rounded-sm">
                            <ul style={{ paddingLeft: '16px', margin: 0 }}>
                                <li>Seçilen {selectedPartiler.length} adet parti borcu arşivlenecek.</li>
                                <li>Mevcut {odemeHavuzu.length} adet ödeme bu hesapla ilişkilendirilip kapatılacak.</li>
                                <li>{netBakiye > 0 ? 'Kalan bakiye kadar yeni bir borç kapama ödemesi girilecek.' : 'Aradaki fark yeni ay için devir ödemesi olarak kaydedilecek.'}</li>
                            </ul>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
