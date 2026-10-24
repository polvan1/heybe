import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Geliştirme ortamında api.php ve /uploads istekleri, `pnpm run dev` ile
// birlikte başlayan PHP sunucusuna (SQLite) yönlendirilir. Üretimde aynı
// api.php sunucuda MySQL ile çalışır — tek bir sunucu kodu vardır.
const PHP_HEDEF = `http://127.0.0.1:${process.env.PHP_PORT || '8787'}`

// Service worker'ın çevrimdışı kullanım için önceden indireceği dosyaların listesi
// (dist/asset-listesi.json): hiç açılmamış sayfalar da internetsiz açılabilsin.
const assetListesi = () => ({
    name: 'asset-listesi',
    generateBundle(_, bundle) {
        const dosyalar = Object.keys(bundle).filter(f => f.startsWith('assets/') && !f.endsWith('.map'))
        this.emitFile({ type: 'asset', fileName: 'asset-listesi.json', source: JSON.stringify(dosyalar) })
    },
})

export default defineConfig({
    // Göreli yollar: uygulama sunucuda /dist/ gibi bir alt klasörde de çalışabilsin
    // (api.php adresi de BASE_URL üzerinden göreli çözülür)
    base: './',
    plugins: [react(), assetListesi()],
    server: {
        host: true, // Listen on all network interfaces
        port: 5173,
        proxy: {
            '/api.php': PHP_HEDEF,
            '/uploads': PHP_HEDEF,
        },
    },
})
