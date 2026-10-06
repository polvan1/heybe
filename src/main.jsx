import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import App from './App';
import './index.css';

// NOT: initDB() burada ÇAĞRILMAZ — AppContext içinde tek sefer çağrılır.
// (Önceden iki kez çağrılıyordu; boş veritabanında çift örnek veri riski yaratıyordu.)

// DEMO: Gömülü önizlemelerde tarayıcı diyalogları (alert/confirm/prompt) engellenir.
// alert → ekranda kısa bilgi kutusu; confirm → onaylanmış kabul edilir.
if (import.meta.env.VITE_DEMO === '1') {
    window.alert = (mesaj) => {
        const kutu = document.createElement('div');
        kutu.className = 'demo-toast';
        kutu.textContent = String(mesaj);
        document.body.appendChild(kutu);
        setTimeout(() => kutu.remove(), 4500);
    };
    window.confirm = () => true;
}

// PWA: Service worker kaydı (sadece production build'de; demoda yok)
if (import.meta.env.PROD && import.meta.env.VITE_DEMO !== '1' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(err => {
            console.warn('Service worker kaydedilemedi:', err);
        });
    });
}

// Error Boundary
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('React Error:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', color: '#f87171', fontFamily: 'monospace', background: '#0f172a', minHeight: '100vh' }}>
                    <h1 style={{ color: '#ef4444', marginBottom: '16px' }}>⚠️ Uygulama Hatası</h1>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#fbbf24', fontSize: '14px' }}>
                        {this.state.error?.message}
                    </pre>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#64748b', fontSize: '12px', marginTop: '12px' }}>
                        {this.state.error?.stack}
                    </pre>
                    <button onClick={() => { localStorage.clear(); window.location.reload(); }}
                        style={{ marginTop: '20px', padding: '12px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                        Verileri Temizle & Yeniden Başlat
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <HashRouter>
                <AppProvider>
                    <App />
                </AppProvider>
            </HashRouter>
        </ErrorBoundary>
    </React.StrictMode>
);
