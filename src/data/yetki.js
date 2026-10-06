// Sayfa yetkileri: rota ↔ yetki anahtarı eşlemesi ve kontrol yardımcıları
// Yetki anahtarları Kullanicilar.jsx'teki TUM_YETKILER ile aynıdır.

export const ROUTE_YETKI = {
    '/': 'anasayfa',
    '/islerim': 'islerim',           // fasoncu paneli
    '/partiler': 'partiler',
    '/parti': 'partiler',            // /parti/:id
    '/is-akisi': 'is_akisi',
    '/is-talep-takvimi': 'takvim',
    '/urunler': 'urunler',
    '/stok-takibi': 'stok_takibi',
    '/kumas-stok': 'stok_takibi',
    '/firmalar': 'firmalar',
    '/cari-hesaplar': 'cari_hesaplar',
    '/cari': 'cari_hesaplar',        // /cari/:id
    '/irsaliyeler': 'irsaliyeler',
    '/harita': 'harita',
    '/raporlar': 'raporlar',
    '/kullanicilar': 'kullanicilar',
    '/ayarlar': 'ayarlar',
};

// Yetki anahtarı → varsayılan giriş rotası (öncelik sırasıyla)
const YETKI_ROTA_SIRASI = [
    ['anasayfa', '/'],
    ['islerim', '/islerim'],
    ['partiler', '/partiler'],
    ['is_akisi', '/is-akisi'],
    ['takvim', '/is-talep-takvimi'],
    ['urunler', '/urunler'],
    ['stok_takibi', '/stok-takibi'],
    ['firmalar', '/firmalar'],
    ['cari_hesaplar', '/cari-hesaplar'],
    ['irsaliyeler', '/irsaliyeler'],
    ['harita', '/harita'],
    ['raporlar', '/raporlar'],
    ['kullanicilar', '/kullanicilar'],
    ['ayarlar', '/ayarlar'],
];

export function hasYetki(user, yetkiKey) {
    if (!user) return false;
    if (user.rol === 'admin') return true; // Yönetici her sayfaya erişir
    return (user.yetkiler || []).includes(yetkiKey);
}

// Kullanıcının erişebildiği ilk sayfa (yetkisiz rotaya girince yönlendirilir)
export function firstAllowedRoute(user) {
    for (const [yetki, rota] of YETKI_ROTA_SIRASI) {
        if (hasYetki(user, yetki)) return rota;
    }
    return null; // hiçbir yetkisi yok
}
