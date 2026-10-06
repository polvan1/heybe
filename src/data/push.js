// Telefon push bildirimleri: abone olma/çıkma yardımcıları
import { apiIstek } from './api';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Bu cihaz push destekliyor mu?
export function pushDestekliMi() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// iOS Safari'de push yalnızca ana ekrana eklenmiş PWA'da çalışır
export function iosKuruluDegilMi() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    return isIOS && !standalone;
}

export async function pushDurumu() {
    if (!pushDestekliMi()) return 'desteklenmiyor';
    if (Notification.permission === 'denied') return 'engellendi';
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return 'kapali';
        const sub = await reg.pushManager.getSubscription();
        return sub ? 'acik' : 'kapali';
    } catch (e) {
        return 'kapali';
    }
}

export async function pushAc() {
    if (!pushDestekliMi()) throw new Error('Bu tarayıcı push bildirimlerini desteklemiyor.');
    if (iosKuruluDegilMi()) {
        throw new Error('iPhone\'da bildirimler için önce uygulamayı ana ekrana ekleyin: Safari → Paylaş → "Ana Ekrana Ekle", sonra uygulamayı ana ekrandan açıp tekrar deneyin.');
    }

    const izin = await Notification.requestPermission();
    if (izin !== 'granted') throw new Error('Bildirim izni verilmedi.');

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        // Public key sunucudaki config.php'den alınır (tek kaynak)
        const { publicKey } = await apiIstek('push=anahtar');
        if (!publicKey) throw new Error('Sunucuda bildirim anahtarı (VAPID) tanımlı değil.');
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
    }

    await apiIstek('push=subscribe', sub.toJSON());
    return true;
}

export async function pushKapat() {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    try {
        await apiIstek('push=unsubscribe', { endpoint: sub.endpoint });
    } catch (e) { /* sunucu kaydı silinemese de yerel abonelik iptal edilir */ }
    await sub.unsubscribe();
}

export async function pushTest() {
    await apiIstek('push=test', {});
}
