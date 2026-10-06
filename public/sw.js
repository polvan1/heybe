// HİS ERP - Service Worker
// Strateji:
//  - api.php  : HER ZAMAN ağ (veri asla önbellekten gelmez)
//  - assets/  : önce önbellek (dosya adları hash'li olduğu için güvenli)
//  - diğerleri: önce ağ, çevrimdışıysa önbellek
const CACHE_NAME = 'his-erp-v2';

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Veri API'si: asla önbellekleme
    if (url.pathname.endsWith('api.php')) return;

    // Hash'li asset'ler: cache-first
    if (url.pathname.includes('/assets/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                cache.match(request).then(hit =>
                    hit || fetch(request).then(res => {
                        if (res.ok) cache.put(request, res.clone());
                        return res;
                    })
                )
            )
        );
        return;
    }

    // Diğer her şey (index.html, manifest, ikonlar): network-first
    event.respondWith(
        fetch(request)
            .then(res => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return res;
            })
            .catch(() => caches.match(request))
    );
});

// ============================================================
// PUSH BİLDİRİMLERİ
// Sunucu payload'sız push gönderir; en son bildirimi API'den
// çekip cihazda gösteririz. (iOS: her push'ta bildirim
// gösterilmesi ZORUNLU, yoksa abonelik iptal edilir.)
// ============================================================
self.addEventListener('push', (event) => {
    const goster = async () => {
        let baslik = 'HİS ERP';
        let mesaj = 'Yeni bildiriminiz var';
        let link = './';
        try {
            const resp = await fetch(`./api.php?push=son&t=${Date.now()}`, { credentials: 'same-origin' });
            if (resp.ok) {
                const data = await resp.json();
                if (data.bildirim) {
                    baslik = data.bildirim.baslik || baslik;
                    mesaj = data.bildirim.mesaj || mesaj;
                    if (data.bildirim.link) link = './#' + data.bildirim.link;
                }
            }
        } catch (e) { /* ağ hatası: genel metinle göster */ }

        return self.registration.showNotification(baslik, {
            body: mesaj,
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag: 'his-erp-bildirim',
            data: { link },
        });
    };
    event.waitUntil(goster());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const link = (event.notification.data && event.notification.data.link) || './';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            // Uygulama açıksa odaklan, değilse yeni pencerede aç
            for (const c of list) {
                if ('focus' in c) {
                    c.navigate(link);
                    return c.focus();
                }
            }
            return clients.openWindow(link);
        })
    );
});
