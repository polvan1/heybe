import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Modal her zaman <body>'nin doğrudan çocuğu olarak çizilir (portal).
// Sayfa içeriğinin içinde çizildiğinde iOS Safari'de kaydırılan alanın katmanında
// kalıyor, üst bar ve alt menünün ALTINA düşüyordu (butonlara dokunulamıyordu).
export default function Modal({ title, onClose, children, footer, genis = false }) {
    // Mobilde klavye açılınca odaklanan alan görünür kalsın:
    // input/textarea/select odaklandığında modal içinde görünüme kaydır
    const handleFocus = (e) => {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            setTimeout(() => {
                e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 250); // klavye animasyonunun bitmesini bekle
        }
    };

    // Escape ile kapat; açıkken arka plandaki sayfa kaymasın
    useEffect(() => {
        const tus = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', tus);
        document.body.classList.add('modal-acik');
        return () => {
            document.removeEventListener('keydown', tus);
            // Üst üste açılan modallarda son kapanan kilidi kaldırır
            if (document.querySelectorAll('.modal-overlay').length === 0) document.body.classList.remove('modal-acik');
        };
    }, [onClose]);

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className={`modal${genis ? ' modal--genis' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
                onClick={(e) => e.stopPropagation()} onFocus={handleFocus}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button className="btn-icon" onClick={onClose} aria-label="Kapat">
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>,
        document.body
    );
}
