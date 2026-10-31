// Parti etiketi: kesilen pastal/çuval/koliye yapıştırılır. QR telefonla (ya da uygulamadaki
// "QR Okut" ile) okutulunca parti açılır ve bir sonraki adıma ilerletilebilir.
// Boyutlar: 10×7 cm termal etiket ya da A4'e 8'li (2×4) etiket.
import QRCode from 'qrcode';
import { belgeAc } from './belgeGoster';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const partiQrAdresi = (partiId) => new URL(`#/parti/${partiId}`, window.location.href).href;

// Okunan QR metninden parti bul: uygulama adresi (#/parti/ID), parti no (P-0012) ya da düz id
export function qrdanPartiBul(metin, partiler) {
    const m = String(metin || '').trim();
    if (!m) return null;
    const idEslesme = m.match(/#\/parti\/([^/?#&\s]+)/);
    if (idEslesme) return partiler.find(p => p.id === decodeURIComponent(idEslesme[1])) || null;
    const no = m.toUpperCase().replace(/\s+/g, '');
    return partiler.find(p => (p.partiNo || '').toUpperCase() === no) || partiler.find(p => p.id === m) || null;
}

function etiketHtml(parti, { sira, toplam, qr, firmaAdi }) {
    const renkler = (parti.kesilenRenkler?.length ? parti.kesilenRenkler.map(r => ({ renk: r.renk, adet: r.adet })) : (parti.renkler || []).map(r => ({ renk: r.renk, adet: r.toplam })))
        .filter(r => r.renk);
    const adet = parti.kesilenAdet || parti.toplamAdet || 0;
    return `
    <section class="etiket">
        <div class="qr"><img src="${qr}" alt=""><span>${esc(parti.partiNo)}</span></div>
        <div class="bilgi">
            <div class="ust">
                <strong class="no">${esc(parti.partiNo)}</strong>
                ${toplam > 1 ? `<span class="paket">${sira}/${toplam}</span>` : ''}
            </div>
            <div class="model">${esc(parti.urunKodu)}</div>
            <div class="ad">${esc(parti.urunAdi)}</div>
            ${renkler.length ? `<div class="renkler">${renkler.slice(0, 4).map(r => `${esc(r.renk)}: <b>${Number(r.adet || 0).toLocaleString('tr-TR')}</b>`).join(' · ')}${renkler.length > 4 ? ' …' : ''}</div>` : ''}
            <div class="adet">${Number(adet).toLocaleString('tr-TR')} adet</div>
            <div class="rota">${esc(firmaAdi(parti.kesimhaneId) || '—')} → ${esc(firmaAdi(parti.dikimhaneId) || '—')}</div>
        </div>
    </section>`;
}

// boyut: 'etiket' (10×7 cm) | 'a4' (A4'e 8 etiket); kopya: kaç etiket (paket sayısı)
export async function yazdirPartiEtiketi(parti, { kopya = 1, boyut = 'etiket', firmalar = [] } = {}) {
    const adet = Math.min(Math.max(parseInt(kopya, 10) || 1, 1), 200);
    const firmaAdi = (id) => firmalar.find(f => f.id === id)?.ad || '';
    const qr = await QRCode.toDataURL(partiQrAdresi(parti.id), { margin: 0, width: 300, errorCorrectionLevel: 'M' });
    const etiketler = Array.from({ length: adet }, (_, i) => etiketHtml(parti, { sira: i + 1, toplam: adet, qr, firmaAdi })).join('');
    const a4 = boyut === 'a4';

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Parti Etiketi — ${esc(parti.partiNo)}</title>
<style>
    @page { size: ${a4 ? 'A4 portrait' : '100mm 70mm'}; margin: ${a4 ? '8mm 5mm' : '0'}; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sayfa { ${a4 ? 'display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 70mm; gap: 0;' : ''} }
    .etiket { width: 100mm; height: 70mm; padding: 4mm; display: flex; gap: 3.5mm; align-items: center; overflow: hidden;
        ${a4 ? 'border: 0.2mm dashed #999;' : 'page-break-after: always; break-after: page;'} }
    .etiket:last-child { page-break-after: auto; break-after: auto; }
    .qr { width: 36mm; flex-shrink: 0; text-align: center; }
    .qr img { width: 36mm; height: 36mm; display: block; }
    .qr span { font-size: 7pt; color: #444; }
    .bilgi { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1mm; }
    .ust { display: flex; align-items: baseline; justify-content: space-between; gap: 2mm; }
    .no { font-size: 20pt; letter-spacing: 0.3pt; }
    .paket { font-size: 10pt; font-weight: 700; border: 0.4mm solid #111; border-radius: 1mm; padding: 0 1.5mm; }
    .model { font-size: 12pt; font-weight: 700; }
    .ad { font-size: 8.5pt; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .renkler { font-size: 8pt; line-height: 1.3; }
    .adet { font-size: 13pt; font-weight: 800; margin-top: 1mm; }
    .rota { font-size: 7.5pt; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @media screen {
        body { background: #e9edf1; padding: 8mm; }
        .sayfa { ${a4 ? 'width: 200mm; margin: 0 auto; background: #fff;' : ''} }
        .etiket { background: #fff; ${a4 ? '' : 'margin: 0 auto 6mm; box-shadow: 0 2px 8px rgba(0,0,0,.15);'} }
    }
</style>
</head>
<body>
<div class="sayfa">${etiketler}</div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body>
</html>`;

    belgeAc(html, { baslik: `Parti Etiketi — ${parti.partiNo}` });
}
