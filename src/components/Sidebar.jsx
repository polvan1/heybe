import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Layers, GitBranch, CalendarClock,
    Package, Scissors, Factory, Wallet, BarChart3,
    Users, Settings, ChevronLeft, ChevronRight,
    FileText, ClipboardList, ScrollText, PackagePlus, MapPinned,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { hasYetki } from '../data/yetki';

const NAV_SECTIONS = [
    {
        items: [
            { to: '/', icon: LayoutDashboard, label: 'Anasayfa', yetki: 'anasayfa' },
        ]
    },
    {
        title: 'ÜRETİM',
        items: [
            { to: '/islerim', icon: ClipboardList, label: 'İşlerim', yetki: 'islerim' },
            { to: '/partiler', icon: Layers, label: 'Partiler', yetki: 'partiler' },
            { to: '/is-akisi', icon: GitBranch, label: 'İş Akışı', yetki: 'is_akisi' },
            { to: '/is-talep-takvimi', icon: CalendarClock, label: 'Takvim', yetki: 'takvim' },
        ]
    },
    {
        title: 'STOK',
        items: [
            { to: '/urunler', icon: Package, label: 'Ürünler', yetki: 'urunler' },
            { to: '/stok-takibi', icon: Scissors, label: 'Stok Takibi', yetki: 'stok_takibi' },
            { to: '/kumas-stok', icon: PackagePlus, label: 'Kumaş Stok', yetki: 'stok_takibi' },
        ]
    },
    {
        title: 'İLİŞKİLER',
        items: [
            { to: '/firmalar', icon: Factory, label: 'Firmalar', yetki: 'firmalar' },
            { to: '/cari-hesaplar', icon: Wallet, label: 'Cari Hesaplar', yetki: 'cari_hesaplar' },
            { to: '/irsaliyeler', icon: FileText, label: 'İrsaliyeler', yetki: 'irsaliyeler' },
            { to: '/harita', icon: MapPinned, label: 'Harita ve Rota', yetki: 'harita' },
        ]
    },
    {
        title: 'ANALİZ',
        items: [
            { to: '/raporlar', icon: BarChart3, label: 'Raporlar', yetki: 'raporlar' },
        ]
    },
    {
        title: 'YÖNETİM',
        items: [
            { to: '/kullanicilar', icon: Users, label: 'Kullanıcılar', yetki: 'kullanicilar' },
            { to: '/islem-gunlugu', icon: ScrollText, label: 'İşlem Günlüğü', yetki: 'kullanicilar' },
            { to: '/ayarlar', icon: Settings, label: 'Ayarlar', yetki: 'ayarlar' },
        ]
    },
];

export default function Sidebar({ open, collapsed, onClose, onToggleCollapse }) {
    const { currentUser } = useApp();

    // Kullanıcının yetkisi olmayan sayfaları menüde gösterme
    const sections = NAV_SECTIONS
        .map(s => ({ ...s, items: s.items.filter(i => hasYetki(currentUser, i.yetki)) }))
        .filter(s => s.items.length > 0);

    return (
        <>
            <div
                className={`sidebar-overlay ${open ? 'active' : ''}`}
                onClick={onClose}
            />
            <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
                {/* Logo Header */}
                {/* NOT: Etiketler her zaman render edilir; "daraltılmış" görünümde
                    gizleme SADECE masaüstü CSS'inde yapılır. (Önceden JSX koşuluyla
                    gizleniyordu — mobilde daralt'a basılınca menü etiketsiz kalıp
                    bozuluyordu.) */}
                <div className="sidebar-header">
                    <img src={`${import.meta.env.BASE_URL}his-logo.png`} alt="HİS ERP" className="app-logo sidebar-logo" />
                    <button className="sidebar-collapse-btn-header" onClick={onToggleCollapse} title="Daralt">
                        <ChevronLeft size={16} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {sections.map((section, sIdx) => (
                        <div key={sIdx} className="sidebar-section">
                            {section.title && (
                                <>
                                    <div className="sidebar-section-title">{section.title}</div>
                                    <div className="sidebar-section-divider" />
                                </>
                            )}
                            {section.items.map(({ to, icon: Icon, label }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    end={to === '/'}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    onClick={onClose}
                                    title={label}
                                >
                                    <Icon className="nav-icon" size={20} />
                                    <span className="nav-label">{label}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Genişlet düğmesi (masaüstünde daraltılmışken CSS gösterir) */}
                <button className="sidebar-collapse-btn" onClick={onToggleCollapse} title="Genişlet">
                    <ChevronRight size={18} />
                </button>
            </aside>
        </>
    );
}
