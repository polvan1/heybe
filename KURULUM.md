# HİS ERP v2.1 — Sunucu Kurulum Talimatları

Bu paket, uygulamanın derlenen son sürümünü içerir. Mevcut verileriniz **korunur** —
sadece iki yeni tablo eklenir.

## Paket İçeriği

| Dosya | Açıklama |
|---|---|
| `index.html`, `assets/`, `*.svg`, `manifest.json`, `sw.js` | Derlenmiş uygulama |
| `api.php` | Sunucu API'si (MySQL) — güncellendi |
| `config.php` | Veritabanı bilgileri + API anahtarı (**şifreyi değiştirin!**) |
| `.htaccess` | Yönlendirme kuralları (`/dist/` klasörüne göre ayarlı) |
| `veritabani_guncelleme.sql` | Yeni tablolar (irsaliyeler, kullanicilar, settings) |
| `KURULUM.md` | Bu dosya |

## Otomatik Yükleme (GitHub → panel.myhis.com.tr)

Kodda yapılan her değişiklik GitHub üzerinden sunucuya otomatik yüklenir
(`.github/workflows/deploy.yml`). İki ortam vardır:

| Ne zaman | Nereye |
|---|---|
| `claude/...` dalına her gönderim | **Test** klasörü (ör. `panel.myhis.com.tr/test/`) |
| `main` dalına birleştirme | **Canlı** klasör (ör. `panel.myhis.com.tr/dist/`) |
| Actions → "Sunucuya yükle" → **Run workflow** | Seçtiğiniz hedef |

### Bir kerelik kurulum (aaPanel)
1. **aaPanel → FTP**: FTP kullanıcısının "Belge Kök Dizini"ne bakın (ör. `/www/wwwroot/www.myhis.com.tr`).
   Aşağıdaki klasör yolları bu köke göre yazılır. Güçlü bir şifre verin.
2. **aaPanel → Güvenlik**: 21 ve 39000-40000 (pasif FTP) portları açık olmalı. Sunucu bir bulut
   sağlayıcısındaysa (ör. Oracle Cloud) aynı portları sağlayıcının güvenlik listesinde de açın.
3. **Veritabanı**: aaPanel → Veritabanları → **Veritabanı ekle** (ör. test için `his_test`, canlı için
   `his_erp`). Kullanıcı adı ve şifreyi not edin. `config.php` dosyasını elle oluşturmanız gerekmez:
   GitHub bu bilgilerden her yüklemede otomatik üretir.
   - ⚠️ Test ve canlı için **ayrı** veritabanı kullanın: yeni sürümde giriş yapan kullanıcının
     şifresi yeni biçime yükseltilir ve o kişi eski sürüme giriş yapamaz.
4. **GitHub → depo → Settings → Secrets and variables → Actions → New repository secret**:
   - `FTP_SUNUCU` = sunucu IP adresi ya da FTP alan adı
   - `FTP_KULLANICI` = FTP kullanıcı adı
   - `FTP_SIFRE` = FTP şifresi
   - `FTP_TEST_DIZIN` = `/test/`  (FTP kök dizinine göre)
   - `FTP_CANLI_DIZIN` = `/dist/`
   - `TEST_DB_ADI`, `TEST_DB_KULLANICI`, `TEST_DB_SIFRE` = test veritabanı bilgileri
   - `CANLI_DB_ADI`, `CANLI_DB_KULLANICI`, `CANLI_DB_SIFRE` = canlı veritabanı bilgileri
   - (isteğe bağlı) `DB_SUNUCU` (varsayılan `localhost`), `ANTHROPIC_API_KEY` (irsaliye okuma)
   - ⚠️ `config.php` bir kez bu yolla yüklendikten sonra bu `*_DB_*` secret'larını silmeyin;
     silinirse sonraki yüklemede sunucudaki `config.php` de kaldırılır.
   - Bağlantı "TLS/SSL" hatası verirse **Variables** sekmesinde `FTP_PROTOKOL` = `ftp` ekleyin
     (aaPanel'in Pure-FTPd sunucusunda FTPS çoğu zaman kapalıdır).
5. İlk yükleme: depoya bir sonraki gönderimde kendiliğinden başlar. Actions sekmesindeki
   **Run workflow** düğmesi, iş akışı `main` dalına birleştirildikten sonra görünür.

Şifreler GitHub'da şifreli saklanır; kodda, kayıtlarda ve depoda görünmez. Sunucudaki
`backups/`, `uploads/` ve `gizli/` (bildirim anahtarları) hiçbir yüklemede silinmez veya değiştirilmez.
Telefon bildirimi anahtarları (VAPID) ilk kullanımda sunucuda otomatik üretilir.

## v3.2 — Çoklu Araç ve Şoför Ekranı

- **Araçlar:** Harita ve Rota → Rota Planı → "Araç ekle" (ad, plaka, şoför).
- **Şoför hesabı:** Kullanıcılar sayfasında rolü **Şoför** olan kullanıcı ekleyin (yetkisi
  otomatik "Görevlerim" olur). Şoför sadece kendi seferlerini, o seferlerdeki irsaliyeleri ve
  firmaların adres/telefon/konumunu görür; fiyat, cari, parti gibi verilere erişemez.
- **Planlama:** Seçili araçlar arasında sevkiyatlar, en geç biten araç mümkün olduğunca erken
  bitecek şekilde dağıtılır; her aracın sırası ayrıca optimize edilir.
- **Şoförlere gönder:** Her araç için bir sefer oluşur, şoförün telefonuna bildirim düşer.
  Şoför "Görevlerim" ekranında sıradaki durağı, yol tarifini, firma telefonunu görür ve
  "Bu durak tamamlandı" der → irsaliye otomatik "teslim edildi" olur, sevk sorumlusuna bildirim gider.
- **Canlı takip:** Şoför "Konumumu paylaş" derse konumu yarım dakikada bir gönderilir (ekran
  açıkken); sevk ekranında araç haritada görünür. Sevk ekranı 20 sn'de bir, şoför ekranı 15 sn'de
  bir kendini yeniler. Bildirimler için şoför telefonunda "Yeni sefer gelince telefonuma bildir"
  düğmesine bir kez basmalı (HTTPS ve VAPID anahtarları gerekir).
- Veritabanına `araclar`, `seferler` tabloları ve `bildirimler.kullaniciId` kolonu otomatik eklenir.

## v3.1 — Harita ve Sevkiyat Rota Planı

- Yeni menü: **İLİŞKİLER → Harita ve Rota**. Yönetici otomatik görür; diğer kullanıcılara
  **Kullanıcılar** sayfasından **"Harita ve Rota"** yetkisini verin.
- **Üretim Yerleri:** firmaların konumunu haritaya dokunarak ya da adres yazarak girin.
  Konumu değiştirmek için ayrıca **Firmalar** yetkisi gerekir. Önce **Araç çıkış noktası**nı seçin.
- **Rota Planı:** teslim edilmemiş (taslak/onaylı) irsaliyeler listelenir; seçtikleriniz için
  araç her alımı teslimattan önce yapacak şekilde en kısa sırayla planlanır. Rota Google
  Haritalar'da açılabilir veya WhatsApp ile şoföre gönderilebilir.
- Mesafeler kuş uçuşu × 1,3 ile tahmindir (yol ağı servisi kullanılmaz, ücret yok).
- Sokak haritası ve adres arama OpenStreetMap servislerini kullanır (internet gerekir, ücretsiz,
  düşük kullanım içindir). Sade harita ve ilçe adıyla arama internetsiz çalışır.
- Veritabanına `firmalar.lat`, `firmalar.lng`, `firmalar.konumAdres` kolonları otomatik eklenir.
- Ayrıca düzeltildi: Ürün kartındaki kesim/dikim/ütü fiyatları artık kaydediliyor (önceden
  veritabanında kolonu olmadığı için sessizce kayboluyordu); koyu temada açılır listelerde
  tekrarlanan ok görüntüsü.

## v3.0 — Güvenlik Güncellemesi (ÖNEMLİ: kurulumdan önce okuyun)

Bu sürümle giriş ve yetki kontrolü **sunucuya** taşındı.

**Sunucuya yükleme**
1. `pnpm run build` ile derleyin; `dist/` içeriğini sunucudaki klasöre yükleyin.
   `dist/` içinde artık bir de **`inc/`** klasörü var (sunucu kodu) — mutlaka yükleyin.
2. Sunucudaki mevcut `config.php` dosyanız **aynen çalışır**. `$API_KEY` satırı artık
   kullanılmıyor, silebilirsiniz. Yeni kurulumda `config.example.php` → `config.php`.
3. Veritabanı tabloları/kolonları `api.php` tarafından **otomatik** oluşturulur/eklenir;
   SQL çalıştırmanız gerekmez. Mevcut verilere dokunulmaz.

**Kullanıcılar için değişenler**
- Güncellemeden sonra herkes **bir kez yeniden giriş yapar** (eski oturumlar geçersiz).
- Mevcut şifreler çalışmaya devam eder; ilk girişte otomatik olarak güçlü
  biçimde (bcrypt) yeniden saklanır.
- Yeni şifreler en az **6 karakter** olmalı.
- 10 hatalı girişten sonra o cihazdan 15 dakika giriş engellenir.

**Neler düzeldi**
- Giriş/oturum sunucuda (HttpOnly çerez). Kodda hiçbir anahtar veya şifre yok;
  eski "API anahtarı" ile veritabanının tamamını indirme açığı kapandı.
- Şifre hash'leri hiçbir kullanıcıya gönderilmez. Kullanıcı yönetimi yetkisi
  olmayanlar diğer kullanıcıların e-posta/telefonunu göremez.
- Yetkiler sunucuda uygulanır: örn. firmalar yetkisi olmayan biri firma
  değiştiremez/silemez; "İzleyici" rolü hiçbir veriyi değiştiremez.
- Kayıt artık **kayıt bazlı**: sadece değişen/silinen kayıtlar gönderilir. İki kişi
  aynı anda çalışırken biri diğerinin eklediği kaydı artık silemez.
- Bildirimler ve işlem günlüğü en yeniden eskiye sıralı gelir (eskiden budama
  sırasında en yeni kayıtlar silinebiliyordu).

## Kurulum Adımları (v2.x — eski sürüm notları)

### 1. Veritabanını güncelleyin
- cPanel → **phpMyAdmin** → `myhiscom_fason_takip` veritabanını seçin
- **SQL** sekmesine `veritabani_guncelleme.sql` içeriğini yapıştırıp çalıştırın
- `IF NOT EXISTS` kullanıldığı için mevcut tablolara/verilere dokunmaz

### 2. MySQL şifresini değiştirin (ÖNEMLİ)
Eski şifre daha önce dist.zip içinde paylaşıldığı için açığa çıktı sayılır.
- cPanel → **MySQL Databases** → kullanıcı şifresini değiştirin
- Yeni şifreyi `config.php` içindeki `$DB_PASS` satırına yazın

### 3. Dosyaları yükleyin
- Sunucudaki `dist/` klasörünün **eski içeriğini silin** (assets, index.html, api.php...)
  - Varsa `backups/` klasörünü SİLMEYİN
- Bu paketteki tüm dosyaları `dist/` klasörüne yükleyin
- `veritabani_guncelleme.sql` ve `KURULUM.md` dosyalarını sunucuya yüklemenize gerek yok

> Farklı bir klasöre kuruyorsanız `.htaccess` içindeki `/dist/` yollarını değiştirin.

### 4. İlk giriş
- Uygulamayı açın → **"İlk kurulum"** ekranı gelir → yönetici hesabınızı oluşturun
- Sonraki girişlerde ad/e-posta + şifre istenir
- Diğer kullanıcıları **Kullanıcılar** sayfasından ekleyin (rol + sayfa yetkileri)

## Bu Sürümdeki Yenilikler

**Düzeltilen kritik hatalar**
- İrsaliyeler ve kullanıcılar artık MySQL'e kaydediliyor (önceden sayfa yenilenince kayboluyordu)
- Uygulama artık sadece değişen veri gruplarını gönderiyor — iki cihaz aynı anda
  açıkken birbirinin farklı verilerini ezme riski büyük ölçüde azaldı
- Parti ve irsaliye numaraları silme sonrası tekrar etmiyor
- Ayarlar'daki bozuk "CSV Dışa Aktar" yerine çalışan **JSON Yedek İndir / Geri Yükle** geldi
- Çift veri yükleme (çift seed) riski giderildi

**Güvenlik**
- Giriş ekranı + rol bazlı sayfa yetkilendirme (menüler de yetkiye göre gizlenir)
- Şifreler artık SHA-256 hash ile saklanıyor (eski düz metin şifreler ilk girişte otomatik hash'lenir)
- api.php artık API anahtarı istiyor — anahtarsız istekler 401 alır
- config.php'ye doğrudan HTTP erişimi .htaccess ile kapalı
- Silinen firma/parti bağlı kayıt kontrolü (veri bütünlüğü)

**Yedekleme**
- Sunucu her günün ilk kaydında otomatik JSON yedek alır → `dist/backups/` (son 14 gün, dışarıdan erişime kapalı)
- Ayarlar sayfasından manuel tam yedek indirilebilir / geri yüklenebilir

**Performans / PWA**
- Sayfalar artık parça parça yükleniyor (code splitting) — ilk açılış daha hızlı
- Service worker eklendi — statik dosyalar önbellekten gelir, tekrar açılışlar hızlanır

## Telefon Bildirimleri (v2.2)

Uygulama artık gerçek push bildirimi gönderir: parti tamamlanma, yüksek fire,
irsaliye teslimi gibi olaylar **uygulama kapalıyken bile** telefona düşer.

**Etkinleştirme (her cihazda bir kez):**
1. Siteniz **HTTPS** üzerinden sunulmalı (push bunu zorunlu kılar)
2. **iPhone:** Safari → Paylaş → **"Ana Ekrana Ekle"** → uygulamayı ana ekrandaki
   simgeden açın (iOS 16.4+ gerekir). Android/PC'de bu adım gerekmez.
3. Uygulamada **Ayarlar → Telefon Bildirimleri → "Bu Cihazda Bildirimleri Aç"**
4. İzin sorusuna "İzin Ver" deyin → **"Test Gönder"** ile deneyin

**Nasıl çalışır:** Herhangi bir cihazda yeni bildirim oluşunca (örn. parti
tamamlandı) sunucu, kayıtlı tüm cihazlara push sinyali yollar; service worker
en son bildirimi çekip cihazda gösterir. Abonelikler `push_subscriptions`
tablosunda tutulur; ölü abonelikler otomatik temizlenir.

## v2.3 Yenilikleri

- **WhatsApp paylaşımı:** İrsaliye detayında "WhatsApp" butonu — irsaliye özeti
  (parti, adet, renk dökümü) alıcı firmanın telefonuna hazır mesaj olarak açılır.
- **Fasoncu ekranı (İşlerim):** Kullanıcılar sayfasında fasoncu hesabına firma
  bağlayın; fasoncu girişte yalnızca kendi işlerini görür, "Teslim Bildir" ile
  çıkış adedini girer → yöneticiye bildirim + push düşer, yönetici onaylar.
- **QR kod:** Yazdırılan irsaliyelerde QR — telefonla okutunca uygulamada
  ilgili parti açılır.
- **İşlem Günlüğü:** YÖNETİM menüsünde — kim, ne zaman, ne yaptı (parti silme,
  hesap kapatma, kullanıcı ekleme...). Son 1000 kayıt tutulur.
- **Fotoğraflar:** Ürüne numune fotoğrafı, partiye çoklu fotoğraf (kalite
  kontrol, sevkiyat). Fotoğraflar sunucuda `dist/uploads/` klasöründe saklanır —
  **bu klasörü silmeyin**; yedeklerinize dahil etmek için arada indirin.
- Veritabanı değişiklikleri (islem_gunlugu tablosu + 3 yeni kolon) **api.php
  tarafından otomatik yapılır** — SQL çalıştırmanız gerekmez.

## v2.4 Yenilikleri

- **Firma bazlı fiyat anlaşmaları:** Ürün kartında "Firma Bazlı Fiyat Anlaşmaları"
  bölümü — aynı ürün için firmaya özel kesim/dikim/ütü fiyatı girin. Parti
  açarken o firma seçilince anlaşma fiyatı otomatik kullanılır (formda
  "— firma anlaşması" ibaresiyle görünür); anlaşması olmayanlar varsayılanı alır.
- **Parti Arşivi:** Partiler sayfasına "Arşiv" sekmesi. Cari Detay'da
  **"Hesabı Kapat"** yapıldığında, borçları hesaplanan tamamlanmış partiler
  OTOMATİK arşive düşer ve diğer sekmelerden kalkar. Tamamlanmış partileri
  elle de arşivleyebilirsiniz (arşiv ikonlu buton); elle arşivlenenler geri
  çıkarılabilir. Raporlar/istatistikler arşivdekileri saymaya devam eder.
- Veritabanı değişiklikleri (2 yeni kolon) yine api.php tarafından otomatik yapılır.

## v2.5 Yenilikleri

- **iPhone üst kısım düzeltmesi:** Header artık çentik/Dynamic Island'ın altından
  başlıyor — üstteki menü/zil/çıkış ikonlarına dokunulabiliyor.
- **Dikim → Ütü otomatik irsaliyesi:** Parti dikimden ütü/pakete ilerletildiğinde
  (ütü/paketçi atanmışsa) dikimhane → ütücü irsaliyesi otomatik oluşur; dikimden
  çıkan adetle düzenlenir ve WhatsApp ile ütücüye iletilebilir.
- **WhatsApp'a PDF gönderme:** İrsaliye detayında **"PDF Gönder"** — irsaliyenin
  PDF'i oluşturulur ve telefonun paylaşım sayfası açılır; WhatsApp'ı seçince PDF
  dosya olarak ekli gider. (Metin olarak gönderme "Metin" butonunda duruyor.)
  Paylaşım desteklemeyen cihazlarda PDF indirilir.
- **Otomatik veri tazeleme:** Uygulama öne gelince ve açıkken her 60 saniyede bir
  sunucudan güncel veri çekilir — başka cihazda yapılan değişiklikler sayfa
  yenilemeden görünür. Henüz kaydedilmemiş yerel değişiklikler ezilmez.

## v2.6 Yenilikleri

- **Kumaş Stok sayfası** (STOK menüsünün altında): gelen kumaşları elle veya
  **kamera ile irsaliye QR'ı okutarak** kaydedin. Yazdırdığımız irsaliyelerdeki
  QR okutulunca ilgili parti bulunur ve form önden dolu açılır. Kamera için
  HTTPS ve ilk kullanımda kamera izni gerekir. Yeni `kumas_stok` tablosu
  api.php tarafından otomatik oluşturulur.
- **Alt menü:** "Firmalar" yerine "İş Akışı" geldi (Firmalar yan menüde duruyor).
- **iPhone üst boşluk:** üstteki butonlar durum çubuğunun altına ek payla indi —
  artık rahatça dokunulabiliyor.
- **Alt menü kayma düzeltmesi:** kaydırma artık gövde yerine içerik alanında —
  alt butonlar hiçbir sayfada sayfayla birlikte sürüklenmiyor.
- **İşlem Günlüğü:** en yeni işlem her zaman en üstte; "daha fazla göster"
  yerine sayfa mantığı (50 kayıt/sayfa, Önceki/Sonraki).
- **Han blue zemin** artık tüm uygulamada (kenarlık/açık tonlar da uyumlu).

## v2.7 Yenilikleri

- **Yapay zekâ ile irsaliye okuma (Kumaş Stok):** QR sistemi kaldırıldı. Artık
  "İrsaliye Okut" telefonun kamerasını açar, çekilen fotoğraf sunucu üzerinden
  Claude yapay zekâsına gönderilir; irsaliyedeki kumaş türü, renk, top adedi ve
  kilogram satır satır okunur, düzenlenebilir önizlemeden tek dokunuşla stoklara
  kaydedilir. **Gereksinim:** console.anthropic.com'dan alınan bir Anthropic API
  anahtarını `config.php` içindeki `$ANTHROPIC_API_KEY` alanına yazın (boşsa
  özellik kapalı kalır ve uygulama yönlendirme mesajı gösterir). "Türler"
  düğmesinden kumaş türlerinizi tanımlayın — okuma bu türlerle eşleştirilir.
- **Silme güvenliği:** Parti/ürün/firma/irsaliye silme butonları listelerden
  kaldırıldı (parti → detay sayfası, ürün/firma → düzenleme penceresi,
  irsaliye → detay penceresi). TÜM silme işlemleri artık güvenlik şifresi
  ister: **his38**
- **Klavye düzeltmesi (iPhone):** klavye kapandıktan sonra alt menünün yukarıda
  asılı kalması giderildi.

## Bilinen Sınırlamalar (bilgi amaçlı)
- Kimlik doğrulama istemci taraflıdır; API anahtarı derlenmiş JS içinde yer alır.
  Botlara/rastgele erişime karşı korur, ancak hedefli bir saldırgana karşı tam koruma
  için sunucu taraflı oturum (PHP session) gerekir — sonraki sürüm adayı.
- Aynı koleksiyonu (örn. iki kişi aynı anda parti listesini) düzenlerken hâlâ
  "son kaydeden kazanır" davranışı geçerlidir.
