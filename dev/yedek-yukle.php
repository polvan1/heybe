<?php
// Geliştirme ortamı: bir JSON yedeğini (Ayarlar → Yedek İndir ya da sunucu backups/)
// dev veritabanına yükler. Kullanıcılar yüklenmez (giriş ekranından ilk kurulum yapın).
// Kullanım: php dev/yedek-yukle.php yedek.json
if ($argc < 2) { fwrite(STDERR, "Kullanım: php dev/yedek-yukle.php yedek.json\n"); exit(1); }
require __DIR__ . '/config.php';
require __DIR__ . '/../public/inc/db.php';
require __DIR__ . '/../public/inc/auth.php';
require __DIR__ . '/../public/inc/sync.php';
function jsonHata($k, $h, $m) { fwrite(STDERR, "$h: $m\n"); exit(1); }
function veriDizini() { global $DATA_DIR; return $DATA_DIR; }

$yedek = json_decode(file_get_contents($argv[1]), true);
if (!is_array($yedek)) jsonHata(1, 'json', 'Yedek okunamadı');
$pdo = dbBaglan();
semaGuncelle($pdo);
$degisiklikler = [];
foreach (TABLO_HARITASI as $anahtar => $tablo) {
    if ($anahtar === 'myhis_kullanicilar' || !isset($yedek[$anahtar]) || !is_array($yedek[$anahtar])) continue;
    $degisiklikler[$anahtar] = ['upsert' => $yedek[$anahtar]];
    echo str_pad($anahtar, 24) . count($yedek[$anahtar]) . " kayıt\n";
}
veriYaz($pdo, ['rol' => 'admin', 'yetkiler' => []], ['degisiklikler' => $degisiklikler]);
echo "Tamam.\n";
