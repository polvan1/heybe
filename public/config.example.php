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

// ---- Yapay zekâ ile irsaliye fotoğrafı okuma (Kumaş Stok, Kesim Sevk İrsaliyesi) ----
// Anahtarı girilen sağlayıcılar sırayla denenir; hiçbiri yoksa özellik kapalıdır.
// Ücretsiz seçenek: Google AI Studio'dan alınan Gemini anahtarı (https://aistudio.google.com/apikey)
$GEMINI_API_KEY = '';
$GEMINI_MODEL = '';          // boşsa 'gemini-flash-latest' (Google'ın güncel Flash modeli)
$GROQ_API_KEY = '';          // ücretsiz katmanı olan alternatif (https://console.groq.com/keys)
$OPENROUTER_API_KEY = '';    // ":free" modeller (https://openrouter.ai/keys)
$ANTHROPIC_API_KEY = '';     // ücretli (Claude)
$AI_SAGLAYICI = '';          // ilk denenecek: 'gemini' | 'groq' | 'openrouter' | 'anthropic' (boşsa bu sırayla)

// ---- WEB PUSH (VAPID) — telefon bildirimleri ----
// Public key uygulamaya sunucudan verilir; ayrıca bir yere yazmanız gerekmez.
$VAPID_SUBJECT = 'mailto:';
$VAPID_PUBLIC  = '';
$VAPID_PRIVATE_PEM = <<<PEM
PEM;
