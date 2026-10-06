import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Settings, Sun, Moon, Database, Download, Upload, RefreshCw, Shield, Info, Bell, BellOff, Send } from 'lucide-react';
import { pushDestekliMi, pushDurumu, pushAc, pushKapat, pushTest, iosKuruluDegilMi } from '../data/push';

export default function Ayarlar() {
    const { tema, toggleTema, yedekIndir, yedekYukle, refresh } = useApp();
    const [mesaj, setMesaj] = useState(null); // { tip: 'ok'|'hata', metin }
    const [bildirimDurum, setBildirimDurum] = useState('kontrol'); // kontrol|acik|kapali|engellendi|desteklenmiyor
    const [bildirimBusy, setBildirimBusy] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        pushDurumu().then(setBildirimDurum);
    }, []);

    const handleBildirimAc = async () => {
        setBildirimBusy(true);
        try {
            await pushAc();
            setBildirimDurum('acik');
            showMesaj('ok', 'Telefon bildirimleri açıldı! Test göndererek deneyebilirsiniz.');
        } catch (err) {
            showMesaj('hata', err.message);
            setBildirimDurum(await pushDurumu());
        } finally {
            setBildirimBusy(false);
        }
    };

    const handleBildirimKapat = async () => {
        setBildirimBusy(true);
        try {
            await pushKapat();
            setBildirimDurum('kapali');
            showMesaj('ok', 'Bu cihaz için bildirimler kapatıldı.');
        } catch (err) {
            showMesaj('hata', err.message);
        } finally {
            setBildirimBusy(false);
        }
    };

    const handleBildirimTest = async () => {
        setBildirimBusy(true);
        try {
            await pushTest();
            showMesaj('ok', 'Test bildirimi gönderildi — birkaç saniye içinde cihazınıza düşmeli.');
        } catch (err) {
            showMesaj('hata', err.message);
        } finally {
            setBildirimBusy(false);
        }
    };

    const showMesaj = (tip, metin) => {
        setMesaj({ tip, metin });
        setTimeout(() => setMesaj(null), 5000);
    };

    const handleYedekIndir = () => {
        yedekIndir();
        showMesaj('ok', 'Yedek dosyası indirildi.');
    };

    const handleYedekSec = () => fileInputRef.current?.click();

    const handleYedekYukle = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // aynı dosya tekrar seçilebilsin
        if (!file) return;
        if (!confirm('DİKKAT: Yedekteki veriler mevcut verilerin ÜZERİNE yazılacak. Devam etmek istiyor musunuz?')) return;
        try {
            const text = await file.text();
            const n = await yedekYukle(text);
            showMesaj('ok', `Yedek başarıyla geri yüklendi (${n} veri grubu).`);
        } catch (err) {
            showMesaj('hata', 'Geri yükleme başarısız: ' + err.message);
        }
    };

    return (
        <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Settings size={20} /> Ayarlar
            </h2>

            <div style={{ display: 'grid', gap: '20px', maxWidth: '700px' }}>

                {import.meta.env.VITE_DEMO === '1' && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title"><Database size={18} /> Demo</h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            Bu bir demodur. Değişiklikleriniz sadece bu tarayıcıda saklanır.
                            Örnek verilere dönmek için demoyu sıfırlayın.
                        </p>
                        <button className="btn btn-ghost" onClick={async () => {
                            const { demoSifirla } = await import('../data/demoSunucu');
                            demoSifirla();
                            window.location.reload();
                        }}>Demoyu Sıfırla</button>
                    </div>
                )}

                {/* Görünüm */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">{tema === 'light' ? <Sun size={18} /> : <Moon size={18} />} Görünüm</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Tema</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                Şu an: {tema === 'light' ? 'Aydınlık Mod' : 'Karanlık Mod'}
                            </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={toggleTema}>
                            {tema === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                            {tema === 'light' ? ' Karanlık Mod' : ' Aydınlık Mod'}
                        </button>
                    </div>
                </div>

                {/* Veri Yönetimi */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Database size={18} /> Veri Yönetimi</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Verileri Yenile</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sunucudan güncel verileri tekrar çek</div>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => { refresh(); showMesaj('ok', 'Veriler yenilendi.'); }}>
                                <RefreshCw size={16} /> Yenile
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Yedek İndir (JSON)</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tüm verilerin tam yedeğini bilgisayarınıza indirin</div>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={handleYedekIndir}>
                                <Download size={16} /> Yedek İndir
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Yedekten Geri Yükle</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Daha önce indirdiğiniz JSON yedeği geri yükleyin (mevcut verinin üzerine yazar)</div>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={handleYedekSec}>
                                <Upload size={16} /> Geri Yükle
                            </button>
                            <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleYedekYukle} />
                        </div>
                        {mesaj && (
                            <div style={{
                                padding: '8px 12px', borderRadius: '4px', fontSize: '0.8rem',
                                background: mesaj.tip === 'ok' ? 'rgba(16,124,16,0.08)' : 'rgba(196,49,75,0.08)',
                                border: mesaj.tip === 'ok' ? '1px solid rgba(16,124,16,0.2)' : '1px solid rgba(196,49,75,0.25)',
                                color: mesaj.tip === 'ok' ? '#107c10' : '#c4314b',
                            }}>
                                {mesaj.tip === 'ok' ? '✓ ' : '⚠ '}{mesaj.metin}
                            </div>
                        )}
                    </div>
                </div>

                {/* Telefon Bildirimleri */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Bell size={18} /> Telefon Bildirimleri</h3>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        Parti tamamlanma, yüksek fire ve irsaliye teslimi gibi bildirimler uygulama kapalıyken bile telefonunuza düşer.
                    </div>

                    {bildirimDurum === 'desteklenmiyor' && (
                        <div style={{ padding: '10px 12px', background: 'rgba(196,49,75,0.08)', border: '1px solid rgba(196,49,75,0.25)', borderRadius: '4px', fontSize: '0.8rem', color: '#c4314b' }}>
                            {iosKuruluDegilMi()
                                ? 'iPhone\'da bildirimler için uygulamayı ana ekrana ekleyin: Safari → Paylaş → "Ana Ekrana Ekle". Sonra uygulamayı ana ekrandaki simgeden açın — bu ayar burada görünecektir. (iOS 16.4 veya üzeri gerekir)'
                                : 'Bu tarayıcı push bildirimlerini desteklemiyor.'}
                        </div>
                    )}

                    {bildirimDurum === 'engellendi' && (
                        <div style={{ padding: '10px 12px', background: 'rgba(196,49,75,0.08)', border: '1px solid rgba(196,49,75,0.25)', borderRadius: '4px', fontSize: '0.8rem', color: '#c4314b' }}>
                            Bildirim izni daha önce reddedilmiş. Tarayıcı/telefon ayarlarından bu site için bildirimlere izin verip sayfayı yenileyin.
                        </div>
                    )}

                    {(bildirimDurum === 'kapali' || bildirimDurum === 'kontrol') && (
                        <button className="btn btn-primary btn-sm" onClick={handleBildirimAc} disabled={bildirimBusy || bildirimDurum === 'kontrol'}>
                            <Bell size={15} /> Bu Cihazda Bildirimleri Aç
                        </button>
                    )}

                    {bildirimDurum === 'acik' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#107c10', fontWeight: 600 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#107c10' }} /> Bildirimler açık
                            </span>
                            <button className="btn btn-ghost btn-sm" onClick={handleBildirimTest} disabled={bildirimBusy}>
                                <Send size={14} /> Test Gönder
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={handleBildirimKapat} disabled={bildirimBusy} style={{ color: 'var(--accent-danger)' }}>
                                <BellOff size={14} /> Kapat
                            </button>
                        </div>
                    )}
                </div>

                {/* Güvenlik */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Shield size={18} /> Güvenlik</h3>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        <p>Kullanıcı yetkilendirmesi <strong>Kullanıcılar</strong> sayfasından yönetilir. Her kullanıcıya rol atayabilir ve hangi sayfalara erişebileceğini belirleyebilirsiniz.</p>
                        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.82rem' }}>Rol Yetkileri:</div>
                            <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                <li><strong>Yönetici:</strong> Tüm sayfalara tam erişim</li>
                                <li><strong>Üretim Sorumlusu:</strong> Partiler, iş akışı, stok</li>
                                <li><strong>Muhasebe:</strong> Cari hesaplar, raporlar</li>
                                <li><strong>Fasoncu:</strong> Özelleştirilebilir — sadece izin verilen sayfalar</li>
                                <li><strong>İzleyici:</strong> Sadece görüntüleme</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Hakkında */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Info size={18} /> Hakkında</h3>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '0.8rem' }}>
                            <span style={{ fontWeight: 600 }}>Uygulama:</span><span>HiS ERP</span>
                            <span style={{ fontWeight: 600 }}>Versiyon:</span><span>2.0.0</span>
                            <span style={{ fontWeight: 600 }}>Platform:</span><span>React + PHP + MySQL</span>
                            <span style={{ fontWeight: 600 }}>Tema:</span><span>Microsoft Dynamics 365</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
