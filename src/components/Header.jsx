import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Sun, Moon, Check, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Header({ title, onMenuClick }) {
    const { bildirimler, bildirimOkundu, tumBildirimlerOkundu, tema, toggleTema, currentUser, logout } = useApp();
    const navigate = useNavigate();
    const [showNotif, setShowNotif] = useState(false);
    const dropdownRef = useRef(null);

    const okunmamis = bildirimler.filter(b => !b.okundu).length;

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowNotif(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const timeAgo = (dateStr) => {
        const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
        if (diff < 60) return 'Az önce';
        if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
        return `${Math.floor(diff / 86400)} gün önce`;
    };

    return (
        <header className="header">
            <button className="header-burger" onClick={onMenuClick} aria-label="Menü">
                <Menu size={24} />
            </button>
            <h2 className="header-title">{title}</h2>

            <div className="header-actions">
                {/* Theme Toggle */}
                <button className="theme-toggle" onClick={toggleTema} title={tema === 'light' ? 'Karanlık Mod' : 'Aydınlık Mod'}>
                    {tema === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                {/* Notifications */}
                <div className="notification-wrapper" ref={dropdownRef}>
                    <button className="notification-bell" onClick={() => setShowNotif(!showNotif)}>
                        <Bell size={20} />
                        {okunmamis > 0 && (
                            <span className="notification-badge">{okunmamis > 9 ? '9+' : okunmamis}</span>
                        )}
                    </button>

                    {showNotif && (
                        <div className="notification-dropdown">
                            <div className="notification-dropdown-header">
                                <span>Bildirimler</span>
                                {okunmamis > 0 && (
                                    <button
                                        className="btn btn-sm btn-ghost"
                                        onClick={() => tumBildirimlerOkundu()}
                                        style={{ fontSize: '0.75rem', padding: '4px 8px', minHeight: 'auto' }}
                                    >
                                        <Check size={12} /> Tümünü Okundu İşaretle
                                    </button>
                                )}
                            </div>
                            {bildirimler.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Henüz bildirim yok
                                </div>
                            ) : (
                                bildirimler.slice(0, 20).map(b => (
                                    <div
                                        key={b.id}
                                        className={`notification-item ${!b.okundu ? 'unread' : ''}`}
                                        onClick={() => {
                                            bildirimOkundu(b.id);
                                            if (b.link) {
                                                navigate(b.link);
                                                setShowNotif(false);
                                            }
                                        }}
                                    >
                                        {!b.okundu && <div className="notif-dot" />}
                                        <div className="notif-content">
                                            <div className="notif-title">{b.baslik}</div>
                                            <div className="notif-msg">{b.mesaj}</div>
                                            <div className="notif-time">{timeAgo(b.tarih)}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Kullanıcı & Çıkış */}
                {currentUser && (
                    <div className="header-user">
                        <span className="header-user-name" title={currentUser.ad}>
                            {currentUser.ad}
                        </span>
                        <button
                            className="theme-toggle"
                            onClick={() => { if (confirm('Oturumu kapatmak istiyor musunuz?')) logout(); }}
                            title="Çıkış Yap"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
