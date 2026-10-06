<?php
// PHP dahili sunucusu için yönlendirici (sadece geliştirme ortamı).
// /uploads/... isteklerini dev/data/uploads klasöründen sunar.
$yol = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (strpos($yol, '/uploads/') === 0) {
    $dosya = __DIR__ . '/data/uploads/' . basename($yol);
    if (is_file($dosya)) {
        header('Content-Type: image/jpeg');
        readfile($dosya);
        return true;
    }
    http_response_code(404);
    return true;
}
return false; // diğer her şey: public/ klasöründen normal sunulur
