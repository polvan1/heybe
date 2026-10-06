// Fotoğraf yükleme yardımcıları
// Seçilen görsel tarayıcıda küçültülür (max 900px, JPEG) ve sunucuya
// base64 olarak gönderilir; sunucu dosyayı uploads/ klasörüne kaydeder.
import { API_URL, API_KEY } from '../data/api';

const MAX_BOYUT = 900;      // uzun kenar (px)
const JPEG_KALITE = 0.8;

function dosyayiKucult(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > MAX_BOYUT || height > MAX_BOYUT) {
                const oran = MAX_BOYUT / Math.max(width, height);
                width = Math.round(width * oran);
                height = Math.round(height * oran);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', JPEG_KALITE));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Görsel okunamadı.')); };
        img.src = url;
    });
}

// Görseli belirtilen uzun kenara küçültüp data-URL döndürür
// (yapay zekâ irsaliye okuma için yüksek çözünürlük gerekir: ~1600px)
export function gorselDataUrl(file, maxBoyut = 1600, kalite = 0.85) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > maxBoyut || height > maxBoyut) {
                const oran = maxBoyut / Math.max(width, height);
                width = Math.round(width * oran);
                height = Math.round(height * oran);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', kalite));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Görsel okunamadı.')); };
        img.src = url;
    });
}

// Dosyayı küçültüp yükler; sunucudaki göreli yolu döndürür (örn: 'uploads/ab12cd.jpg')
export async function fotoYukle(file) {
    if (!file.type.startsWith('image/')) throw new Error('Lütfen bir görsel dosyası seçin.');
    const dataUrl = await dosyayiKucult(file);
    const resp = await fetch(`${API_URL}?foto=upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
        body: JSON.stringify({ data: dataUrl }),
    });
    if (!resp.ok) throw new Error('Fotoğraf sunucuya yüklenemedi.');
    const json = await resp.json();
    if (!json.url) throw new Error(json.error || 'Fotoğraf kaydedilemedi.');
    return json.url;
}

export async function fotoSil(url) {
    if (!url) return;
    try {
        await fetch(`${API_URL}?foto=sil`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
            body: JSON.stringify({ url }),
        });
    } catch (e) { /* sunucudaki dosya silinemese de kayıttan düşer */ }
}

// Göreli foto yolunu tam URL'ye çevirir
export function fotoSrc(url) {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return import.meta.env.BASE_URL + url;
}
