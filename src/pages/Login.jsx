import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LogIn, Eye, EyeOff, UserPlus, ShieldCheck } from 'lucide-react';
import Notice from '../components/ui/Notice';

export default function Login() {
    const { kurulumGerekli, login, ilkKurulum, sunucuHatasi } = useApp();
    const ilkKurulumMu = kurulumGerekli;

    const [kimlik, setKimlik] = useState('');
    const [sifre, setSifre] = useState('');
    const [sifre2, setSifre2] = useState('');
    const [ad, setAd] = useState('');
    const [email, setEmail] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [hata, setHata] = useState('');
    const [busy, setBusy] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setHata('');
        if (!kimlik.trim() || !sifre) { setHata('Kullanıcı adı ve şifre girin.'); return; }
        setBusy(true);
        try {
            await login(kimlik.trim(), sifre);
        } catch (err) {
            setHata(err.message || 'Giriş yapılamadı.');
            setBusy(false);
        }
    };

    const handleKurulum = async (e) => {
        e.preventDefault();
        setHata('');
        if (!ad.trim()) { setHata('Ad Soyad girin.'); return; }
        if (!sifre || sifre.length < 6) { setHata('Şifre en az 6 karakter olmalı.'); return; }
        if (sifre !== sifre2) { setHata('Şifreler eşleşmiyor.'); return; }
        setBusy(true);
        try {
            await ilkKurulum(ad.trim(), email.trim(), sifre);
        } catch (err) {
            setHata('Kurulum sırasında hata oluştu: ' + err.message);
            setBusy(false);
        }
    };

    return (
        <div className="login-page">
            <div className="card login-card">
                {/* Logo */}
                <div className="login-brand">
                    <img src={`${import.meta.env.BASE_URL}his-logo.png`} alt="HİS ERP" className="app-logo login-logo" />
                    <h1>{ilkKurulumMu ? 'Kuruluma hoş geldiniz' : 'Tekrar hoş geldiniz'}</h1>
                    <p>HİS ERP · Fason Üretim Takip Sistemi</p>
                </div>

                {sunucuHatasi && (
                    <div className="sunucu-hatasi" role="alert">
                        <strong>Sunucuya ulaşılamadı</strong>
                        <span>{sunucuHatasi}</span>
                        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Tekrar dene</button>
                    </div>
                )}

                {!sunucuHatasi && import.meta.env.VITE_DEMO === '1' && !ilkKurulumMu && (
                    <div className="demo-giris">
                        <strong>Demo hesapları</strong> (şifre: demo123)
                        <div className="demo-giris-butonlar">
                            <button type="button" className="btn btn-ghost" onClick={() => { setKimlik('demo@hiserp.app'); setSifre('demo123'); }}>Yönetici</button>
                            <button type="button" className="btn btn-ghost" onClick={() => { setKimlik('fasoncu@hiserp.app'); setSifre('demo123'); }}>Fasoncu</button>
                            <button type="button" className="btn btn-ghost" onClick={() => { setKimlik('sofor@hiserp.app'); setSifre('demo123'); }}>Şoför</button>
                        </div>
                        <small>Örnek verilerle çalışır; yaptığınız değişiklikler sadece bu tarayıcıda saklanır.</small>
                    </div>
                )}

                {sunucuHatasi ? null : ilkKurulumMu ? (
                    /* ---- İLK KURULUM: Yönetici hesabı oluştur ---- */
                    <form onSubmit={handleKurulum}>
                        <Notice tone="info" icon={ShieldCheck}>
                            İlk kurulum: Sistem yöneticisi hesabınızı oluşturun.
                        </Notice>
                        <div className="form-group">
                            <label className="form-label">Ad Soyad *</label>
                            <input className="form-input" value={ad} onChange={e => setAd(e.target.value)} placeholder="Adınız Soyadınız" autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="form-label">E-posta</label>
                            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@email.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="giris-sifre">Şifre *</label>
                            <div className="input-with-action">
                                <input id="giris-sifre" className="form-input" type={showPassword ? 'text' : 'password'} value={sifre} onChange={e => setSifre(e.target.value)} placeholder="En az 6 karakter" autoComplete="new-password" />
                                <button type="button" className="input-action" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Şifre (Tekrar) *</label>
                            <input className="form-input" type={showPassword ? 'text' : 'password'} value={sifre2} onChange={e => setSifre2(e.target.value)} placeholder="Şifreyi tekrar girin" />
                        </div>
                        {hata && (
                            <Notice tone="danger">{hata}</Notice>
                        )}
                        <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
                            <UserPlus size={16} /> Yönetici Hesabı Oluştur
                        </button>
                    </form>
                ) : (
                    /* ---- GİRİŞ ---- */
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="giris-kimlik">Kullanıcı Adı veya E-posta</label>
                            <input id="giris-kimlik" className="form-input" autoComplete="username" value={kimlik} onChange={e => setKimlik(e.target.value)} placeholder="Adınız veya e-postanız" autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="giris-sifre">Şifre</label>
                            <div className="input-with-action">
                                <input id="giris-sifre" className="form-input" type={showPassword ? 'text' : 'password'} value={sifre} onChange={e => setSifre(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                                <button type="button" className="input-action" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        {hata && (
                            <Notice tone="danger">{hata}</Notice>
                        )}
                        <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
                            <LogIn size={16} /> {busy ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                        </button>
                    </form>
                )}
                <p className="login-footer">Oturumunuz bu cihazda güvenli şekilde saklanır.</p>
            </div>
        </div>
    );
}
