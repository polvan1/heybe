// MY HİS kesim / sevk irsaliyesi — bir A4 sayfaya aynı irsaliyeden alt alta İKİ A5 (yatay) nüsha:
// üstteki ATÖLYE NÜSHASI, alttaki ÜTÜ PAKET NÜSHASI (siyah bantla ayırt edilir), arada kesim çizgisi.
// Her nüsha:
//   logo + № | başlık + nüsha | kesim ve kesimhane çıkış tarihi (+ QR)
//   SİPARİŞ VEREN FİRMA | MODEL KODU | MODEL ADI
//   [KESİMHANE] [DİKİMHANE | ATÖLYE'DEN ÇIKAN ADET] [ÜTÜ PAKET | ÜTÜ'DEN ÇIKAN ADET]
//   ASORTİ DAĞITIMI / RENK - BEDEN (yalnızca kullanılan bedenler) / renk satırları / TOPLAM / LASTİK ÖLÇÜSÜ
//   DİKİM KRİTİKLERİ | NOT
// Doldurulmuş irsaliye (partiden) ve elle doldurulacak boş şablon aynı düzeni kullanır.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const FORM_BEDENLERI = ['XS', 'S', 'M', 'L', 'XL', '2X', '3X', '4X', '5X'];
export const NUSHALAR = [
    { kod: 'atolye', ad: 'ATÖLYE NÜSHASI' },
    { kod: 'utu', ad: 'ÜTÜ PAKET NÜSHASI' },
];

// "2XL", "XXL" → "2X" (formdaki sütun adı)
export function formBedeni(b) {
    const s = String(b ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const es = { XXL: '2X', '2XL': '2X', XXXL: '3X', '3XL': '3X', XXXXL: '4X', '4XL': '4X', '5XL': '5X', XXS: 'XS' };
    return es[s] || s;
}

const tarihYaz = (t) => {
    if (!t) return '';
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const sayi = (n) => (n || n === 0 ? Number(n).toLocaleString('tr-TR') : '');
const BOS_TARIH = '..... / ..... / 20.....';
const sirala = (bedenler) => [...bedenler].sort((a, b) => {
    const ia = FORM_BEDENLERI.indexOf(a), ib = FORM_BEDENLERI.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

// veri: { no, kesimTarihi, cikisTarihi, kesimhaneAdi, siparisVeren, modelKodu, modelAdi, atolyeAdi, atolyedenCikan,
//         asorti: { bedenler, dagilim }, renkler: [{ renk, bedenAdetleri, toplam }], dikimKritik, utuPaketci,
//         utudenCikan, not, tipEtiketi, partiNo, qr, logoUrl }
// bos: true → elle doldurulacak şablon (tüm beden sütunları, boş satırlar)
function nushaHtml(veri, { bos, nusha, bosSatir }) {
    const dagilim = {};
    (veri.asorti?.bedenler || []).forEach(b => { dagilim[formBedeni(b)] = veri.asorti?.dagilim?.[b]; });
    const renkler = (veri.renkler || []).map(r => {
        const adet = {};
        Object.entries(r.bedenAdetleri || {}).forEach(([b, a]) => { if (Number(a) > 0) adet[formBedeni(b)] = (adet[formBedeni(b)] || 0) + Number(a); });
        const toplam = Number(r.toplam) || Object.values(adet).reduce((t, a) => t + a, 0);
        return { renk: r.renk, adet, toplam };
    });
    // Yalnızca kullanılan bedenler (renk adedi ya da asorti dağıtımı olanlar)
    const kullanilan = new Set([...renkler.flatMap(r => Object.keys(r.adet)), ...Object.keys(dagilim).filter(b => Number(dagilim[b]) > 0)]);
    const kolonlar = bos ? FORM_BEDENLERI : sirala([...kullanilan]).slice(0, 12);
    const satirAdedi = bos ? bosSatir : Math.max(1, renkler.length);
    // Satır yüksekliği renk sayısına göre: sayfaya sığsın, az renkte ferah dursun
    const satirMm = Math.max(3.8, Math.min(7.5, 46 / satirAdedi));
    const yazi = satirMm < 5 ? 7.5 : 9.5;

    const renkSatirlari = Array.from({ length: satirAdedi }, (_, i) => {
        const r = renkler[i];
        return `<tr class="renk-satir" style="height:${satirMm}mm;font-size:${yazi}pt">
            <td class="renk">${r ? esc(r.renk) : ''}</td>
            ${kolonlar.map(b => `<td>${r && r.adet[b] ? sayi(r.adet[b]) : ''}</td>`).join('')}
            <td class="kesilen">${r ? sayi(r.toplam) : ''}</td>
        </tr>`;
    }).join('');
    const toplamlar = kolonlar.map(b => renkler.reduce((t, r) => t + (r.adet[b] || 0), 0));
    const genelToplam = renkler.reduce((t, r) => t + r.toplam, 0);
    const utu = nusha.kod === 'utu';
    const kutu = (etiket, deger, ek = '') => `<div class="kutu ${ek}"><span class="lbl">${etiket}</span><span class="deger">${deger}</span></div>`;

    return `
<section class="nusha ${utu ? 'nusha-utu' : ''}">
    <header class="ust">
        <div class="marka">
            <img src="${veri.logoUrl || ''}" alt="MY HİS" class="logo">
            <span class="no">№ <b>${esc(veri.no || '')}</b></span>
        </div>
        <div class="baslik">
            <div class="ad">KESİM / SEVK İRSALİYESİ</div>
            <div class="nusha-etiket">${utu ? '✂ ' : ''}${nusha.ad}</div>
        </div>
        <div class="tarihler">
            <div><span>Kesim Tarih:</span> ${bos ? BOS_TARIH : (tarihYaz(veri.kesimTarihi) || BOS_TARIH)}</div>
            <div><span>Kesimhane Çıkış:</span> ${bos ? BOS_TARIH : (tarihYaz(veri.cikisTarihi) || BOS_TARIH)}</div>
            ${!bos && (veri.partiNo || veri.tipEtiketi) ? `<div class="tip">${esc([veri.partiNo, veri.tipEtiketi].filter(Boolean).join(' · '))}</div>` : ''}
        </div>
        ${veri.qr ? `<img src="${veri.qr}" alt="" class="qr">` : ''}
    </header>

    <div class="bilgi">
        ${kutu('SİPARİŞ VEREN FİRMA', esc(veri.siparisVeren || ''))}
        ${kutu('MODEL KODU', esc(veri.modelKodu || ''), 'kod')}
        ${kutu('MODEL ADI', esc(veri.modelAdi || ''), 'model')}
    </div>

    <div class="firmalar">
        ${kutu('KESİMHANE', esc(veri.kesimhaneAdi || ''))}
        <div class="cift">
            ${kutu('DİKİMHANE (ATÖLYE)', esc(veri.atolyeAdi || ''))}
            ${kutu("ATÖLYE'DEN ÇIKAN ADET", sayi(veri.atolyedenCikan), 'adet')}
        </div>
        <div class="cift ${utu ? 'vurgu' : ''}">
            ${kutu('ÜTÜ PAKET', esc(veri.utuPaketci || ''))}
            ${kutu("ÜTÜ'DEN ÇIKAN ADET", sayi(veri.utudenCikan), 'adet')}
        </div>
    </div>

    <table class="ana">
        <colgroup><col class="c-etiket">${kolonlar.map(() => '<col>').join('')}<col class="c-kesilen"></colgroup>
        <tr class="asorti"><th>ASORTİ DAĞITIMI</th>${kolonlar.map(b => `<td>${dagilim[b] ? sayi(dagilim[b]) : ''}</td>`).join('')}<td></td></tr>
        <tr class="bas"><th>RENK - BEDEN</th>${kolonlar.map(b => `<th>${esc(b)}</th>`).join('')}<th>KESİLEN ADET</th></tr>
        ${renkSatirlari}
        <tr class="toplam"><th>TOPLAM</th>${toplamlar.map(t => `<td>${!bos && t ? sayi(t) : ''}</td>`).join('')}<td>${!bos && genelToplam ? sayi(genelToplam) : ''}</td></tr>
        <tr class="lastik"><th>LASTİK ÖLÇÜSÜ</th>${kolonlar.map(b => `<td>${esc(veri.lastik?.[b] || '')}</td>`).join('')}<td></td></tr>
    </table>

    <div class="alt">
        ${kutu('DİKİM KRİTİKLERİ', esc(veri.dikimKritik || ''), 'metin')}
        ${kutu('NOT', esc(veri.not || ''), 'metin')}
    </div>
</section>`;
}

// Bir A4 sayfa: üstte atölye, altta ütü paket nüshası
export function kesimFormuSayfasi(veri = {}, { bos = false, bosSatir = 6 } = {}) {
    return `<div class="sayfa">
        ${nushaHtml(veri, { bos, bosSatir, nusha: NUSHALAR[0] })}
        <div class="kesim-cizgisi"><span>✂ buradan kesin</span></div>
        ${nushaHtml(veri, { bos, bosSatir, nusha: NUSHALAR[1] })}
    </div>`;
}

export function kesimFormuBelgesi(sayfalar, { baslik = 'Kesim / Sevk İrsaliyesi' } = {}) {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${esc(baslik)}</title>
<style>
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sayfa { width: 210mm; height: 297mm; display: flex; flex-direction: column; page-break-after: always; break-after: page; overflow: hidden; }
    .sayfa:last-child { page-break-after: auto; break-after: auto; }
    .nusha { height: 148.5mm; padding: 5mm 6mm; display: flex; flex-direction: column; gap: 1.6mm; overflow: hidden; }
    .kesim-cizgisi { height: 0; border-top: 0.3mm dashed #777; position: relative; }
    .kesim-cizgisi span { position: absolute; left: 50%; top: -2mm; transform: translateX(-50%); background: #fff; padding: 0 2mm; font-size: 6.5pt; color: #777; }

    .ust { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 3mm; }
    .marka { display: flex; align-items: center; gap: 2.5mm; }
    .logo { height: 10mm; width: auto; }
    .no { font-size: 11pt; color: #c0262d; font-weight: 700; white-space: nowrap; }
    .baslik { text-align: center; }
    .baslik .ad { font-size: 11pt; font-weight: 800; letter-spacing: 0.4pt; }
    .nusha-etiket { display: inline-block; margin-top: 0.8mm; font-size: 8pt; font-weight: 800; letter-spacing: 0.6pt;
        border: 0.4mm solid #000; border-radius: 1mm; padding: 0.4mm 2.5mm; }
    .nusha-utu .nusha-etiket { background: #000; color: #fff; }
    .tarihler { font-size: 7.5pt; display: flex; flex-direction: column; gap: 0.8mm; white-space: nowrap; }
    .tarihler span { font-weight: 700; }
    .tarihler .tip { font-size: 6.5pt; color: #333; }
    .qr { width: 12mm; height: 12mm; }
    .nusha-utu { border-left: 3mm solid #000; padding-left: 4mm; }

    .kutu { border: 0.35mm solid #000; padding: 0.6mm 1.6mm; display: flex; flex-direction: column; min-width: 0; }
    .kutu .lbl { font-size: 6pt; font-weight: 800; letter-spacing: 0.2pt; }
    .kutu .deger { font-size: 10pt; font-weight: 700; min-height: 4.6mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bilgi { display: grid; grid-template-columns: 1fr 0.55fr 1.45fr; gap: 1.5mm; }
    .bilgi .kod .deger, .bilgi .model .deger { font-size: 11.5pt; }
    .firmalar { display: grid; grid-template-columns: 0.8fr 1.1fr 1.1fr; gap: 1.5mm; }
    .cift { display: grid; grid-template-columns: 1fr 26mm; }
    .cift .kutu + .kutu { border-left: 0; }
    .cift .adet { background: #f3f3f3; }
    .cift .adet .deger { text-align: center; }
    .cift.vurgu .kutu { border-width: 0.6mm; }

    table.ana { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .ana col.c-etiket { width: 30mm; }
    .ana col.c-kesilen { width: 21mm; }
    .ana th, .ana td { border: 0.3mm solid #000; text-align: center; vertical-align: middle; padding: 0.3mm 0.8mm; }
    .ana th { font-size: 7pt; font-weight: 800; }
    .ana tr.asorti td { font-size: 9pt; font-weight: 700; height: 5.5mm; }
    .ana tr.bas th { font-size: 8pt; height: 6mm; }
    .ana td.renk { text-align: left; font-weight: 700; }
    .ana td.kesilen { font-weight: 800; }
    .ana tr.toplam th, .ana tr.toplam td { font-weight: 800; font-size: 9.5pt; border-top: 0.6mm solid #000; height: 6mm; }
    .ana tr.lastik td { height: 5.5mm; }

    .alt { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm; flex: 1; min-height: 9mm; }
    .alt .metin .deger { white-space: pre-wrap; font-size: 8pt; font-weight: 400; }
    @media screen {
        body { background: #e9edf1; padding: 6mm; }
        .sayfa { background: #fff; margin: 0 auto 6mm; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
    }
    @media screen and (max-width: 700px) { body { zoom: 0.5; padding: 2mm; } }
</style>
</head>
<body>${sayfalar.join('')}</body>
</html>`;
}

export const formLogoUrl = () => new URL(import.meta.env.BASE_URL + 'his-logo.png', window.location.href).href;
