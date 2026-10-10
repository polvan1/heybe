import { Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

const IKONLAR = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle, neutral: Info };

// Bilgi / uyarı kutusu. tone: info | success | warning | danger | neutral
export default function Notice({ tone = 'info', title, icon, children, className = '', style, role }) {
    const Ikon = icon || IKONLAR[tone] || Info;
    return (
        <div
            className={`notice notice--${tone} ${className}`.trim()}
            style={style}
            role={role || (tone === 'danger' ? 'alert' : undefined)}
        >
            <Ikon size={18} aria-hidden="true" />
            <div className="notice-body">
                {title && <div className="notice-title">{title}</div>}
                {children && <div>{children}</div>}
            </div>
        </div>
    );
}
