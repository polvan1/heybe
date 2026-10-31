// MY HİS kesim / sevk formu — kâğıt formla aynı düzen (yatay A4):
//   Sipariş veren firma | logo + № | Kesim tarihi, Kesimhane çıkış tarihi
//   MODEL KODU | MODEL ADI                         | ATÖLYE ADI / ATÖLYE'DEN ÇIKAN ADET
//   ASORTİ DAĞITIMI (beden başına seri adedi)        | KESİM KRİTİKLERİ
//   RENK - BEDEN | XS S M L XL 2X 3X 4X 5X | KESİLEN | DİKİM KRİTİKLERİ
//   … renk satırları …                               | ÜTÜ PAKET: (beden tablosu)
//   BEDEN / LASTİK ÖLÇÜSÜ / NOT                      | ÜTÜ'DEN ÇIKAN ADET
// Doldurulmuş irsaliye (partiden) ve elle doldurulacak boş şablon aynı düzeni kullanır.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const FORM_BEDENLERI = ['XS', 'S', 'M', 'L', 'XL', '2X', '3X', '4X', '5X'];
const UTU_BEDENLERI = ['XS', 'S', 'M', 'L', 'XL', '2X', '3X', '4X'];

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
const BOS_TARIH = '........ / ........ / 20........';

// veri: { no, kesimTarihi, cikisTarihi, kesimhaneAdi, siparisVeren, modelKodu, modelAdi, atolyeAdi, atolyedenCikan,
//         asorti: { bedenler, dagilim }, renkler: [{ renk, bedenAdetleri, toplam }], kesimKritik, dikimKritik,
//         utuPaketci, utudenCikan, not, tipEtiketi, partiNo, qr }  — bos: true ise elle doldurulacak şablon
export function kesimFormuSayfasi(veri = {}, { bos = false, satirSayisi } = {}) {
    const asortiBedenleri = (veri.asorti?.bedenler || []).map(formBedeni);
    const renkBedenleri = (veri.renkler || []).flatMap(r => Object.keys(r.bedenAdetleri || {})).map(formBedeni);
    const kullanilan = [...new Set([...asortiBedenleri, ...renkBedenleri])];
    // Standart sütunlar yetmiyorsa (36, 38 gibi numara bedenler) partinin kendi bedenleri kullanılır
    const kolonlar = kullanilan.every(b => FORM_BEDENLERI.includes(b)) ? FORM_BEDENLERI : kullanilan.slice(0, 10);
    const n = kolonlar.length;

    const dagilim = {};
    (veri.asorti?.bedenler || []).forEach(b => { dagilim[formBedeni(b)] = veri.asorti?.dagilim?.[b]; });
    const renkler = (veri.renkler || []).map(r => {
        const adet = {};
        Object.entries(r.bedenAdetleri || {}).forEach(([b, a]) => { adet[formBedeni(b)] = (adet[formBedeni(b)] || 0) + (Number(a) || 0); });
        const toplam = Number(r.toplam) || Object.values(adet).reduce((t, a) => t + a, 0);
        return { renk: r.renk, adet, toplam };
    });
    const satirAdedi = Math.max(satirSayisi || (bos ? 10 : 7), renkler.length);
    const renkSatirlari = Array.from({ length: satirAdedi }, (_, i) => {
        const r = renkler[i];
        return `<tr class="renk-satir">
            <td class="renk">${r ? esc(r.renk) : ''}</td>
            ${kolonlar.map(b => `<td class="hucre">${r && r.adet[b] ? sayi(r.adet[b]) : ''}</td>`).join('')}
            <td class="kesilen">${r ? sayi(r.toplam) : ''}</td>
        </tr>`;
    }).join('');
    const toplamlar = kolonlar.map(b => renkler.reduce((t, r) => t + (r.adet[b] || 0), 0));
    const genelToplam = renkler.reduce((t, r) => t + r.toplam, 0);

    return `
<section class="form">
    <header class="ust">
        <div class="siparis">
            <span class="lbl">SİPARİŞ VEREN FİRMA:</span>
            <span class="kutu">${esc(veri.siparisVeren || '')}</span>
        </div>
        <div class="marka">
            <img src="${veri.logoUrl || ''}" alt="MY HİS" class="logo">
            <span class="no">№ <b>${esc(veri.no || '')}</b></span>
        </div>
        <div class="tarihler">
            <div><span>Kesim Tarih:</span> <b>${bos ? BOS_TARIH : (tarihYaz(veri.kesimTarihi) || BOS_TARIH)}</b></div>
            <div><span>Kesimhane Çıkış Tarih:</span> <b>${bos ? BOS_TARIH : (tarihYaz(veri.cikisTarihi) || BOS_TARIH)}</b></div>
            ${veri.kesimhaneAdi !== undefined ? `<div><span>Kesimhane:</span> <b>${esc(veri.kesimhaneAdi) || '..............................'}</b></div>` : ''}
            ${veri.tipEtiketi || veri.partiNo ? `<div class="tip">${esc([veri.tipEtiketi, veri.partiNo].filter(Boolean).join(' · '))}</div>` : ''}
        </div>
        ${veri.qr ? `<img src="${veri.qr}" alt="" class="qr">` : ''}
    </header>

    <div class="govde">
        <table class="ana">
            <colgroup><col class="c-etiket">${kolonlar.map(() => '<col>').join('')}<col class="c-kesilen"></colgroup>
            <tr class="bas"><th>MODEL KODU</th><th colspan="${n + 1}">MODEL ADI</th></tr>
            <tr class="model"><td>${esc(veri.modelKodu || '')}</td><td colspan="${n + 1}">${esc(veri.modelAdi || '')}</td></tr>
            <tr class="asorti"><th>ASORTİ DAĞITIMI</th>${kolonlar.map(b => `<td>${dagilim[b] ? sayi(dagilim[b]) : ''}</td>`).join('')}<td></td></tr>
            <tr class="bas beden-bas"><th>RENK - BEDEN</th>${kolonlar.map(b => `<th>${esc(b)}</th>`).join('')}<th>KESİLEN ADET</th></tr>
            ${renkSatirlari}
            <tr class="toplam"><th>TOPLAM</th>${toplamlar.map(t => `<td>${!bos && t ? sayi(t) : ''}</td>`).join('')}<td>${!bos && genelToplam ? sayi(genelToplam) : ''}</td></tr>
            <tr class="bas beden-bas"><th>BEDEN</th>${kolonlar.map(b => `<th>${esc(b)}</th>`).join('')}<td rowspan="2" class="bos"></td></tr>
            <tr class="lastik"><th>LASTİK ÖLÇÜSÜ</th>${kolonlar.map(b => `<td>${esc(veri.lastik?.[b] || '')}</td>`).join('')}</tr>
            <tr class="not"><th>NOT:</th><td colspan="${n + 1}">${esc(veri.not || '')}</td></tr>
        </table>

        <aside class="sag">
            <div class="blok">
                <div class="lbl">ATÖLYE ADI</div>
                <div class="deger buyuk">${esc(veri.atolyeAdi || '')}</div>
            </div>
            <div class="blok">
                <div class="lbl">ATÖLYE'DEN ÇIKAN ADET</div>
                <div class="deger">${sayi(veri.atolyedenCikan)}</div>
                <div class="tarih">Tarih: ${bos || !veri.atolyedenCikmaTarihi ? BOS_TARIH : tarihYaz(veri.atolyedenCikmaTarihi)}</div>
            </div>
            <div class="blok uzun">
                <div class="lbl">KESİM KRİTİKLERİ</div>
                <div class="metin">${esc(veri.kesimKritik || '')}</div>
            </div>
            <div class="blok uzun">
                <div class="lbl">DİKİM KRİTİKLERİ</div>
                <div class="metin">${esc(veri.dikimKritik || '')}</div>
            </div>
            <div class="blok">
                <div class="lbl">ÜTÜ PAKET: <b>${esc(veri.utuPaketci || '')}</b></div>
                <table class="utu"><tr>${UTU_BEDENLERI.map(b => `<th>${b}</th>`).join('')}</tr><tr>${UTU_BEDENLERI.map(() => '<td></td>').join('')}</tr></table>
            </div>
            <div class="blok">
                <div class="lbl">ÜTÜ'DEN ÇIKAN ADET: <b>${sayi(veri.utudenCikan)}</b></div>
            </div>
        </aside>
    </div>
</section>`;
}

export function kesimFormuBelgesi(sayfalar, { baslik = 'Kesim Formu', boyut = 'A4' } = {}) {
    const a5 = boyut === 'A5';
    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${esc(baslik)}</title>
<style>
    @page { size: ${a5 ? 'A5' : 'A4'} landscape; margin: ${a5 ? '5mm' : '7mm'}; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .form { width: 283mm; height: 196mm; display: flex; flex-direction: column; gap: 2.5mm; ${a5 ? 'zoom: 0.7;' : ''}
        page-break-after: always; break-after: page; overflow: hidden; }
    .form:last-child { page-break-after: auto; break-after: auto; }
    .ust { display: grid; grid-template-columns: 1.15fr 1fr 1fr auto; align-items: center; gap: 4mm; }
    .siparis { display: flex; flex-direction: column; gap: 1mm; }
    .lbl { font-size: 8.5pt; font-weight: 800; letter-spacing: 0.2pt; text-transform: uppercase; }
    .siparis .kutu { display: block; border: 0.5mm solid #000; min-height: 9mm; padding: 1.5mm 2.5mm; font-size: 12pt; font-weight: 700; }
    .marka { display: flex; align-items: center; justify-content: center; gap: 4mm; }
    .logo { height: 15mm; width: auto; }
    .no { font-size: 13pt; color: #c0262d; font-weight: 700; white-space: nowrap; }
    .no b { letter-spacing: 1pt; }
    .tarihler { font-size: 9pt; display: flex; flex-direction: column; gap: 1.5mm; }
    .tarihler span { font-weight: 700; }
    .tarihler b { font-weight: 600; }
    .tarihler .tip { font-size: 8pt; font-weight: 800; border: 0.3mm solid #000; padding: 0.4mm 1.5mm; align-self: flex-start; }
    .qr { width: 17mm; height: 17mm; }

    .govde { flex: 1; display: grid; grid-template-columns: 1fr 74mm; border: 0.6mm solid #000; min-height: 0; }
    table { border-collapse: collapse; }
    table.ana { width: 100%; height: 100%; table-layout: fixed; }
    .ana col.c-etiket { width: 33mm; }
    .ana col.c-kesilen { width: 24mm; }
    .ana th, .ana td { border: 0.3mm solid #000; text-align: center; vertical-align: middle; padding: 0.6mm 1mm; }
    .ana th { font-size: 8.5pt; font-weight: 800; }
    .ana tr.bas th { background: #fff; }
    .ana tr.model td { font-size: 15pt; font-weight: 700; height: 12mm; }
    .ana tr.asorti td { font-size: 11pt; font-weight: 700; }
    .ana tr.beden-bas th { font-size: 9.5pt; }
    .ana tr.renk-satir td { font-size: 11pt; height: 8.6mm; }
    .ana td.renk { text-align: left; font-weight: 700; font-size: 10.5pt; }
    .ana td.kesilen { font-weight: 800; }
    .ana tr.toplam th, .ana tr.toplam td { font-weight: 800; font-size: 11pt; border-top: 0.6mm solid #000; }
    .ana tr.lastik td { height: 8mm; }
    .ana tr.not th { text-align: left; }
    .ana tr.not td { text-align: left; height: 9mm; font-size: 9.5pt; }

    .sag { border-left: 0.6mm solid #000; display: flex; flex-direction: column; }
    .blok { border-bottom: 0.3mm solid #000; padding: 1.5mm 2mm; display: flex; flex-direction: column; gap: 1mm; }
    .blok:last-child { border-bottom: 0; }
    .blok .lbl { text-align: center; }
    .blok .deger { min-height: 8mm; text-align: center; font-size: 12pt; font-weight: 700; }
    .blok .deger.buyuk { font-size: 14pt; }
    .blok .tarih { font-size: 8pt; text-align: right; }
    .blok.uzun { flex: 1; }
    .blok .metin { font-size: 9pt; white-space: pre-wrap; }
    table.utu { width: 100%; table-layout: fixed; }
    table.utu th, table.utu td { border: 0.3mm solid #000; font-size: 7.5pt; text-align: center; height: 6mm; }
    @media screen {
        body { background: #e9edf1; padding: 6mm; }
        .form { background: #fff; margin: 0 auto 6mm; padding: 4mm; box-shadow: 0 2px 8px rgba(0,0,0,.15); height: auto; min-height: 196mm; }
    }
    @media screen and (max-width: 700px) { body { zoom: 0.45; padding: 2mm; } }
</style>
</head>
<body>${sayfalar.join('')}</body>
</html>`;
}

export const formLogoUrl = () => new URL(import.meta.env.BASE_URL + 'his-logo.png', window.location.href).href;
