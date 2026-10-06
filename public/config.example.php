<?php
// HİS ERP - Sunucu Yapılandırması (ŞABLON)
// Bu dosyayı sunucuda config.php adıyla kopyalayıp değerleri doldurun.
// config.php GitHub'a GÖNDERİLMEZ (.gitignore) ve web'den indirilemez (.htaccess).

// ---- MySQL ----
$DB_HOST = 'localhost';
$DB_NAME = '';
$DB_USER = '';
$DB_PASS = '';

// Yedeklerin (backups/) ve fotoğrafların (uploads/) klasörü.
// Boş bırakılırsa api.php'nin bulunduğu klasör kullanılır.
$DATA_DIR = '';

// Yapay zekâ irsaliye okuma (Kumaş Stok) için Anthropic API anahtarı. Boşsa özellik kapalı.
$ANTHROPIC_API_KEY = '';

// ---- WEB PUSH (VAPID) — telefon bildirimleri ----
// Public key uygulamaya sunucudan verilir; ayrıca bir yere yazmanız gerekmez.
$VAPID_SUBJECT = 'mailto:';
$VAPID_PUBLIC  = '';
$VAPID_PRIVATE_PEM = <<<PEM
PEM;
