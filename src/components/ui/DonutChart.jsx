// Halka grafik: dilim renkleri CSS değişkeni olarak verilir (ör. 'var(--status-kesimde)')
export default function DonutChart({ segments, size = 128, strokeWidth = 14, caption = 'TOPLAM' }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    // Dilimler arasında ince boşluk (yalnızca birden fazla dilim varsa)
    const bosluk = segments.length > 1 ? 2 : 0;
    let offset = 0;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${caption}: ${total}`}>
            <circle className="donut-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} />
            {segments.map((seg, i) => {
                const pct = total > 0 ? seg.value / total : 0;
                const dashLength = pct * circumference;
                const currentOffset = offset;
                offset += dashLength;
                const gorunen = Math.max(dashLength - bosluk, 0);
                return (
                    <circle
                        key={i}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${gorunen} ${circumference - gorunen}`}
                        strokeDashoffset={-currentOffset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        style={{ transition: 'stroke-dasharray 250ms ease' }}
                    />
                );
            })}
            <text className="donut-total" x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="22">{total}</text>
            <text className="donut-caption" x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize="9">{caption}</text>
        </svg>
    );
}
