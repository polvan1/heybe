# HİS ERP — Fason Tekstil Üretim Takip

Mobil uyumlu (PWA) web tabanlı fason tekstil üretim takip sistemi:
partiler (kesim → dikim → ütü/paket), firmalar, ürünler, irsaliyeler,
cari hesaplar, kumaş stok, raporlar, kullanıcı/yetki yönetimi.

## Teknoloji
- Ön yüz: React 18 + Vite 6 + React Router
- Sunucu: `public/api.php` (PHP + MySQL, cPanel)
- Geliştirme ortamında veri `database.json` dosyasında tutulur (vite.config.js içindeki yerel API)

## Geliştirme
```bash
cp .env.example .env        # anahtarları doldurun
pnpm install
pnpm run dev                # http://localhost:5173
pnpm run build              # dist/ klasörüne derler
```
Windows'ta `BASLAT.bat` ile de başlatılabilir.

## Sunucu kurulumu
Ayrıntılar için `KURULUM.md`. Sunucuda `public/config.example.php` dosyasını
`config.php` olarak kopyalayıp doldurun. `config.php`, `.env`, `database.json`
ve `backups/` asla depoya gönderilmez.
