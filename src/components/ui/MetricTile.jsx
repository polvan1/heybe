// Kart içindeki küçük etiket + değer kutusu. tone: primary | success | danger
export default function MetricTile({ label, value, tone, className = '', style, children }) {
    return (
        <div className={`metric-tile ${tone ? `metric-tile--${tone}` : ''} ${className}`.trim()} style={style}>
            <div className="metric-tile-label">{label}</div>
            <div className="metric-tile-value">{value}</div>
            {children}
        </div>
    );
}
