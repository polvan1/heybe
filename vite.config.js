import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    return {
    // Göreli yollar: uygulama sunucuda /dist/ gibi bir alt klasörde de çalışabilsin
    // (api.php adresi de BASE_URL üzerinden göreli çözülür)
    base: './',
    plugins: [
        react(),
        {
            // public/sw.js Vite tarafından işlenmez; içindeki anahtar yer tutucusunu
            // derleme çıktısında .env'deki VITE_API_KEY ile değiştir.
            name: 'sw-api-key',
            apply: 'build',
            writeBundle(options) {
                const swPath = path.resolve(options.dir || 'dist', 'sw.js');
                if (!fs.existsSync(swPath)) return;
                const icerik = fs.readFileSync(swPath, 'utf8');
                fs.writeFileSync(swPath, icerik.replace('__VITE_API_KEY__', env.VITE_API_KEY || ''), 'utf8');
            },
        },
        {
            // Geliştirme ortamı API'si: database.json dosyasını sunar/günceller.
            // Üretimde bu görevi public/api.php (MySQL) üstlenir.
            name: 'local-db-plugin',
            configureServer(server) {
                const uploadsDir = path.resolve(__dirname, 'uploads');

                server.middlewares.use((req, res, next) => {
                    // Dev'de yüklenen fotoğrafları sun
                    const cleanUrl = req.url.split('?')[0];
                    if (cleanUrl.startsWith('/uploads/')) {
                        const dosya = path.join(uploadsDir, path.basename(cleanUrl));
                        if (fs.existsSync(dosya)) {
                            res.setHeader('Content-Type', 'image/jpeg');
                            res.end(fs.readFileSync(dosya));
                        } else {
                            res.statusCode = 404;
                            res.end();
                        }
                        return;
                    }

                    if (!cleanUrl.endsWith('/api.php')) return next();

                    // AI irsaliye okuma dev'de SAHTE sonuç döner (gerçek okuma sunucuda,
                    // config.php'deki Anthropic anahtarıyla çalışır) — UI akışını test etmek için
                    if (req.url.includes('irsaliye_oku')) {
                        let b = '';
                        req.on('data', c => { b += c; });
                        req.on('end', () => {
                            res.setHeader('Content-Type', 'application/json');
                            let turler = [];
                            try { turler = JSON.parse(b).kumas_turleri || []; } catch (e) { /* yoksay */ }
                            res.end(JSON.stringify({
                                success: true,
                                okuma: {
                                    firma: 'Test Kumaşçılık (dev sahte okuma)',
                                    irsaliyeNo: 'TEST-001',
                                    satirlar: [
                                        { kumasTuru: turler[0] || 'Süprem 30/1', renk: 'Siyah', topAdedi: 5, miktar: 128.5, birim: 'kg' },
                                        { kumasTuru: turler[1] || turler[0] || 'Ribana', renk: 'Beyaz', topAdedi: 3, miktar: 76, birim: 'kg' },
                                    ],
                                },
                            }));
                        });
                        return;
                    }

                    // Push endpoint'leri dev'de sahte yanıt döner (gerçek push sadece sunucuda çalışır)
                    if (req.url.includes('push=')) {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(req.url.includes('push=son') ? '{"bildirim":null}' : '{"success":true}');
                        return;
                    }

                    // Foto yükleme/silme (dev: ./uploads klasörü)
                    if (req.url.includes('foto=')) {
                        let body = '';
                        req.on('data', c => { body += c.toString(); });
                        req.on('end', () => {
                            res.setHeader('Content-Type', 'application/json');
                            try {
                                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
                                const parsed = JSON.parse(body || '{}');
                                if (req.url.includes('foto=upload')) {
                                    const m = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(parsed.data || '');
                                    if (!m) { res.statusCode = 400; res.end('{"error":"Gecersiz gorsel"}'); return; }
                                    const ad = Date.now().toString(16) + Math.random().toString(16).slice(2, 8) + '.jpg';
                                    fs.writeFileSync(path.join(uploadsDir, ad), Buffer.from(m[2], 'base64'));
                                    res.end(JSON.stringify({ url: 'uploads/' + ad }));
                                } else {
                                    const dm = /^uploads\/([a-f0-9]+\.jpg)$/.exec(parsed.url || '');
                                    if (dm && fs.existsSync(path.join(uploadsDir, dm[1]))) fs.unlinkSync(path.join(uploadsDir, dm[1]));
                                    res.end('{"success":true}');
                                }
                            } catch (e) {
                                res.statusCode = 500;
                                res.end('{"error":"' + e.message + '"}');
                            }
                        });
                        return;
                    }

                    const dbPath = path.resolve(__dirname, 'database.json');
                    const backupDir = path.resolve(__dirname, 'backups');

                    if (req.method === 'GET') {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(fs.existsSync(dbPath) ? fs.readFileSync(dbPath, 'utf8') : '{}');
                        return;
                    }

                    if (req.method === 'POST') {
                        let body = '';
                        req.on('data', chunk => { body += chunk.toString(); });
                        req.on('end', () => {
                            res.setHeader('Content-Type', 'application/json');

                            // 1) JSON doğrulama: bozuk gövde veritabanını bozamasın
                            let incoming;
                            try {
                                incoming = JSON.parse(body || '{}');
                                if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('obje değil');
                            } catch (e) {
                                res.statusCode = 400;
                                res.end(JSON.stringify({ success: false, error: 'Geçersiz JSON' }));
                                return;
                            }

                            // 2) Mevcut veriyle BİRLEŞTİR (istemci artık sadece değişen koleksiyonları gönderiyor)
                            let current = {};
                            try {
                                if (fs.existsSync(dbPath)) current = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                            } catch (e) { current = {}; }
                            const merged = { ...current, ...incoming };

                            // 3) Günlük yedek (son 14 gün saklanır)
                            try {
                                if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
                                const today = new Date().toISOString().split('T')[0];
                                const backupFile = path.join(backupDir, `database-${today}.json`);
                                if (!fs.existsSync(backupFile) && fs.existsSync(dbPath)) {
                                    fs.copyFileSync(dbPath, backupFile);
                                }
                                const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('database-')).sort();
                                while (backups.length > 14) fs.unlinkSync(path.join(backupDir, backups.shift()));
                            } catch (e) { /* yedekleme hatası kaydı engellemesin */ }

                            fs.writeFileSync(dbPath, JSON.stringify(merged), 'utf8');
                            res.end(JSON.stringify({ success: true }));
                        });
                        return;
                    }

                    next();
                });
            }
        }
    ],
    server: {
        host: true, // Listen on all network interfaces
        port: 5173,
    }
    };
})
