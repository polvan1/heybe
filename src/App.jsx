import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import { useApp } from './context/AppContext';
import { hasYetki, firstAllowedRoute } from './data/yetki';
import { WifiOff } from 'lucide-react';

// Sayfa bazlı code splitting: her sayfa ayrı chunk olarak yüklenir
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Firmalar = lazy(() => import('./pages/Firmalar'));
const Urunler = lazy(() => import('./pages/Urunler'));
const Partiler = lazy(() => import('./pages/Partiler'));
const PartiDetay = lazy(() => import('./pages/PartiDetay'));
const IsAkisi = lazy(() => import('./pages/IsAkisi'));
const CariHesaplar = lazy(() => import('./pages/CariHesaplar'));
const CariDetay = lazy(() => import('./pages/CariDetay'));
const IsTalepTakvimi = lazy(() => import('./pages/IsTalepTakvimi'));
const Raporlar = lazy(() => import('./pages/Raporlar'));
const StokTakibi = lazy(() => import('./pages/StokTakibi'));
const Irsaliyeler = lazy(() => import('./pages/Irsaliyeler'));
const Kullanicilar = lazy(() => import('./pages/Kullanicilar'));
const Ayarlar = lazy(() => import('./pages/Ayarlar'));
const Islerim = lazy(() => import('./pages/Islerim'));
const IslemGunlugu = lazy(() => import('./pages/IslemGunlugu'));
const KumasStok = lazy(() => import('./pages/KumasStok'));

const PAGE_TITLES = {
    '/': 'Anasayfa',
    '/islerim': 'İşlerim',
    '/islem-gunlugu': 'İşlem Günlüğü',
    '/firmalar': 'Firmalar',
    '/urunler': 'Ürünler',
    '/partiler': 'Partiler',
    '/is-akisi': 'İş Akışı',
    '/stok-takibi': 'Stok Takibi',
    '/kumas-stok': 'Kumaş Stok',
    '/irsaliyeler': 'İrsaliyeler',
    '/is-talep-takvimi': 'Takvim',
    '/cari-hesaplar': 'Cari Hesaplar',
    '/raporlar': 'Raporlar',
    '/kullanicilar': 'Kullanıcılar',
    '/ayarlar': 'Ayarlar',
};

function PageLoader() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
    );
}

// Yetki kontrollü rota: kullanıcının sayfa yetkisi yoksa erişebildiği ilk sayfaya yönlendir
function Korumali({ yetki, children }) {
    const { currentUser } = useApp();
    if (!hasYetki(currentUser, yetki)) {
        const hedef = firstAllowedRoute(currentUser);
        if (!hedef) {
            return (
                <div className="card" style={{ margin: '40px auto', maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
                    <h3 style={{ marginBottom: '8px' }}>Erişim Yetkiniz Yok</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Hesabınıza hiçbir sayfa yetkisi tanımlanmamış. Lütfen yöneticinizle iletişime geçin.
                    </p>
                </div>
            );
        }
        return <Navigate to={hedef} replace />;
    }
    return children;
}

export default function App() {
    const { currentUser } = useApp();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [syncHata, setSyncHata] = useState(false);
    const location = useLocation();

    // Auto-close mobile sidebar on route change
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    // Sunucu senkronizasyon durumu (db.js 'myhis:sync' olayı yayınlar)
    useEffect(() => {
        const handler = (e) => setSyncHata(!e.detail.ok);
        window.addEventListener('myhis:sync', handler);
        return () => window.removeEventListener('myhis:sync', handler);
    }, []);

    // iOS KLAVYE DÜZELTMESİ: klavye açılınca iOS tüm görünümü yukarı kaydırıyor;
    // klavye kapanınca bazen sayfayı kaydırılmış bırakıyor ve sabit alt menü
    // yukarıda asılı kalıyordu. Alan odaktan çıkınca ve görsel pencere eski
    // boyutuna dönünce görünümü sıfırlıyoruz.
    useEffect(() => {
        const sifirla = () => {
            // Klavye kapanma animasyonunun bitmesini bekle
            setTimeout(() => {
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
            }, 60);
        };
        const onFocusOut = (e) => {
            const t = e.target.tagName;
            if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') sifirla();
        };
        document.addEventListener('focusout', onFocusOut);

        const vv = window.visualViewport;
        const onVvResize = () => {
            // Görsel pencere tam yüksekliğe döndü = klavye kapandı
            if (vv && window.innerHeight - vv.height < 60) sifirla();
        };
        vv?.addEventListener('resize', onVvResize);
        return () => {
            document.removeEventListener('focusout', onFocusOut);
            vv?.removeEventListener('resize', onVvResize);
        };
    }, []);

    // Giriş yapılmadıysa login ekranı
    if (!currentUser) {
        return <Login />;
    }

    const getTitle = () => {
        if (location.pathname.startsWith('/parti/')) return 'Parti Detay';
        if (location.pathname.startsWith('/cari/')) return 'Cari Detay';
        return PAGE_TITLES[location.pathname] || 'HİS ERP';
    };

    return (
        <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar
                open={sidebarOpen}
                collapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <div className="main-area">
                <Header
                    title={getTitle()}
                    onMenuClick={() => setSidebarOpen(true)}
                />
                {syncHata && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '8px 16px', background: '#c4314b', color: '#fff', fontSize: '0.82rem', fontWeight: 600,
                    }}>
                        <WifiOff size={15} />
                        Değişiklikler sunucuya kaydedilemedi! Bağlantınızı kontrol edin — bağlantı gelince otomatik tekrar denenecek.
                    </div>
                )}
                <main className={`main-content ${location.pathname === '/' ? 'main-content--home' : ''}`}>
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            <Route path="/" element={<Korumali yetki="anasayfa"><Dashboard /></Korumali>} />
                            <Route path="/firmalar" element={<Korumali yetki="firmalar"><Firmalar /></Korumali>} />
                            <Route path="/urunler" element={<Korumali yetki="urunler"><Urunler /></Korumali>} />
                            <Route path="/partiler" element={<Korumali yetki="partiler"><Partiler /></Korumali>} />
                            <Route path="/parti/:id" element={<Korumali yetki="partiler"><PartiDetay /></Korumali>} />
                            <Route path="/is-akisi" element={<Korumali yetki="is_akisi"><IsAkisi /></Korumali>} />
                            <Route path="/stok-takibi" element={<Korumali yetki="stok_takibi"><StokTakibi /></Korumali>} />
                            <Route path="/kumas-stok" element={<Korumali yetki="stok_takibi"><KumasStok /></Korumali>} />
                            <Route path="/irsaliyeler" element={<Korumali yetki="irsaliyeler"><Irsaliyeler /></Korumali>} />
                            <Route path="/is-talep-takvimi" element={<Korumali yetki="takvim"><IsTalepTakvimi /></Korumali>} />
                            <Route path="/cari-hesaplar" element={<Korumali yetki="cari_hesaplar"><CariHesaplar /></Korumali>} />
                            <Route path="/cari/:id" element={<Korumali yetki="cari_hesaplar"><CariDetay /></Korumali>} />
                            <Route path="/raporlar" element={<Korumali yetki="raporlar"><Raporlar /></Korumali>} />
                            <Route path="/islerim" element={<Korumali yetki="islerim"><Islerim /></Korumali>} />
                            <Route path="/islem-gunlugu" element={<Korumali yetki="kullanicilar"><IslemGunlugu /></Korumali>} />
                            <Route path="/kullanicilar" element={<Korumali yetki="kullanicilar"><Kullanicilar /></Korumali>} />
                            <Route path="/ayarlar" element={<Korumali yetki="ayarlar"><Ayarlar /></Korumali>} />
                            <Route path="*" element={<Navigate to={firstAllowedRoute(currentUser) || '/'} replace />} />
                        </Routes>
                    </Suspense>
                </main>
                <BottomNav />
            </div>
        </div>
    );
}
