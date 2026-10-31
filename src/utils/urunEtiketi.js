// Ürün (seri/paket) etiketi — termal rulo, varsayılan 30×50 mm, 3'lü (yan yana 3 etiket).
// Etikete görseldeki gibi yan yazılır: CODE (ürün kodu), SIZES (bedenler + altında seri dağılımı),
// ürün adı ve "Yerli Üretim". Kâğıt ölçüleri yazıcıya göre ayarlanır ve cihazda hatırlanır.
import { belgeAc } from './belgeGoster';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const DEPO = 'hiserp_etiket_ayar';
export const VARSAYILAN_ETIKET_AYARI = {
    genislik: 30,      // tek etiketin rulodaki eni (mm)
    yukseklik: 50,     // tek etiketin boyu (mm)
    sutun: 3,          // yan yana etiket sayısı (3'lü rulo)
    ara: 3,            // etiketler arası boşluk (mm)
    kenar: 2,          // rulonun sol/sağ kenar payı (mm)
    dondur: 90,        // yazı yönü: 90 (görseldeki gibi yan), -90 (ters yan), 0 (düz)
    yerliUretim: true,
};

export function etiketAyariOku() {
    try { return { ...VARSAYILAN_ETIKET_AYARI, ...JSON.parse(localStorage.getItem(DEPO) || '{}') }; } catch (e) { return { ...VARSAYILAN_ETIKET_AYARI }; }
}
export function etiketAyariKaydet(ayar) {
    try { localStorage.setItem(DEPO, JSON.stringify(ayar)); } catch (e) { /* depolama kapalı */ }
}

// Seri (paket) başına adet ve bir partiden çıkacak paket sayısı
export const seriAdedi = (asorti) => (asorti?.bedenler || []).reduce((t, b) => t + (Number(asorti?.dagilim?.[b]) || 0), 0);
export function paketSayisi(adet, asorti) {
    const seri = seriAdedi(asorti);
    return seri > 0 && adet > 0 ? Math.ceil(adet / seri) : 1;
}

function etiketIcerik(urun, ayar) {
    const bedenler = urun.asorti?.bedenler || [];
    const dagilim = urun.asorti?.dagilim || {};
    const bedenSutun = bedenler.map(b => `<td>${esc(b)}</td>`).join('');
    const adetSutun = bedenler.map(b => `<td>${esc(dagilim[b] ?? '')}</td>`).join('');
    return `
        <div class="sol">
            <div class="satir"><span class="rozet">CODE:</span></div>
            <div class="kod">${esc(urun.urunKodu)}</div>
            ${bedenler.length ? `
            <div class="satir"><span class="rozet">SIZES:</span></div>
            <table class="beden${bedenler.length > 5 ? ' cok' : ''}"><tr class="b">${bedenSutun}</tr><tr class="d">${adetSutun}</tr></table>` : ''}
        </div>
        <div class="sag">
            <div class="ad">${esc(urun.urunAdi || '')}</div>
            ${ayar.yerliUretim ? '<div class="yerli">YERLİ<br>ÜRETİM</div>' : ''}
        </div>`;
}

// kalemler: [{ urunKodu, urunAdi, asorti: { bedenler, dagilim }, adet }]  (adet = basılacak etiket)
export function yazdirUrunEtiketi(kalemler, ayarGirdi = {}) {
    const ayar = { ...etiketAyariOku(), ...ayarGirdi };
    const g = Math.max(10, Number(ayar.genislik) || 30);
    const y = Math.max(10, Number(ayar.yukseklik) || 50);
    const sutun = Math.min(Math.max(parseInt(ayar.sutun, 10) || 1, 1), 6);
    const ara = Math.max(0, Number(ayar.ara) || 0);
    const kenar = Math.max(0, Number(ayar.kenar) || 0);
    const donuk = Number(ayar.dondur) === 90 || Number(ayar.dondur) === -90;
    // İçerik kutusu: döndürülünce etiketin boyu enine olur
    const icG = donuk ? y : g;
    const icY = donuk ? g : y;
    const donusum = Number(ayar.dondur) === 90 ? `transform: translateX(${g}mm) rotate(90deg);`
        : Number(ayar.dondur) === -90 ? `transform: translateY(${y}mm) rotate(-90deg);` : '';
    const sayfaG = kenar * 2 + sutun * g + (sutun - 1) * ara;

    const tekler = [];
    kalemler.forEach(k => {
        const n = Math.min(Math.max(parseInt(k.adet, 10) || 0, 0), 3000);
        for (let i = 0; i < n; i++) tekler.push(k);
    });
    if (!tekler.length) { alert('Basılacak etiket yok.'); return; }
    const satirlar = [];
    for (let i = 0; i < tekler.length; i += sutun) satirlar.push(tekler.slice(i, i + sutun));
    const govde = satirlar.map(s => `<div class="sira">${s.map(k => `<div class="etiket"><div class="ic">${etiketIcerik(k, ayar)}</div></div>`).join('')}</div>`).join('');
    const ilk = kalemler[0] || {};

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Ürün Etiketi — ${esc(ilk.urunKodu || '')}</title>
<style>
    @page { size: ${sayfaG}mm ${y}mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${sayfaG}mm; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sira { display: flex; gap: ${ara}mm; padding: 0 ${kenar}mm; width: ${sayfaG}mm; height: ${y}mm; overflow: hidden;
        page-break-after: always; break-after: page; }
    .sira:last-child { page-break-after: auto; break-after: auto; }
    .etiket { position: relative; width: ${g}mm; height: ${y}mm; flex-shrink: 0; overflow: hidden; }
    .ic { position: absolute; left: 0; top: 0; width: ${icG}mm; height: ${icY}mm; transform-origin: top left; ${donusum}
        display: grid; grid-template-columns: 54% 46%; padding: 1.6mm 1.8mm; gap: 1mm; }
    .sol { display: flex; flex-direction: column; justify-content: center; gap: 0.5mm; min-width: 0; }
    .satir { line-height: 1; }
    .rozet { display: inline-block; background: #000; color: #fff; font-size: 5.5pt; font-weight: 700; padding: 0.3mm 0.8mm; letter-spacing: 0.2pt; }
    .kod { font-size: 13pt; font-weight: 800; line-height: 1.05; letter-spacing: 0.2pt; white-space: nowrap; }
    table.beden { border-collapse: collapse; margin-top: 0.4mm; }
    table.beden td { font-size: 7pt; font-weight: 700; text-align: center; padding: 0 0.9mm; line-height: 1.25; }
    table.beden.cok td { font-size: 6pt; padding: 0 0.5mm; }
    table.beden tr.b td { border-bottom: 0.25mm solid #000; }
    .sag { display: flex; flex-direction: column; justify-content: space-between; align-items: center; min-width: 0; text-align: center; }
    .ad { font-size: 8.5pt; font-weight: 800; line-height: 1.12; text-transform: uppercase; overflow-wrap: anywhere;
        display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; margin-top: 0.5mm; }
    .yerli { border: 0.3mm solid #000; border-radius: 0.6mm; padding: 0.3mm 1mm; font-size: 5pt; font-weight: 800; line-height: 1.05; letter-spacing: 0.2pt; }
    @media screen {
        html, body { width: auto; }
        body { background: #e9edf1; padding: 6mm; }
        .sira { margin: 0 auto 4mm; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.15); }
        .etiket { outline: 0.2mm dashed #b7c0ca; }
    }
    @media screen and (max-width: 460px) { body { zoom: 0.86; padding: 3mm 1mm; } }
</style>
</head>
<body>${govde}</body>
</html>`;
    belgeAc(html, { baslik: `Ürün Etiketi — ${tekler.length} adet` });
}
