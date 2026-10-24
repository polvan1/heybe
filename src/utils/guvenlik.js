// Silme işlemleri için güvenlik onayı — yanlışlıkla dokunmayı ve yetkisiz silmeyi önler.
// Şifre artık uygulama kodunda değil, SUNUCUDA doğrulanır (public/inc/guvenlik.php):
// yönetici Ayarlar'dan ortak bir silme şifresi belirler; belirlenmemişse kişinin kendi
// giriş şifresi geçerlidir. Doğru şifreden sonra sunucu 10 dakika silmeye izin verir.
import { createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Trash2, Lock } from 'lucide-react';
import Modal from '../components/Modal';
import { apiIstek } from '../data/api';

function SifreModal({ mesaj, onBitti }) {
    const [sifre, setSifre] = useState('');
    const [hata, setHata] = useState('');
    const [busy, setBusy] = useState(false);

    const onayla = async (e) => {
        e?.preventDefault();
        if (!sifre || busy) return;
        setBusy(true);
        setHata('');
        try {
            await apiIstek('auth=silme_onay', { sifre });
            onBitti(true);
        } catch (err) {
            setBusy(false);
            setSifre('');
            setHata(err?.durum ? (err.message || 'Şifre doğrulanamadı.') : 'Silme işlemi için internet bağlantısı gerekir.');
        }
    };

    return h(Modal, {
        title: 'Silme onayı',
        onClose: () => onBitti(false),
        footer: [
            h('button', { key: 'i', type: 'button', className: 'btn btn-ghost', onClick: () => onBitti(false) }, 'İptal'),
            h('button', { key: 's', type: 'button', className: 'btn btn-danger', onClick: onayla, disabled: !sifre || busy },
                h(Trash2, { size: 16 }), busy ? ' Doğrulanıyor…' : ' Sil'),
        ],
    },
        h('p', { style: { marginBottom: '12px', whiteSpace: 'pre-line' } }, mesaj),
        h('form', { onSubmit: onayla },
            h('label', { className: 'form-label', htmlFor: 'silme-sifresi' }, h(Lock, { size: 14, style: { verticalAlign: '-2px' } }), ' Silme şifresi'),
            h('input', {
                id: 'silme-sifresi', className: 'form-input', type: 'password', autoComplete: 'off', autoFocus: true,
                value: sifre, onChange: e => setSifre(e.target.value),
                placeholder: import.meta.env.VITE_DEMO === '1' ? 'Demo: demo123' : 'Şifreyi girin',
            }),
            hata && h('div', { className: 'form-hata', role: 'alert' }, hata),
            h('div', { className: 'text-xs text-muted', style: { marginTop: '8px' } },
                'Ortak silme şifresi belirlenmemişse kendi giriş şifrenizi girin.'),
        ));
}

// Kullanım: if (!(await silmeOnayi('X silinecek.'))) return;
export function silmeOnayi(mesaj) {
    return new Promise((resolve) => {
        const kap = document.createElement('div');
        document.body.appendChild(kap);
        const kok = createRoot(kap);
        const bitti = (sonuc) => {
            kok.unmount();
            kap.remove();
            resolve(sonuc);
        };
        kok.render(h(SifreModal, { mesaj, onBitti: bitti }));
    });
}
