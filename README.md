# HİS ERP — Fason Tekstil Üretim Takip

Mobil uyumlu (PWA) web tabanlı fason tekstil üretim takip sistemi:
partiler (kesim → dikim → ütü/paket), firmalar, ürünler, irsaliyeler,
cari hesaplar, kumaş stok, raporlar, kullanıcı/yetki yönetimi.

## Teknoloji
- Ön yüz: React 18 + Vite 6 + React Router (`src/`)
- Sunucu: PHP 8 (`public/api.php` + `public/inc/`), üretimde MySQL (cPanel)
- Giriş/oturum sunucu tarafında (PHP session, HttpOnly çerez); kodda anahtar yok

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

## Sunucu kurulumu
Ayrıntılar için `KURULUM.md`. Sunucuda `config.example.php` dosyasını
`config.php` olarak kopyalayıp doldurun. `config.php`, `database.json`,
`backups/`, `uploads/` ve `dev/data/` asla depoya gönderilmez.

## Demo
`pnpm run build:demo` → `dist-demo/`. Bu derleme sunucu gerektirmez: `src/data/demoSunucu.js`
api.php'yi tarayıcı içinde taklit eder ve kurgusal örnek verilerle (`src/data/demoVeri.js`)
çalışır. Demo kodu normal derlemeye girmez.
