import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const { kurulumGerekli, login, ilkKurulum, sunucuHatasi } = useApp();
    const ilkKurulumMu = kurulumGerekli;

    const [kimlik, setKimlik] = useState('');
    const [sifre, setSifre] = useState('');
    const [sifre2, setSifre2] = useState('');
    const [ad, setAd] = useState('');
    const [email, setEmail] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [unuttum, setUnuttum] = useState(false);
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

    const sifreAlani = (deger, setDeger, yer, otomatik, id) => (
        <div className="login-sade-alan">
            <input id={id} className="login-sade-input" type={showPassword ? 'text' : 'password'} value={deger}
                onChange={e => setDeger(e.target.value)} placeholder={yer} aria-label={yer} autoComplete={otomatik} />
            <button type="button" className="login-sade-goz" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Parolayı gizle' : 'Parolayı göster'}>
                {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
        </div>
    );

    return (
        <div className="login-page login-sade">
            <main className="login-sade-icerik">
                <img src={`${import.meta.env.BASE_URL}his-logo.png`} alt="HİS ERP" className="login-sade-logo" />
                <h1 className="login-sade-baslik">{ilkKurulumMu ? 'İLK KURULUM' : 'OTURUM AÇ'}</h1>

                {sunucuHatasi && (
                    <div className="sunucu-hatasi" role="alert">
                        <strong>Sunucuya ulaşılamadı</strong>
                        <span>{sunucuHatasi}</span>
                        <button type="button" className="login-sade-buton" onClick={() => window.location.reload()}>Tekrar dene</button>
                    </div>
                )}

                {sunucuHatasi ? null : ilkKurulumMu ? (
                    /* ---- İLK KURULUM: Yönetici hesabı oluştur ---- */
                    <form onSubmit={handleKurulum} className="login-sade-form">
                        <input className="login-sade-input" value={ad} onChange={e => setAd(e.target.value)} placeholder="Ad Soyad" aria-label="Ad Soyad" autoFocus />
                        <input className="login-sade-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-posta" aria-label="E-posta" autoComplete="email" />
                        {sifreAlani(sifre, setSifre, 'Parola (en az 6 karakter)', 'new-password', 'giris-sifre')}
                        <input className="login-sade-input" type={showPassword ? 'text' : 'password'} value={sifre2} onChange={e => setSifre2(e.target.value)} placeholder="Parola (tekrar)" aria-label="Parola (tekrar)" autoComplete="new-password" />
                        {hata && <div className="login-sade-hata" role="alert">{hata}</div>}
                        <button type="submit" className="login-sade-buton" disabled={busy}>Yönetici Hesabı Oluştur</button>
                    </form>
                ) : (
                    /* ---- GİRİŞ ---- */
                    <form onSubmit={handleLogin} className="login-sade-form">
                        <input id="giris-kimlik" className="login-sade-input" autoComplete="username" value={kimlik} onChange={e => setKimlik(e.target.value)}
                            placeholder="E-posta" aria-label="E-posta veya kullanıcı adı" autoCapitalize="none" spellCheck={false} />
                        {sifreAlani(sifre, setSifre, 'Parola', 'current-password', 'giris-sifre')}
                        <button type="button" className="login-sade-link" onClick={() => setUnuttum(!unuttum)}>Parolayı mı unuttunuz?</button>
                        {unuttum && <div className="login-sade-not">Parolanızı yöneticiniz Kullanıcılar sayfasından yenileyebilir.</div>}
                        {hata && <div className="login-sade-hata" role="alert">{hata}</div>}
                        <button type="submit" className="login-sade-buton" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş Yap'}</button>
                    </form>
                )}

                {!sunucuHatasi && import.meta.env.VITE_DEMO === '1' && !ilkKurulumMu && (
                    <div className="login-sade-demo">
                        <span>Demo hesapları</span>
                        <div className="demo-giris-butonlar">
                            <button type="button" className="login-sade-link" onClick={() => { setKimlik('demo@hiserp.app'); setSifre('demo123'); }}>Yönetici</button>
                            <button type="button" className="login-sade-link" onClick={() => { setKimlik('kesimhane@hiserp.app'); setSifre('demo123'); }}>Kesimhane</button>
                            <button type="button" className="login-sade-link" onClick={() => { setKimlik('fasoncu@hiserp.app'); setSifre('demo123'); }}>Fasoncu</button>
                            <button type="button" className="login-sade-link" onClick={() => { setKimlik('sofor@hiserp.app'); setSifre('demo123'); }}>Şoför</button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
