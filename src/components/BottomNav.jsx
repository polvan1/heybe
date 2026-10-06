import { NavLink } from 'react-router-dom';
import { LayoutDashboard, GitBranch, Layers, FileText, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { hasYetki } from '../data/yetki';

const ITEMS = [
    { to: '/', icon: LayoutDashboard, label: 'Anasayfa', yetki: 'anasayfa' },
    { to: '/is-akisi', icon: GitBranch, label: 'İş Akışı', yetki: 'is_akisi' },
    { to: '/partiler', icon: Layers, label: 'Partiler', yetki: 'partiler' },
    { to: '/irsaliyeler', icon: FileText, label: 'İrsaliye', yetki: 'irsaliyeler' },
    { to: '/cari-hesaplar', icon: Wallet, label: 'Cari', yetki: 'cari_hesaplar' },
];

export default function BottomNav() {
    const { currentUser } = useApp();
    const items = ITEMS.filter(i => hasYetki(currentUser, i.yetki));

    return (
        <nav className="bottom-nav">
            {items.map(({ to, icon: Icon, label }) => (
                <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
                >
                    <span className="bottom-nav-icon">
                        <Icon size={20} />
                    </span>
                    <span>{label}</span>
                </NavLink>
            ))}
        </nav>
    );
}
