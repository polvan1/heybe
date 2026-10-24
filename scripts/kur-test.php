<?php
// GitHub Actions'ta çalışır: TCMB günlük kur dosyasının indirilip doğru çözüldüğünü kontrol eder.
// Kullanım: php scripts/kur-test.php   (TCMB_KUR_URL ile başka adres denenebilir)
require __DIR__ . '/../public/inc/kur.php';
$sonuc = tcmbKurIndir();
if (!$sonuc) { fwrite(STDERR, "TCMB kurları alınamadı\n"); exit(1); }
printf("TCMB %s: %s\n", $sonuc['tarih'], implode(', ', array_map(fn($k, $v) => "$k=$v", array_keys($sonuc['kurlar']), $sonuc['kurlar'])));
foreach (KUR_KODLARI as $kod) {
    if (empty($sonuc['kurlar'][$kod]) || $sonuc['kurlar'][$kod] <= 1) { fwrite(STDERR, "$kod kuru geçersiz\n"); exit(1); }
}
echo "Kur testi başarılı\n";
