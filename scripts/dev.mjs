// Geliştirme ortamı: PHP API sunucusunu (SQLite) ve Vite'ı birlikte başlatır.
// Gereksinim: PHP 8+ (pdo_sqlite eklentisiyle) PATH'te olmalı.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHP_PORT = process.env.PHP_PORT || '8787';
const ekArgs = process.argv.slice(2);

const php = spawn('php', ['-S', `127.0.0.1:${PHP_PORT}`, '-t', 'public', 'dev/router.php'], {
    cwd: kok,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, HISERP_CONFIG: path.join(kok, 'dev', 'config.php') },
});
php.on('error', (e) => {
    console.error('\nPHP başlatılamadı. PHP 8+ kurulu ve PATH içinde olmalı:', e.message);
    process.exit(1);
});

const vite = spawn(process.execPath, [path.join(kok, 'node_modules', 'vite', 'bin', 'vite.js'), ...ekArgs], {
    cwd: kok,
    stdio: 'inherit',
    env: { ...process.env, PHP_PORT },
});

const kapat = () => { php.kill(); vite.kill(); };
process.on('SIGINT', kapat);
process.on('SIGTERM', kapat);
vite.on('exit', (kod) => { php.kill(); process.exit(kod ?? 0); });
php.on('exit', (kod) => { if (kod) { console.error('PHP sunucusu kapandı.'); vite.kill(); } });
