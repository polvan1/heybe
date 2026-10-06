import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

// Türkçe duyarsız arama (İ/i, I/ı doğru eşleşir)
const norm = (s) => String(s || '').toLocaleLowerCase('tr');

/**
 * Aranabilir seçim kutusu — native <select> yerine.
 * Tıklayınca arama kutusu odaklanır (mobilde klavye direkt açılır),
 * yazdıkça liste filtrelenir.
 *
 * options: [{ value, label, sub? }]  (sub: küçük gri alt satır, opsiyonel)
 */
export default function SearchableSelect({
    value,
    onChange,
    options = [],
    placeholder = 'Seçin...',
    clearLabel = null,   // verilirse "temizle" seçeneği gösterilir (örn: "Yok / Sonra")
    disabled = false,
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const selected = options.find(o => String(o.value) === String(value));

    const filtered = useMemo(() => {
        const q = norm(query.trim());
        if (!q) return options;
        return options.filter(o => norm(o.label).includes(q) || norm(o.sub).includes(q));
    }, [options, query]);

    // Dış tıklamada kapat
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) close();
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [open]);

    // Açılınca arama kutusuna odaklan → mobilde klavye hemen açılır
    useEffect(() => {
        if (!open) return;
        if (inputRef.current) inputRef.current.focus();
        // Modal içinde en altta açılırsa dropdown görünür alana kaydırılsın
        const t = setTimeout(() => {
            const dd = rootRef.current?.querySelector('.sselect-dropdown');
            if (dd) dd.scrollIntoView({ block: 'nearest' });
        }, 50);
        return () => clearTimeout(t);
    }, [open]);

    // Aktif öğe görünür kalsın
    useEffect(() => {
        if (activeIndex < 0 || !listRef.current) return;
        const el = listRef.current.children[activeIndex];
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const close = () => {
        setOpen(false);
        setQuery('');
        setActiveIndex(-1);
    };

    const pick = (val) => {
        onChange(val);
        close();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') { close(); return; }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && filtered[activeIndex]) pick(filtered[activeIndex].value);
            else if (filtered.length === 1) pick(filtered[0].value);
        }
    };

    return (
        <div className={`sselect ${disabled ? 'sselect-disabled' : ''}`} ref={rootRef}>
            {/* Kapalı görünüm */}
            <button
                type="button"
                className={`form-input sselect-control ${open ? 'sselect-open' : ''}`}
                onClick={() => !disabled && (open ? close() : setOpen(true))}
                disabled={disabled}
            >
                <span className={selected ? 'sselect-value' : 'sselect-placeholder'}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown size={16} className="sselect-chevron" />
            </button>

            {open && (
                <div className="sselect-dropdown">
                    <div className="sselect-search">
                        <Search size={15} />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
                            onKeyDown={handleKeyDown}
                            placeholder="Yazarak arayın..."
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                        {query && (
                            <button type="button" className="sselect-clear-query" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <div className="sselect-list" ref={listRef}>
                        {clearLabel !== null && !query && (
                            <div
                                className={`sselect-option sselect-option-clear ${!value ? 'selected' : ''}`}
                                onClick={() => pick('')}
                            >
                                {clearLabel}
                                {!value && <Check size={15} />}
                            </div>
                        )}
                        {filtered.length === 0 ? (
                            <div className="sselect-empty">Sonuç bulunamadı</div>
                        ) : (
                            filtered.map((o, i) => (
                                <div
                                    key={o.value}
                                    className={`sselect-option ${String(o.value) === String(value) ? 'selected' : ''} ${i === activeIndex ? 'active' : ''}`}
                                    onClick={() => pick(o.value)}
                                    onMouseEnter={() => setActiveIndex(i)}
                                >
                                    <div className="sselect-option-text">
                                        <div>{o.label}</div>
                                        {o.sub && <div className="sselect-option-sub">{o.sub}</div>}
                                    </div>
                                    {String(o.value) === String(value) && <Check size={15} />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
