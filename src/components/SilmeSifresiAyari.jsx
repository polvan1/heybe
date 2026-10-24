import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import Notice from './ui/Notice';
import { apiIstek } from '../data/api';

// Yönetici: kayıt silerken sorulan ortak silme şifresini belirler (sunucuda hash'li saklanır).
// Belirlenmemişse herkes silme onayında kendi giriş şifresini kullanır.
export default function SilmeSifresiAyari() {
    const [ayarli, setAyarli] = useState(null);
    const [sifre, setSifre] = useState('');
    const [mevcutSifre, setMevcutSifre] = useState('');
    const [mesaj, setMesaj] = useState(null); // { tone, metin }
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        apiIstek('auth=silme_bilgi').then(r => setAyarli(!!r.ayarli)).catch(() => setAyarli(null));
    }, []);

    const kaydet = async (kaldir = false) => {
        setBusy(true);
        setMesaj(null);
        try {
            const r = await apiIstek('auth=silme_sifresi', { sifre: kaldir ? '' : sifre, mevcutSifre });
            setAyarli(!!r.ayarli);
            setSifre('');
            setMevcutSifre('');
            setMesaj({ tone: 'success', metin: kaldir ? 'Ortak silme şifresi kaldırıldı; herkes kendi giriş şifresini kullanacak.' : 'Silme şifresi kaydedildi.' });
        } catch (e) {
            setMesaj({ tone: 'danger', metin: e.message || 'Kaydedilemedi.' });
        }
        setBusy(false);
    };

    return (
        <div className="silme-sifresi-ayar">
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <KeyRound size={16} /> Silme Şifresi
            </div>
            <p className="text-xs text-muted" style={{ marginBottom: '10px' }}>
                Parti, irsaliye, firma, ürün, stok ve cari kayıtları silinirken sorulur ve sunucuda doğrulanır.
                {ayarli === true && ' Şu an ortak bir silme şifresi tanımlı.'}
                {ayarli === false && ' Ortak şifre tanımlı değil: herkes kendi giriş şifresini girer.'}
            </p>
            <div className="form-row">
                <div className="form-group">
                    <label className="form-label" htmlFor="yeni-silme-sifresi">Yeni silme şifresi</label>
                    <input id="yeni-silme-sifresi" className="form-input" type="password" autoComplete="new-password"
                        value={sifre} onChange={e => setSifre(e.target.value)} placeholder="En az 4 karakter" />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="mevcut-giris-sifresi">Giriş şifreniz (onay için)</label>
                    <input id="mevcut-giris-sifresi" className="form-input" type="password" autoComplete="current-password"
                        value={mevcutSifre} onChange={e => setMevcutSifre(e.target.value)} />
                </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => kaydet(false)} disabled={busy || sifre.length < 4 || !mevcutSifre}>
                    Şifreyi Kaydet
                </button>
                {ayarli && (
                    <button className="btn btn-ghost btn-sm" onClick={() => kaydet(true)} disabled={busy || !mevcutSifre}>
                        Ortak şifreyi kaldır
                    </button>
                )}
            </div>
            {mesaj && <Notice tone={mesaj.tone} style={{ marginTop: '10px' }}>{mesaj.metin}</Notice>}
        </div>
    );
}
