// Ortak irsaliye yazdırma şablonu — sade, logolu, QR kodlu, A4/A5 uyumlu.
// Hem İrsaliyeler sayfası (kayıtlı irsaliye) hem Partiler'deki hızlı
// yazdırma (kayıtsız) bu şablonu kullanır.
import QRCode from 'qrcode';
import { IRSALIYE_TIP_LABELS } from '../data/db';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function yazdirIrsaliye(irsaliye, boyut = 'A4') {
    const a5 = boyut === 'A5';
    const logoUrl = new URL(import.meta.env.BASE_URL + 'his-logo.png', window.location.href).href;
    const tipLabel = irsaliye.tipLabel || IRSALIYE_TIP_LABELS[irsaliye.tip] || 'Sevkiyat';
    const tarih = irsaliye.tarih ? new Date(irsaliye.tarih) : new Date();

    // QR: telefonla okutunca uygulamada ilgili parti açılır
    let qrDataUrl = '';
    if (irsaliye.partiId) {
        try {
            const partiUrl = new URL(`#/parti/${irsaliye.partiId}`, window.location.href).href;
            qrDataUrl = await QRCode.toDataURL(partiUrl, { margin: 1, width: 160 });
        } catch (e) { /* QR üretilemezse irsaliye QR'sız basılır */ }
    }

    const bedenler = irsaliye.asorti?.bedenler || [];
    const renkler = irsaliye.renkler || [];

    const renkRows = renkler.map(r => `
        <tr>
            <td class="sol">${esc(r.renk)}</td>
            <td>${esc(r.katSayisi)}</td>
            ${bedenler.map(b => `<td>${r.bedenAdetleri?.[b] || 0}</td>`).join('')}
            <td class="kalin">${esc(r.toplam)}</td>
        </tr>`).join('');

    const bedenToplamlari = bedenler.map(b =>
        `<td class="kalin">${renkler.reduce((t, r) => t + (r.bedenAdetleri?.[b] || 0), 0)}</td>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>İrsaliye ${esc(irsaliye.irsaliyeNo || irsaliye.partiNo || '')}</title>
<style>
    /* Kağıt boyutu: yazdırma diyaloğunda otomatik ${boyut} seçilir */
    @page { size: ${boyut} portrait; margin: ${a5 ? '8mm' : '12mm'}; }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Segoe UI', Arial, sans-serif;
        color: #111;
        font-size: ${a5 ? '10px' : '13px'};
        line-height: 1.45;
        padding: ${a5 ? '4mm' : '6mm'};
    }

    /* ---- Başlık ---- */
    .ust {
        display: flex; justify-content: space-between; align-items: center;
        border-bottom: 2px solid #0078d4;
        padding-bottom: ${a5 ? '4px' : '8px'};
        margin-bottom: ${a5 ? '8px' : '14px'};
    }
    .ust-sol { display: flex; align-items: center; gap: ${a5 ? '6px' : '10px'}; }
    .ust-sol img { height: ${a5 ? '26px' : '40px'}; }
    .ust-sol h1 { font-size: ${a5 ? '12px' : '17px'}; letter-spacing: 0.5px; }
    .ust-sol .tip { font-size: ${a5 ? '8px' : '11px'}; color: #0078d4; font-weight: 700; text-transform: uppercase; }
    .ust-sag { text-align: right; font-size: ${a5 ? '8.5px' : '11px'}; color: #444; }
    .ust-sag .no { font-size: ${a5 ? '10px' : '13px'}; font-weight: 800; color: #111; }

    /* ---- Gönderen / Alan ---- */
    .firmalar { display: grid; grid-template-columns: 1fr 1fr; gap: ${a5 ? '6px' : '12px'}; margin-bottom: ${a5 ? '8px' : '14px'}; }
    .kutu { border: 1px solid #bbb; border-radius: 4px; padding: ${a5 ? '5px 7px' : '9px 12px'}; }
    .kutu.alan { border: 2px solid #0078d4; }
    .kutu .etiket { font-size: ${a5 ? '7px' : '9px'}; font-weight: 800; letter-spacing: 1px; color: #666; }
    .kutu.alan .etiket { color: #0078d4; }
    .kutu .ad { font-size: ${a5 ? '10.5px' : '14px'}; font-weight: 700; }
    .kutu .meta { font-size: ${a5 ? '8px' : '10px'}; color: #555; }

    /* ---- Ürün ---- */
    .urun {
        display: flex; justify-content: space-between; align-items: center;
        background: #f2f6fa; border: 1px solid #d5dde5; border-radius: 4px;
        padding: ${a5 ? '4px 8px' : '8px 12px'}; margin-bottom: ${a5 ? '7px' : '12px'};
    }
    .urun .adet { font-size: ${a5 ? '11px' : '15px'}; font-weight: 800; color: #0078d4; white-space: nowrap; }

    /* ---- Tablo ---- */
    table { width: 100%; border-collapse: collapse; font-size: ${a5 ? '8.5px' : '11px'}; }
    th, td { border: 1px solid #444; padding: ${a5 ? '3px 4px' : '6px 8px'}; text-align: center; }
    th { background: #eef1f4; font-size: ${a5 ? '8px' : '10px'}; }
    td.sol, th.sol { text-align: left; }
    .kalin { font-weight: 700; }
    .toplam-satiri td { background: #eef1f4; font-weight: 800; }

    /* ---- Notlar & İmza ---- */
    .notlar { margin-top: ${a5 ? '7px' : '14px'}; border: 1px dashed #999; border-radius: 4px; padding: ${a5 ? '4px 7px' : '8px 12px'}; min-height: ${a5 ? '26px' : '44px'}; font-size: ${a5 ? '8.5px' : '11px'}; }
    .notlar .baslik { font-size: ${a5 ? '7px' : '9px'}; font-weight: 700; color: #888; text-transform: uppercase; }
    .imzalar { display: grid; grid-template-columns: 1fr 1fr; gap: ${a5 ? '16px' : '40px'}; margin-top: ${a5 ? '18px' : '36px'}; }
    .imza { border-top: 1.5px solid #333; padding-top: ${a5 ? '3px' : '6px'}; text-align: center; font-size: ${a5 ? '8px' : '10px'}; color: #444; font-weight: 700; }
    .imza span { font-weight: 400; font-size: ${a5 ? '7px' : '9px'}; color: #999; }

    /* ---- QR ---- */
    .qr-alani { display: flex; align-items: center; gap: ${a5 ? '6px' : '10px'}; }
    .qr-alani img { width: ${a5 ? '44px' : '68px'}; height: ${a5 ? '44px' : '68px'}; }
    .qr-alani .aciklama { font-size: ${a5 ? '6.5px' : '8.5px'}; color: #888; max-width: ${a5 ? '70px' : '110px'}; line-height: 1.3; }
</style>
</head>
<body>
    <div class="ust">
        <div class="ust-sol">
            <img src="${logoUrl}" alt="" onerror="this.style.display='none'">
            <div>
                <h1>SEVKİYAT İRSALİYESİ</h1>
                <div class="tip">${esc(tipLabel)}</div>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:${a5 ? '8px' : '14px'}">
            ${qrDataUrl ? `
            <div class="qr-alani">
                <div class="aciklama">Parti takibi için telefonla okutun</div>
                <img src="${qrDataUrl}" alt="QR">
            </div>` : ''}
            <div class="ust-sag">
                <div class="no">${esc(irsaliye.irsaliyeNo || 'TASLAK')}</div>
                <div>Parti: <b>${esc(irsaliye.partiNo || '—')}</b></div>
                <div>${tarih.toLocaleDateString('tr-TR')}</div>
            </div>
        </div>
    </div>

    <div class="firmalar">
        <div class="kutu">
            <div class="etiket">GÖNDEREN</div>
            <div class="ad">${esc(irsaliye.gonderenFirmaAdi || '—')}</div>
            ${irsaliye.gonderenTel ? `<div class="meta">Tel: ${esc(irsaliye.gonderenTel)}</div>` : ''}
            ${irsaliye.gonderenAdres ? `<div class="meta">${esc(irsaliye.gonderenAdres)}</div>` : ''}
        </div>
        <div class="kutu alan">
            <div class="etiket">ALAN (TESLİM)</div>
            <div class="ad">${esc(irsaliye.alanFirmaAdi || '—')}</div>
            ${irsaliye.alanTel ? `<div class="meta">Tel: ${esc(irsaliye.alanTel)}</div>` : ''}
            ${irsaliye.alanAdres ? `<div class="meta">${esc(irsaliye.alanAdres)}</div>` : ''}
        </div>
    </div>

    <div class="urun">
        <div><b>${esc(irsaliye.urunKodu || '')}</b> ${irsaliye.urunKodu ? '—' : ''} ${esc(irsaliye.urunAdi || '')}</div>
        <div class="adet">${(irsaliye.toplamAdet || 0).toLocaleString('tr-TR')} ADET</div>
    </div>

    ${renkler.length > 0 ? `
    <table>
        <thead>
            <tr>
                <th class="sol">Renk</th>
                <th>Kat</th>
                ${bedenler.map(b => `<th>${esc(b)}</th>`).join('')}
                <th>Toplam</th>
            </tr>
        </thead>
        <tbody>
            ${renkRows}
            <tr class="toplam-satiri">
                <td colspan="2" class="sol">GENEL TOPLAM</td>
                ${bedenToplamlari}
                <td>${irsaliye.toplamAdet || 0}</td>
            </tr>
        </tbody>
    </table>` : ''}

    <div class="notlar">
        <div class="baslik">Notlar / Açıklama</div>
        ${esc(irsaliye.notlar || '')}
    </div>

    <div class="imzalar">
        <div class="imza">TESLİM EDEN<br><span>Ad Soyad / İmza</span></div>
        <div class="imza">TESLİM ALAN<br><span>Ad Soyad / İmza / Kaşe</span></div>
    </div>

    <script>
        // Logo yüklendikten sonra yazdır (boş görsel basılmasın)
        window.onload = function () {
            setTimeout(function () { window.print(); window.close(); }, 150);
        };
    </script>
</body>
</html>`;

    const pw = window.open('', '_blank', 'width=800,height=900');
    if (!pw) {
        alert('Yazdırma penceresi açılamadı. Tarayıcınızın açılır pencere engelleyicisini kontrol edin.');
        return;
    }
    pw.document.write(html);
    pw.document.close();
    pw.focus();
}
