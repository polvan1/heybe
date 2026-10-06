import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, footer }) {
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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} onFocus={handleFocus}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );
}
