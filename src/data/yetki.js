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
    '/kumas-stok': 'kumas_stok',
    '/firmalar': 'firmalar',
    '/cari-hesaplar': 'cari_hesaplar',
    '/cari': 'cari_hesaplar',        // /cari/:id
    '/irsaliyeler': 'irsaliyeler',
    '/harita': 'harita',
    '/gorevlerim': 'gorevlerim',
    '/raporlar': 'raporlar',
    '/kullanicilar': 'kullanicilar',
    '/ayarlar': 'ayarlar',
};

// Yetki anahtarı → varsayılan giriş rotası (öncelik sırasıyla)
const YETKI_ROTA_SIRASI = [
    ['anasayfa', '/'],
    ['islerim', '/islerim'],
    ['gorevlerim', '/gorevlerim'],
    ['partiler', '/partiler'],
    ['is_akisi', '/is-akisi'],
    ['takvim', '/is-talep-takvimi'],
    ['urunler', '/urunler'],
    ['stok_takibi', '/stok-takibi'],
    ['kumas_stok', '/kumas-stok'],
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
    const yetkiler = user.yetkiler || [];
    if (yetkiler.includes(yetkiKey)) return true;
    // Eski kullanıcılar: Stok Takibi yetkisi Kumaş Stok sayfasını da kapsar (sunucuyla aynı kural)
    return yetkiKey === 'kumas_stok' && yetkiler.includes('stok_takibi');
}

// Kullanıcının erişebildiği ilk sayfa (yetkisiz rotaya girince yönlendirilir)
export function firstAllowedRoute(user) {
    for (const [yetki, rota] of YETKI_ROTA_SIRASI) {
        if (hasYetki(user, yetki)) return rota;
    }
    return null; // hiçbir yetkisi yok
}

// Cari hareket yazabilir mi? (public/inc/auth.php YETKI_YAZMA ile aynı kural:
// anasayfa / partiler / cari_hesaplar yetkisi myhis_cariHareketler yazmayı kapsar)
export function cariYazabilir(user) {
    if (!user) return false;
    if (user.rol === 'admin') return true;
    if (user.rol === 'izleyici' || user.rol === 'kesimhane') return false;
    return ['anasayfa', 'partiler', 'cari_hesaplar'].some(y => (user.yetkiler || []).includes(y));
}
