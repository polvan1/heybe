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
                <div className="app-error">
                    <div className="card app-error-card">
                        <h1 className="page-title" style={{ marginBottom: '8px' }}>Uygulama hatası</h1>
                        <p className="text-sm text-muted">{this.state.error?.message}</p>
                        <pre>{this.state.error?.stack}</pre>
                        <button className="btn btn-primary" onClick={() => { localStorage.clear(); window.location.reload(); }}>
                            Verileri Temizle & Yeniden Başlat
                        </button>
                    </div>
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
