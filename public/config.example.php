<?php
// HİS ERP - Sunucu Yapılandırması (ŞABLON)
// Bu dosyayı sunucuda config.php adıyla kopyalayıp değerleri doldurun.
// config.php GitHub'a GÖNDERİLMEZ (.gitignore).

$DB_HOST = 'localhost';
$DB_NAME = '';
$DB_USER = '';
$DB_PASS = '';

// API anahtarı: uygulamanın .env dosyasındaki VITE_API_KEY ile AYNI olmalı.
$API_KEY = '';

// Yapay zekâ irsaliye okuma (Kumaş Stok) için Anthropic API anahtarı. Boşsa özellik kapalı.
$ANTHROPIC_API_KEY = '';

// ---- WEB PUSH (VAPID) ----
// Public key, .env dosyasındaki VITE_VAPID_PUBLIC_KEY ile AYNI olmalı.
$VAPID_SUBJECT = 'mailto:';
$VAPID_PUBLIC  = '';
$VAPID_PRIVATE_PEM = <<<PEM
PEM;
?>
