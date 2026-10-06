// İrsaliye PDF üretimi ve paylaşımı (WhatsApp dahil)
// Yöntem: irsaliye canvas'a çizilir (Türkçe karakterler sistem fontuyla
// sorunsuz), JPEG olarak minimal bir PDF'e gömülür ve Web Share API ile
// paylaşılır → iPhone'da paylaşım sayfasından WhatsApp seçilince PDF
// dosya olarak eklenir. Paylaşım desteklenmiyorsa (masaüstü) indirilir.
import QRCode from 'qrcode';
import { IRSALIYE_TIP_LABELS } from '../data/db';

// ---- Yardımcılar ----

// JPEG baytlarını tek sayfalık A4 PDF'e gömer (harici kütüphane gerekmez)
function jpegToPdfBlob(jpegBytes, imgW, imgH) {
    const pageW = 595.28, pageH = 841.89; // A4 (pt)
    const enc = new TextEncoder();
    const parts = [];
    let offset = 0;
    const offsets = [];
    const push = (data) => {
        const b = typeof data === 'string' ? enc.encode(data) : data;
        parts.push(b);
        offset += b.length;
    };
    const obj = (n, body) => {
        offsets[n] = offset;
        push(`${n} 0 obj\n${body}\nendobj\n`);
    };

    push('%PDF-1.3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`);

    offsets[4] = offset;
    push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
    push(jpegBytes);
    push('\nendstream\nendobj\n');

    const icerik = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im1 Do Q`;
    obj(5, `<< /Length ${icerik.length} >>\nstream\n${icerik}\nendstream`);

    const xrefStart = offset;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(xref + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    return new Blob(parts, { type: 'application/pdf' });
}

function resimYukle(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null); // logo yüklenemezse PDF logosuz üretilir
        img.src = src;
    });
}

// ---- İrsaliyeyi canvas'a çiz ----
async function irsaliyeCanvas(irsaliye) {
    const W = 1240, H = 1754; // A4 oranı (~150dpi)
    const M = 70;             // kenar boşluğu
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const MAVI = '#0078d4';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';

    const font = (px, agirlik = 400) => { ctx.font = `${agirlik} ${px}px 'Segoe UI', Arial, sans-serif`; };
    const kes = (metin, maxW) => {
        let t = String(metin ?? '');
        if (ctx.measureText(t).width <= maxW) return t;
        while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
        return t + '…';
    };

    // --- Başlık: logo + ünvan + QR + no/tarih ---
    let y = M;
    const logo = await resimYukle(new URL(import.meta.env.BASE_URL + 'his-logo.png', window.location.href).href);
    let solX = M;
    if (logo) {
        const lh = 84;
        ctx.drawImage(logo, M, y, lh * (logo.width / logo.height), lh);
        solX = M + lh * (logo.width / logo.height) + 24;
    }
    ctx.fillStyle = '#111';
    font(40, 800);
    ctx.fillText('SEVKİYAT İRSALİYESİ', solX, y + 44);
    ctx.fillStyle = MAVI;
    font(24, 700);
    const tipLabel = irsaliye.tipLabel || IRSALIYE_TIP_LABELS[irsaliye.tip] || 'Sevkiyat';
    ctx.fillText(tipLabel.toUpperCase(), solX, y + 80);

    // QR (sağ üst)
    if (irsaliye.partiId) {
        try {
            const qrCanvas = document.createElement('canvas');
            const partiUrl = new URL(`#/parti/${irsaliye.partiId}`, window.location.href).href;
            await QRCode.toCanvas(qrCanvas, partiUrl, { margin: 1, width: 130 });
            ctx.drawImage(qrCanvas, W - M - 130, y - 10);
        } catch (e) { /* QR üretilemezse atla */ }
    }

    // No / parti / tarih (QR'ın solunda)
    const sagX = W - M - 160;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#111';
    font(30, 800);
    ctx.fillText(irsaliye.irsaliyeNo || 'TASLAK', sagX, y + 26);
    ctx.fillStyle = '#444';
    font(24, 400);
    ctx.fillText('Parti: ' + (irsaliye.partiNo || '—'), sagX, y + 60);
    const tarih = irsaliye.tarih ? new Date(irsaliye.tarih) : new Date();
    ctx.fillText(tarih.toLocaleDateString('tr-TR'), sagX, y + 92);
    ctx.textAlign = 'left';

    y += 130;
    ctx.strokeStyle = MAVI;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke();
    y += 36;

    // --- Gönderen / Alan kutuları ---
    const kutuW = (W - 2 * M - 30) / 2;
    const kutuH = 150;
    const kutuCiz = (x, etiket, ad, tel, adres, vurgulu) => {
        ctx.strokeStyle = vurgulu ? MAVI : '#bbb';
        ctx.lineWidth = vurgulu ? 3 : 1.5;
        ctx.strokeRect(x, y, kutuW, kutuH);
        ctx.fillStyle = vurgulu ? MAVI : '#666';
        font(20, 800);
        ctx.fillText(etiket, x + 20, y + 34);
        ctx.fillStyle = '#111';
        font(30, 700);
        ctx.fillText(kes(ad || '—', kutuW - 40), x + 20, y + 74);
        ctx.fillStyle = '#555';
        font(21, 400);
        if (tel) ctx.fillText('Tel: ' + tel, x + 20, y + 106);
        if (adres) ctx.fillText(kes(adres, kutuW - 40), x + 20, y + 134);
    };
    kutuCiz(M, 'GÖNDEREN', irsaliye.gonderenFirmaAdi, irsaliye.gonderenTel, irsaliye.gonderenAdres, false);
    kutuCiz(M + kutuW + 30, 'ALAN (TESLİM)', irsaliye.alanFirmaAdi, irsaliye.alanTel, irsaliye.alanAdres, true);
    y += kutuH + 30;

    // --- Ürün barı ---
    ctx.fillStyle = '#f2f6fa';
    ctx.fillRect(M, y, W - 2 * M, 64);
    ctx.strokeStyle = '#d5dde5';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(M, y, W - 2 * M, 64);
    ctx.fillStyle = '#111';
    font(26, 700);
    ctx.fillText(kes(`${irsaliye.urunKodu || ''} — ${irsaliye.urunAdi || ''}`, W - 2 * M - 320), M + 20, y + 41);
    ctx.fillStyle = MAVI;
    font(30, 800);
    ctx.textAlign = 'right';
    ctx.fillText(`${(irsaliye.toplamAdet || 0).toLocaleString('tr-TR')} ADET`, W - M - 20, y + 42);
    ctx.textAlign = 'left';
    y += 64 + 30;

    // --- Renk / beden tablosu ---
    const bedenler = irsaliye.asorti?.bedenler || [];
    const renkler = irsaliye.renkler || [];
    if (renkler.length > 0) {
        const kolonlar = ['Renk', 'Kat', ...bedenler, 'Toplam'];
        const tabloW = W - 2 * M;
        const renkKolW = tabloW * 0.24;
        const digerKolW = (tabloW - renkKolW) / (kolonlar.length - 1);
        const satirH = 52;

        const hucre = (metin, x, w, satirY, kalin, hiza = 'center', arka = null) => {
            if (arka) { ctx.fillStyle = arka; ctx.fillRect(x, satirY, w, satirH); }
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(x, satirY, w, satirH);
            ctx.fillStyle = '#111';
            font(22, kalin ? 700 : 400);
            ctx.textAlign = hiza;
            const tx = hiza === 'left' ? x + 14 : x + w / 2;
            ctx.fillText(kes(metin, w - 20), tx, satirY + 34);
            ctx.textAlign = 'left';
        };

        const satirCiz = (degerler, satirY, kalin, arka) => {
            let x = M;
            degerler.forEach((deger, i) => {
                const w = i === 0 ? renkKolW : digerKolW;
                hucre(deger, x, w, satirY, kalin, i === 0 ? 'left' : 'center', arka);
                x += w;
            });
        };

        satirCiz(kolonlar, y, true, '#eef1f4');
        y += satirH;
        renkler.forEach(r => {
            satirCiz([r.renk, r.katSayisi, ...bedenler.map(b => r.bedenAdetleri?.[b] || 0), r.toplam], y, false, null);
            y += satirH;
        });
        const bedenToplam = bedenler.map(b => renkler.reduce((t, r) => t + (r.bedenAdetleri?.[b] || 0), 0));
        satirCiz(['GENEL TOPLAM', '', ...bedenToplam, irsaliye.toplamAdet || 0], y, true, '#eef1f4');
        y += satirH + 36;
    }

    // --- Notlar ---
    ctx.strokeStyle = '#999';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(M, y, W - 2 * M, 110);
    ctx.setLineDash([]);
    ctx.fillStyle = '#888';
    font(18, 700);
    ctx.fillText('NOTLAR / AÇIKLAMA', M + 20, y + 30);
    ctx.fillStyle = '#333';
    font(22, 400);
    ctx.fillText(kes(irsaliye.notlar || '', W - 2 * M - 40), M + 20, y + 68);
    y += 110 + 90;

    // --- İmza alanları ---
    const imzaW = (W - 2 * M - 120) / 2;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    [[M, 'TESLİM EDEN', 'Ad Soyad / İmza'], [M + imzaW + 120, 'TESLİM ALAN', 'Ad Soyad / İmza / Kaşe']].forEach(([x, baslik, alt]) => {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + imzaW, y); ctx.stroke();
        ctx.fillStyle = '#444';
        font(21, 700);
        ctx.textAlign = 'center';
        ctx.fillText(baslik, x + imzaW / 2, y + 32);
        ctx.fillStyle = '#999';
        font(17, 400);
        ctx.fillText(alt, x + imzaW / 2, y + 58);
        ctx.textAlign = 'left';
    });

    return canvas;
}

// İrsaliyeden PDF blob'u üretir
export async function irsaliyePdfBlob(irsaliye) {
    const canvas = await irsaliyeCanvas(irsaliye);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const jpegBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
    return jpegToPdfBlob(jpegBytes, canvas.width, canvas.height);
}

// PDF'i paylaş: mobilde paylaşım sayfası (WhatsApp'a dosya ekli gider),
// desteklenmeyen ortamda (masaüstü) dosya indirilir.
export async function irsaliyePdfPaylas(irsaliye) {
    const blob = await irsaliyePdfBlob(irsaliye);
    const dosyaAdi = `irsaliye-${(irsaliye.irsaliyeNo || irsaliye.partiNo || 'taslak').replace(/[^\w-]/g, '')}.pdf`;
    const file = new File([blob], dosyaAdi, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: `İrsaliye ${irsaliye.irsaliyeNo || ''}`.trim(),
            });
            return 'paylasildi';
        } catch (e) {
            if (e.name === 'AbortError') return 'iptal'; // kullanıcı paylaşımı kapattı
            // paylaşım hatasında indirme yoluna düş
        }
    }

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = dosyaAdi;
    link.click();
    URL.revokeObjectURL(link.href);
    return 'indirildi';
}
