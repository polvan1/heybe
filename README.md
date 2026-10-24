# HİS ERP — Fason Tekstil Üretim Takip

Mobil uyumlu (PWA) web tabanlı fason tekstil üretim takip sistemi:
partiler (kesim → dikim → ütü/paket), firmalar, ürünler, irsaliyeler,
cari hesaplar, kumaş stok, raporlar, kullanıcı/yetki yönetimi.

## Teknoloji
- Ön yüz: React 18 + Vite 6 + React Router (`src/`)
- Sunucu: PHP 8 (`public/api.php` + `public/inc/`), üretimde MySQL (cPanel)
- Giriş/oturum sunucu tarafında (PHP session, HttpOnly çerez); kodda anahtar yok

## Roller
Yönetici, Üretim Sorumlusu, Muhasebe, **Kesimhane Yetkilisi**, Fasoncu, Şoför, İzleyici.
Kesimhane yetkilisi bir kesimhane firmasına bağlanır; sadece o kesimhanenin partilerini,
irsaliyelerini ve kumaş stoğunu görür. Parti oluşturur, kesim adetlerini girip
"Kesildi" / "Dikime gönderildi" işaretler; oluşturduğu irsaliyeler taslak olur ve
yönetici onaylar. Diğer rollerin oluşturduğu irsaliyeler doğrudan "Onaylandı" olur.
Bu kurallar sunucuda da uygulanır (`public/inc/kesimhane.php`).

## Güvenlik ve çalışma kuralları
- **Silme şifresi** sunucuda doğrulanır (kodda şifre yoktur). Yönetici Ayarlar → Güvenlik'ten ortak bir silme şifresi belirler; belirlenmemişse herkes kendi giriş şifresini girer. Doğru şifreden sonra 10 dakika silme izni verilir; 5 hatalı denemede 15 dakika kilit.
- **Fasoncu** sadece kendi firmasının partilerini, irsaliyelerini ve carisini görür; diğer firmaların bilgileri ve fiyatları sunucudan hiç gönderilmez. Fasoncu yalnızca teslim bildirimi yapar.
- **Pasif firmalar** yeni parti, irsaliye ve kumaş girişine atanamaz (sunucu da reddeder); geçmiş kayıtları korunur.
- **Çevrimdışı çalışma:** İnternet yokken yapılan değişiklikler cihazda (IndexedDB) saklanır, bağlantı gelince otomatik gönderilir. Uygulama internetsiz de açılır (son veriler). Çıkış yapınca cihazdaki kayıt silinir.
- **QR:** Parti Detay → "Etiket" ile QR'lı parti etiketi basılır (10×7 cm ya da A4'e 8'li). Partiler → "QR Okut" ile etiket/irsaliye QR'ı okutulup parti açılır ve sıradaki adıma ilerletilir.
- **Excel/PDF:** Cari ekstre (tarih aralıklı, yürüyen bakiye), cari listesi, partiler, irsaliyeler, kumaş stok ve raporlar Excel (.xlsx) olarak; ekstre, cari listesi ve raporlar PDF olarak alınır.

## Arayüz ve tasarım sistemi
- Tüm renk, aralık (8px sistemi), köşe, gölge ve hareket değerleri tek yerde:
  `src/styles/tokens.css` (açık tema `:root`, koyu tema `[data-theme="dark"]`).
- Stil katmanları: `base` → `layout` (menü, üst bar, alt menü) → `components`
  (kart, düğme, form, rozet, tablo, modal) → `charts` → `features` (sayfalara özgü) → `utilities`.
- Ortak React bileşenleri: `src/components/ui/` (`BarChart`, `DonutChart`, `Notice`, `MetricTile`).
- İkonlar yalnızca Lucide (çizgi, 1.75–2px); yeni renk eklerken token tanımlayın, sabit hex yazmayın.
  Düğmeler: `btn-primary` (sayfadaki ana eylem), `btn-soft` (listelerde tekrar eden eylem), `btn-ghost` (ikincil).

## Geliştirme
Gereksinimler: Node.js 20+, pnpm, PHP 8+ (`pdo_sqlite` eklentisiyle).
```bash
pnpm install
pnpm run dev                # http://localhost:5173 (PHP API + SQLite birlikte başlar)
pnpm run build              # dist/ klasörüne derler
```
- Geliştirme verisi `dev/data/dev.sqlite` dosyasındadır (depoya gönderilmez).
- Gerçek bir yedeği geliştirme ortamına yüklemek için:
  `php dev/yedek-yukle.php yedek.json`
- Windows'ta `BASLAT.bat` ile de başlatılabilir.

## Otomatik yükleme
Her gönderimde GitHub Actions derleyip FTP ile sunucuya yükler (test/canlı). Kurulum: `KURULUM.md` → "Otomatik Yükleme".

## Sunucu kurulumu
Ayrıntılar için `KURULUM.md`. Sunucuda `config.example.php` dosyasını
`config.php` olarak kopyalayıp doldurun. `config.php`, `database.json`,
`backups/`, `uploads/` ve `dev/data/` asla depoya gönderilmez.

## Demo
`pnpm run build:demo` → `dist-demo/`. Bu derleme sunucu gerektirmez: `src/data/demoSunucu.js`
api.php'yi tarayıcı içinde taklit eder ve kurgusal örnek verilerle (`src/data/demoVeri.js`)
çalışır. Demo kodu normal derlemeye girmez.

## Üçüncü taraf veri ve servisler
- Harita: [Leaflet](https://leafletjs.com) (BSD-2).
- `src/data/istanbulIlceler.json`: İstanbul ilçe sınırları, [geoBoundaries](https://www.geoboundaries.org)
  (TUR ADM2) verisinden `scripts/ilce-haritasi-uret.py` ile sadeleştirildi.
  © OpenStreetMap katkıcıları, [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/).
- Sokak haritası ve adres arama: OpenStreetMap karoları ve Nominatim (kullanım koşulları:
  https://operations.osmfoundation.org/policies/).
