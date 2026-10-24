// HİS ERP - Çevrimdışı depo (IndexedDB)
// İnternet yokken yapılan değişikliklerin kaybolmaması için her kullanıcının
// son verisi, sunucunun bilinen hali ve gönderilmemiş koleksiyonları bu cihazda
// saklanır. Bağlantı gelince db.js bekleyenleri gönderir. IndexedDB yoksa
// (özel pencere vb.) sessizce devre dışı kalır: uygulama eskisi gibi çalışır.

const DB_ADI = 'hiserp';
const DEPO = 'kv';
let acilis = null;

function ac() {
    if (acilis) return acilis;
    acilis = new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') { resolve(null); return; }
            const istek = indexedDB.open(DB_ADI, 1);
            istek.onupgradeneeded = () => istek.result.createObjectStore(DEPO);
            istek.onsuccess = () => resolve(istek.result);
            istek.onerror = () => resolve(null);
            istek.onblocked = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
    return acilis;
}

async function islem(mod, fn) {
    const db = await ac();
    if (!db) return undefined;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(DEPO, mod);
            const sonuc = fn(tx.objectStore(DEPO));
            tx.oncomplete = () => resolve(sonuc?.result);
            tx.onerror = () => resolve(undefined);
            tx.onabort = () => resolve(undefined);
        } catch (e) {
            resolve(undefined);
        }
    });
}

export const kvOku = (anahtar) => islem('readonly', s => s.get(anahtar));
export const kvYaz = (anahtar, deger) => islem('readwrite', s => s.put(deger, anahtar));
export const kvSil = (anahtar) => islem('readwrite', s => s.delete(anahtar));

// Kullanıcıya özel veri anahtarı: aynı cihazı kullanan farklı kişilerin
// bekleyen değişiklikleri birbirine karışmaz.
export const durumAnahtari = (kullaniciId) => `durum:${kullaniciId}`;
export const SON_KULLANICI = 'son-kullanici';

// Ağ hatası mı? (sunucunun verdiği HTTP hatası değil; bağlantı hiç kurulamadı)
export function agHatasiMi(e) {
    return !!e && (e.name === 'TypeError' || e.durum === 0 || e.kod === 'ag_yok');
}
