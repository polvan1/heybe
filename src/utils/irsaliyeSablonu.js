// Kesimhanelerin ELLE dolduracağı boş A5 "Kesim Sevk İrsaliyesi" şablonu (form kodu HIS-KS1).
// Doldurulan form telefonla fotoğraflanıp "Şablonu Okut" ile sisteme irsaliye olarak girilir.
// Yapay zekânın formu güvenle okuyabilmesi için düzen sade tutulur: büyük kutular, net
// başlıklar, sabit sütunlar (Model No | Renk | Beden Dağılımı | Adet).
import { belgeAc } from './belgeGoster';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const SABLON_KODU = 'HIS-KS1';
const SATIR_SAYISI = 10;

function sayfaHtml({ kesimhaneAdi, atolyeAdi, logoUrl }) {
    const satirlar = Array.from({ length: SATIR_SAYISI }, (_, i) => `
        <tr>
            <td class="sira">${i + 1}</td>
            <td></td><td></td><td></td><td></td>
        </tr>`).join('');
    const alan = (etiket, deger = '', ek = '') => `
        <div class="alan ${ek}">
            <div class="etiket">${etiket}</div>
            <div class="deger">${esc(deger)}</div>
        </div>`;
    return `
    <section class="sayfa">
        <header>
            <img src="${logoUrl}" alt="" class="logo">
            <div class="baslik">
                <h1>KESİM SEVK İRSALİYESİ</h1>
                <div class="alt">Kesimhane → Dikim Atölyesi</div>
            </div>
            <div class="kod">FORM<br><strong>${SABLON_KODU}</strong></div>
        </header>

        <div class="alanlar">
            ${alan('TARİH', '', 'kucuk')}
            ${alan('İRSALİYE NO', '', 'kucuk')}
            ${alan('PARTİ NO', '', 'kucuk')}
            ${alan('GÖNDEREN KESİMHANE', kesimhaneAdi, 'genis')}
            ${alan('ALAN ATÖLYE', atolyeAdi, 'genis')}
        </div>

        <table>
            <thead>
                <tr>
                    <th class="sira">#</th>
                    <th class="model">MODEL NO</th>
                    <th class="renk">RENK</th>
                    <th class="beden">BEDEN DAĞILIMI<span>(ör. S:20 M:30)</span></th>
                    <th class="adet">ADET</th>
                </tr>
            </thead>
            <tbody>${satirlar}</tbody>
            <tfoot>
                <tr>
                    <td colspan="4" class="toplam-etiket">TOPLAM ADET</td>
                    <td class="toplam"></td>
                </tr>
            </tfoot>
        </table>

        <div class="notlar"><span>NOT</span></div>

        <div class="imzalar">
            <div class="imza">TESLİM EDEN<span>Ad Soyad / İmza</span></div>
            <div class="imza">TESLİM ALAN<span>Ad Soyad / İmza / Kaşe</span></div>
        </div>

        <footer>Rakamları kutulara net ve büyük yazın. Fotoğrafı düz, aydınlık ve formun tamamı görünecek şekilde çekin.</footer>
    </section>`;
}

// kopya: kaç sayfa basılacak (her sayfa ayrı A5 form)
export function yazdirBosSevkSablonu({ kesimhaneAdi = '', atolyeAdi = '', kopya = 1 } = {}) {
    const logoUrl = new URL(import.meta.env.BASE_URL + 'his-logo.png', window.location.href).href;
    const adet = Math.min(Math.max(parseInt(kopya, 10) || 1, 1), 20);
    const sayfalar = Array.from({ length: adet }, () => sayfaHtml({ kesimhaneAdi, atolyeAdi, logoUrl })).join('');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>Kesim Sevk İrsaliyesi — Boş Şablon (${SABLON_KODU})</title>
<style>
    @page { size: A5 portrait; margin: 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sayfa { width: 132mm; height: 193mm; display: flex; flex-direction: column; gap: 3mm; page-break-after: always; break-after: page; }
    .sayfa:last-child { page-break-after: auto; break-after: auto; }
    header { display: flex; align-items: center; gap: 3mm; border-bottom: 0.6mm solid #111; padding-bottom: 2mm; }
    .logo { height: 10mm; width: auto; }
    .baslik { flex: 1; }
    h1 { font-size: 13pt; letter-spacing: 0.4pt; }
    .baslik .alt { font-size: 7.5pt; color: #444; }
    .kod { font-size: 6.5pt; text-align: center; border: 0.3mm solid #111; border-radius: 1mm; padding: 1mm 2mm; line-height: 1.2; }
    .kod strong { font-size: 9pt; }

    .alanlar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5mm; }
    .alan { border: 0.3mm solid #111; border-radius: 1mm; padding: 0.8mm 1.5mm; min-height: 10mm; }
    .alan.genis { grid-column: span 3; }
    .alan .etiket { font-size: 6.5pt; font-weight: 700; color: #333; letter-spacing: 0.3pt; }
    .alan .deger { font-size: 10pt; font-weight: 600; min-height: 5mm; }

    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 0.3mm solid #111; }
    th { font-size: 6.5pt; font-weight: 700; background: #e9e9e9; padding: 1mm 0.5mm; letter-spacing: 0.2pt; }
    th span { display: block; font-size: 5.5pt; font-weight: 400; color: #444; }
    td { height: 8.6mm; }
    .sira { width: 6mm; text-align: center; font-size: 7pt; color: #555; }
    .model { width: 26mm; }
    .renk { width: 26mm; }
    .adet { width: 18mm; }
    tfoot td { height: 9mm; }
    .toplam-etiket { text-align: right; padding-right: 2mm; font-size: 8pt; font-weight: 700; }
    .toplam { border-width: 0.6mm; }

    .notlar { border: 0.3mm dashed #555; border-radius: 1mm; height: 11mm; padding: 0.8mm 1.5mm; }
    .notlar span { font-size: 6.5pt; font-weight: 700; color: #555; }
    .imzalar { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-top: auto; }
    .imza { border-top: 0.4mm solid #111; padding-top: 1mm; text-align: center; font-size: 7.5pt; font-weight: 700; }
    .imza span { display: block; font-size: 6pt; font-weight: 400; color: #555; }
    footer { font-size: 5.8pt; color: #555; text-align: center; }

    @media screen {
        body { background: #e9edf1; padding: 8mm; }
        .sayfa { background: #fff; margin: 0 auto 8mm; padding: 8mm; width: 148mm; height: 210mm; box-shadow: 0 2px 10px rgba(0,0,0,.15); }
    }
</style>
</head>
<body>
${sayfalar}
<script>
    window.onload = function () { setTimeout(function () { window.print(); }, 200); };
</script>
</body>
</html>`;

    belgeAc(html, { baslik: 'Kesim Sevk İrsaliyesi — Boş Şablon' });
}

// Test/önizleme için HTML'i döndürür (yazdırma penceresi açmadan)
export function bosSevkSablonuHtml(secenek = {}) {
    const logoUrl = secenek.logoUrl || '';
    return sayfaHtml({ kesimhaneAdi: secenek.kesimhaneAdi || '', atolyeAdi: secenek.atolyeAdi || '', logoUrl });
}
