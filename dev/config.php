<?php
// HİS ERP - GELİŞTİRME ortamı yapılandırması (gerçek veri/şifre İÇERMEZ)
// `pnpm run dev` bu dosyayla PHP'nin dahili sunucusunu SQLite üzerinde çalıştırır.
$DATA_DIR = __DIR__ . '/data';
if (!is_dir($DATA_DIR)) @mkdir($DATA_DIR, 0755, true);
$DB_DSN = 'sqlite:' . $DATA_DIR . '/dev.sqlite';

$ANTHROPIC_API_KEY = getenv('ANTHROPIC_API_KEY') ?: '';

$VAPID_SUBJECT = 'mailto:dev@example.com';
$VAPID_PUBLIC  = '';
$VAPID_PRIVATE_PEM = '';
