// WhatsApp paylaşım yardımcıları
import { IRSALIYE_TIP_LABELS } from '../data/db';

// '0532 111 22 33' → '905321112233' (wa.me formatı)
export function telefonNormalize(tel) {
    if (!tel) return '';
    let t = String(tel).replace(/\D/g, '');
    if (t.startsWith('00')) t = t.slice(2);
    if (t.startsWith('0')) t = '90' + t.slice(1);
    else if (t.length === 10) t = '90' + t; // 5321112233
    return t;
}

// Telefon varsa doğrudan o kişiye, yoksa kişi seçtirerek açar
export function whatsappAc(telefon, metin) {
    const tel = telefonNormalize(telefon);
    const url = tel
        ? `https://wa.me/${tel}?text=${encodeURIComponent(metin)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(metin)}`;
    window.open(url, '_blank');
}

// İrsaliye özet metni (WhatsApp mesajı olarak)
export function irsaliyeMetni(irsaliye) {
    const satirlar = [
        `📦 *SEVKİYAT İRSALİYESİ*`,
        `İrsaliye No: ${irsaliye.irsaliyeNo || 'Taslak'}`,
        `Parti: ${irsaliye.partiNo || '—'}`,
        `Tarih: ${new Date(irsaliye.tarih || Date.now()).toLocaleDateString('tr-TR')}`,
        ``,
        `Ürün: ${irsaliye.urunKodu || ''} ${irsaliye.urunAdi || ''}`.trim(),
        `Toplam: *${(irsaliye.toplamAdet || 0).toLocaleString('tr-TR')} adet*`,
        ``,
        `Gönderen: ${irsaliye.gonderenFirmaAdi || '—'}`,
        `Alan: ${irsaliye.alanFirmaAdi || '—'}`,
        `Sevkiyat: ${IRSALIYE_TIP_LABELS[irsaliye.tip] || '—'}`,
    ];

    // Renk / beden dökümü
    const renkler = irsaliye.renkler || [];
    if (renkler.length > 0) {
        satirlar.push('', '*Renk Dökümü:*');
        renkler.forEach(r => {
            const bedenler = Object.entries(r.bedenAdetleri || {})
                .filter(([, adet]) => adet > 0)
                .map(([b, adet]) => `${b}:${adet}`)
                .join(' ');
            satirlar.push(`• ${r.renk}: ${r.toplam} adet${bedenler ? ` (${bedenler})` : ''}`);
        });
    }

    if (irsaliye.notlar) satirlar.push('', `Not: ${irsaliye.notlar}`);
    return satirlar.join('\n');
}
