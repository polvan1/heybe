// HİS ERP - Service Worker
// Strateji:
//  - api.php  : HER ZAMAN ağ (veri asla önbellekten gelmez; çevrimdışı veri uygulamada IndexedDB'de)
//  - assets/  : önce önbellek (dosya adları hash'li olduğu için güvenli)
//  - diğerleri: önce ağ, çevrimdışıysa önbellek
// Kurulumda asset-listesi.json'daki tüm sayfa dosyaları indirilir: internet yokken
// daha önce hiç açılmamış sayfalar da açılabilir.
const CACHE_NAME = 'his-erp-v3';
const KABUK = ['./', './index.html', './manifest.json', './his-logo.png', './icon-192.png'];

async function onbellegiDoldur() {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(KABUK.map(u => cache.add(u).catch(() => {})));
    try {
        const yanit = await fetch('./asset-listesi.json', { cache: 'no-store' });
        if (!yanit.ok) return;
        const liste = await yanit.json();
        const gecerli = new Set(liste.map(f => new URL('./' + f, self.registration.scope).href));
        // Eski sürümlerden kalan asset'leri temizle
        for (const istek of await cache.keys()) {
            if (istek.url.includes('/assets/') && !gecerli.has(istek.url)) await cache.delete(istek);
        }
        await Promise.all([...gecerli].map(async (u) => {
            if (!(await cache.match(u))) await cache.add(u).catch(() => {});
        }));
    } catch (e) { /* liste yoksa (geliştirme) sadece açılan dosyalar önbelleğe alınır */ }
}

self.addEventListener('install', (event) => {
    event.waitUntil(onbellegiDoldur().finally(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Uygulama her açılışta yeni sürüm dosyalarını önbelleğe almasını isteyebilir
self.addEventListener('message', (event) => {
    if (event.data === 'onbellegi-guncelle') event.waitUntil(onbellegiDoldur());
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
            .catch(async () => (await caches.match(request)) ||
                (request.mode === 'navigate' ? (await caches.match('./index.html')) || caches.match('./') : undefined))
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
