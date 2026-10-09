<?php
// GitHub Actions'ta çalışır: ortam değişkenlerinden (GitHub Secrets) config.php üretir.
// Kullanım: php scripts/config-uret.php dist/config.php
// Değerler var_export ile yazılır; şifredeki tırnak vb. karakterler PHP kodunu bozamaz.
if ($argc < 2) { fwrite(STDERR, "Hedef dosya yolu gerekli\n"); exit(1); }

$deger = fn($ad, $varsayilan = '') => (string)(getenv($ad) !== false && getenv($ad) !== '' ? getenv($ad) : $varsayilan);
$ayarlar = [
    'DB_HOST' => $deger('DB_SUNUCU', 'localhost'),
    'DB_NAME' => $deger('DB_ADI'),
    'DB_USER' => $deger('DB_KULLANICI'),
    'DB_PASS' => $deger('DB_SIFRE'),
    'ANTHROPIC_API_KEY' => $deger('ANTHROPIC_API_KEY'),
];
foreach (['DB_NAME', 'DB_USER', 'DB_PASS'] as $zorunlu) {
    if ($ayarlar[$zorunlu] === '') { fwrite(STDERR, "$zorunlu boş\n"); exit(1); }
}

$icerik = "<?php\n"
    . "// HİS ERP - Sunucu yapılandırması\n"
    . "// Bu dosya GitHub Actions tarafından GitHub Secrets'tan OTOMATİK üretilir.\n"
    . "// Elle değiştirmeyin; değişiklik için GitHub'daki secret'ları güncelleyin.\n"
    . "// Bildirim (VAPID) anahtarları sunucuda ilk kullanımda otomatik üretilir (gizli/ klasörü).\n\n";
foreach ($ayarlar as $ad => $v) $icerik .= '$' . $ad . ' = ' . var_export($v, true) . ";\n";
$icerik .= "\$VAPID_SUBJECT = '';\n\$VAPID_PUBLIC = '';\n\$VAPID_PRIVATE_PEM = '';\n";

if (file_put_contents($argv[1], $icerik) === false) { fwrite(STDERR, "Yazılamadı\n"); exit(1); }
echo "config.php üretildi\n";
