import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LogIn, Eye, EyeOff, UserPlus, ShieldCheck } from 'lucide-react';

export default function Login() {
    const { kullanicilar, login, ilkKurulum } = useApp();
    const ilkKurulumMu = kullanicilar.length === 0;

    const [kimlik, setKimlik] = useState('');
    const [sifre, setSifre] = useState('');
    const [sifre2, setSifre2] = useState('');
    const [ad, setAd] = useState('');
    const [email, setEmail] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [hata, setHata] = useState('');
    const [busy, setBusy] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        setHata('');
        const result = login(kimlik, sifre);
        if (!result.ok) setHata(result.error);
    };

    const handleKurulum = (e) => {
        e.preventDefault();
        setHata('');
        if (!ad.trim()) { setHata('Ad Soyad girin.'); return; }
        if (!sifre || sifre.length < 4) { setHata('Şifre en az 4 karakter olmalı.'); return; }
        if (sifre !== sifre2) { setHata('Şifreler eşleşmiyor.'); return; }
        setBusy(true);
        try {
            ilkKurulum(ad.trim(), email.trim(), sifre);
        } catch (err) {
            setHata('Kurulum sırasında hata oluştu: ' + err.message);
            setBusy(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-primary)', padding: '20px',
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <img src={`${import.meta.env.BASE_URL}his-logo.png`} alt="HİS ERP" className="app-logo login-logo" />
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>HİS ERP</h1>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Fason Üretim Takip Sistemi
                    </p>
                </div>

                {ilkKurulumMu ? (
                    /* ---- İLK KURULUM: Yönetici hesabı oluştur ---- */
                    <form onSubmit={handleKurulum}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                            background: 'rgba(0,120,212,0.08)', border: '1px solid rgba(0,120,212,0.2)',
                            borderRadius: '4px', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)',
                        }}>
                            <ShieldCheck size={18} style={{ flexShrink: 0, color: '#0078d4' }} />
                            İlk kurulum: Sistem yöneticisi hesabınızı oluşturun.
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ad Soyad *</label>
                            <input className="form-input" value={ad} onChange={e => setAd(e.target.value)} placeholder="Adınız Soyadınız" autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="form-label">E-posta</label>
                            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@email.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Şifre *</label>
                            <div style={{ position: 'relative' }}>
                                <input className="form-input" type={showPassword ? 'text' : 'password'} value={sifre} onChange={e => setSifre(e.target.value)} placeholder="En az 4 karakter" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Şifre (Tekrar) *</label>
                            <input className="form-input" type={showPassword ? 'text' : 'password'} value={sifre2} onChange={e => setSifre2(e.target.value)} placeholder="Şifreyi tekrar girin" />
                        </div>
                        {hata && (
                            <div style={{ padding: '8px 12px', marginBottom: '12px', background: 'rgba(196,49,75,0.08)', border: '1px solid rgba(196,49,75,0.25)', borderRadius: '4px', fontSize: '0.8rem', color: '#c4314b' }}>
                                {hata}
                            </div>
                        )}
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
                            <UserPlus size={16} /> Yönetici Hesabı Oluştur
                        </button>
                    </form>
                ) : (
                    /* ---- GİRİŞ ---- */
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">Kullanıcı Adı veya E-posta</label>
                            <input className="form-input" value={kimlik} onChange={e => setKimlik(e.target.value)} placeholder="Adınız veya e-postanız" autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Şifre</label>
                            <div style={{ position: 'relative' }}>
                                <input className="form-input" type={showPassword ? 'text' : 'password'} value={sifre} onChange={e => setSifre(e.target.value)} placeholder="••••••••" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        {hata && (
                            <div style={{ padding: '8px 12px', marginBottom: '12px', background: 'rgba(196,49,75,0.08)', border: '1px solid rgba(196,49,75,0.25)', borderRadius: '4px', fontSize: '0.8rem', color: '#c4314b' }}>
                                {hata}
                            </div>
                        )}
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                            <LogIn size={16} /> Giriş Yap
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
