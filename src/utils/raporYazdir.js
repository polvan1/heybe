// Ortak yazdırılabilir rapor (PDF) şablonu: logolu başlık, özet kutuları, tablolar.
// Tarayıcının yazdırma penceresinde "PDF olarak kaydet" seçilerek PDF alınır.
// Excel'e giden sayfa tanımlarıyla (utils/excel.js) aynı yapıyı kullanır.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tl = (n) => `${Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

function hucreMetni(deger, tip) {
    if (deger === null || deger === undefined || deger === '') return '';
    if (tip === 'para') return Number.isFinite(Number(deger)) ? tl(deger) : esc(deger);
    if (tip === 'sayi') return Number.isFinite(Number(deger)) ? Number(deger).toLocaleString('tr-TR') : esc(deger);
    if (tip === 'tarih') {
        const t = deger instanceof Date ? deger : new Date(deger);
        return Number.isNaN(t.getTime()) ? esc(deger) : t.toLocaleDateString('tr-TR');
    }
    return esc(deger);
}

// secenek: { baslik, altBaslik, ozet: [{ etiket, deger, vurgu? }], tablolar: [{ baslik?, sutunlar, satirlar, toplamSatiri? }], yatay? }
export function raporYazdir({ baslik, altBaslik = '', ozet = [], tablolar = [], yatay = false, not = '' }) {
    const logoUrl = new URL(import.meta.env.BASE_URL + 'his-logo.png', window.location.href).href;
    const tabloHtml = tablolar.map(t => `
        ${t.baslik ? `<h2>${esc(t.baslik)}</h2>` : ''}
        <table>
            <thead><tr>${t.sutunlar.map(s => `<th class="${s.tip === 'para' || s.tip === 'sayi' ? 'sag' : ''}">${esc(s.baslik)}</th>`).join('')}</tr></thead>
            <tbody>
                ${t.satirlar.length ? t.satirlar.map(r => `<tr>${t.sutunlar.map((s, i) => `<td class="${s.tip === 'para' || s.tip === 'sayi' ? 'sag' : ''}">${hucreMetni(r[i], s.tip)}</td>`).join('')}</tr>`).join('')
                    : `<tr><td colspan="${t.sutunlar.length}" class="bos">Kayıt yok</td></tr>`}
            </tbody>
            ${t.toplamSatiri ? `<tfoot><tr>${t.sutunlar.map((s, i) => `<td class="${s.tip === 'para' || s.tip === 'sayi' ? 'sag' : ''}">${hucreMetni(t.toplamSatiri[i], s.tip)}</td>`).join('')}</tr></tfoot>` : ''}
        </table>`).join('');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${esc(baslik)}</title>
<style>
    @page { size: A4 ${yatay ? 'landscape' : 'portrait'}; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1d2a36; font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #24394B; padding-bottom: 8px; margin-bottom: 12px; }
    header img { height: 34px; }
    header .baslik { flex: 1; }
    h1 { font-size: 16pt; color: #24394B; }
    .alt { color: #5b6b79; font-size: 9pt; margin-top: 2px; }
    .tarih { font-size: 8pt; color: #708090; text-align: right; }
    .ozet { display: grid; grid-template-columns: repeat(${Math.min(Math.max(ozet.length, 1), 4)}, 1fr); gap: 8px; margin-bottom: 14px; }
    .kutu { border: 1px solid #dfe5eb; border-radius: 6px; padding: 8px 10px; }
    .kutu span { display: block; font-size: 8pt; color: #708090; text-transform: uppercase; letter-spacing: .3px; }
    .kutu strong { font-size: 12.5pt; }
    .kutu.vurgu { background: #24394B; color: #fff; border-color: #24394B; }
    .kutu.vurgu span { color: #c9d3dc; }
    h2 { font-size: 11pt; margin: 14px 0 6px; color: #24394B; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th { background: #eef2f5; text-align: left; font-weight: 700; color: #3b4b59; }
    th, td { padding: 5px 6px; border-bottom: 1px solid #e3e8ed; vertical-align: top; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot td { font-weight: 800; border-top: 2px solid #24394B; background: #f6f8fa; }
    .sag { text-align: right; white-space: nowrap; }
    .bos { text-align: center; color: #8494A3; padding: 14px; }
    .not { margin-top: 14px; font-size: 8pt; color: #708090; }
    @media screen { body { background: #e9edf1; padding: 16px; } main { background: #fff; max-width: ${yatay ? '277mm' : '190mm'}; margin: 0 auto; padding: 14mm 12mm; box-shadow: 0 2px 10px rgba(0,0,0,.12); } }
</style>
</head>
<body>
<main>
    <header>
        <img src="${logoUrl}" alt="">
        <div class="baslik"><h1>${esc(baslik)}</h1>${altBaslik ? `<div class="alt">${esc(altBaslik)}</div>` : ''}</div>
        <div class="tarih">${new Date().toLocaleString('tr-TR')}</div>
    </header>
    ${ozet.length ? `<div class="ozet">${ozet.map(o => `<div class="kutu ${o.vurgu ? 'vurgu' : ''}"><span>${esc(o.etiket)}</span><strong>${esc(o.deger)}</strong></div>`).join('')}</div>` : ''}
    ${tabloHtml}
    ${not ? `<div class="not">${esc(not)}</div>` : ''}
</main>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body>
</html>`;

    const pw = window.open('', '_blank', 'width=900,height=900');
    if (!pw) {
        alert('Yazdırma penceresi açılamadı. Tarayıcınızın açılır pencere engelleyicisini kontrol edin.');
        return;
    }
    pw.document.write(html);
    pw.document.close();
    pw.focus();
}

export { tl as tlBicim };
