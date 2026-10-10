// Sade çubuk grafik: sabit çubuk genişliği, yuvarlak üst köşeler,
// çubuğun üstünde sayı, ızgara çizgisi yok. Renkler tema token'larından gelir
// (açık temada koyu lacivert, koyu temada kırık beyaz; vurgu soluk yeşil).
//
// data: [{ label, value, sub?, title?, highlight? }]
export default function BarChart({ data, height = 160, barWidth = 28, formatValue, highlight = 'none', ariaLabel }) {
    const max = Math.max(...data.map(d => Number(d.value) || 0), 1);
    const maxIndex = data.reduce((iMax, d, i, arr) => ((Number(d.value) || 0) > (Number(arr[iMax].value) || 0) ? i : iMax), 0);
    const yaz = formatValue || (v => Number(v).toLocaleString('tr-TR'));
    // Değer yazısı ve etiket için çubuk alanından pay ayrılır
    const cubukAlani = Math.max(height - 44, 24);

    const vurguluMu = (d, i) => {
        if (d.highlight !== undefined) return d.highlight;
        if (highlight === 'max') return (Number(d.value) || 0) > 0 && i === maxIndex;
        if (highlight === 'last') return i === data.length - 1 && (Number(d.value) || 0) > 0;
        return false;
    };

    return (
        <div
            className="bar-chart"
            style={{ '--chart-height': `${height}px`, '--bar-width': `${barWidth}px` }}
            role="img"
            aria-label={ariaLabel || data.map(d => `${d.label}: ${d.value}`).join(', ')}
        >
            {data.map((d, i) => {
                const deger = Number(d.value) || 0;
                const yukseklik = Math.max((deger / max) * cubukAlani, 4);
                const siniflar = ['bar-chart-col'];
                if (deger === 0) siniflar.push('is-empty');
                if (vurguluMu(d, i)) siniflar.push('is-highlight');
                return (
                    <div key={i} className={siniflar.join(' ')} title={d.title || `${d.label}: ${yaz(deger)}`}>
                        <span className="bar-chart-value">{deger > 0 ? yaz(deger) : ''}</span>
                        <div className="bar-chart-bar" style={{ height: `${yukseklik}px` }} />
                        <span className="bar-chart-label">{d.label}</span>
                        {d.sub !== undefined && <span className="bar-chart-sub">{d.sub}</span>}
                    </div>
                );
            })}
        </div>
    );
}
