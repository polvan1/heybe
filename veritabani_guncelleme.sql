-- ============================================================
-- HİS ERP v2.1 - Veritabanı Güncelleme Betiği
-- Tarih: 2026-07-06
--
-- NE YAPAR:
--   1) irsaliyeler tablosunu oluşturur  (önceki sürümde YOKTU —
--      bu yüzden irsaliyeler sayfa yenilenince kayboluyordu)
--   2) kullanicilar tablosunu oluşturur (önceki sürümde YOKTU —
--      kullanıcılar da aynı sebeple kayboluyordu)
--   3) settings tablosu yoksa oluşturur
--
-- NASIL ÇALIŞTIRILIR:
--   cPanel → phpMyAdmin → veritabanınızı seçin (myhiscom_fason_takip)
--   → SQL sekmesi → bu dosyanın içeriğini yapıştırın → Git/Go
--
-- NOT: "IF NOT EXISTS" kullanıldığı için mevcut tablolarınıza ve
--      verilerinize DOKUNMAZ. Birden çok kez çalıştırmak güvenlidir.
-- ============================================================

CREATE TABLE IF NOT EXISTS `irsaliyeler` (
  `id`               VARCHAR(40)  NOT NULL,
  `irsaliyeNo`       VARCHAR(30)  DEFAULT NULL,
  `partiId`          VARCHAR(40)  DEFAULT NULL,
  `partiNo`          VARCHAR(30)  DEFAULT NULL,
  `urunKodu`         VARCHAR(80)  DEFAULT NULL,
  `urunAdi`          VARCHAR(255) DEFAULT NULL,
  `toplamAdet`       INT          DEFAULT 0,
  `renkler`          LONGTEXT     DEFAULT NULL,   -- JSON
  `asorti`           LONGTEXT     DEFAULT NULL,   -- JSON
  `tip`              VARCHAR(40)  DEFAULT 'genel',
  `durum`            VARCHAR(20)  DEFAULT 'taslak',
  `gonderenFirmaId`  VARCHAR(40)  DEFAULT NULL,
  `gonderenFirmaAdi` VARCHAR(255) DEFAULT NULL,
  `alanFirmaId`      VARCHAR(40)  DEFAULT NULL,
  `alanFirmaAdi`     VARCHAR(255) DEFAULT NULL,
  `gonderenTel`      VARCHAR(40)  DEFAULT NULL,
  `gonderenAdres`    TEXT         DEFAULT NULL,
  `alanTel`          VARCHAR(40)  DEFAULT NULL,
  `alanAdres`        TEXT         DEFAULT NULL,
  `notlar`           TEXT         DEFAULT NULL,
  `tarih`            VARCHAR(40)  DEFAULT NULL,
  `onayTarihi`       VARCHAR(40)  DEFAULT NULL,
  `teslimTarihi`     VARCHAR(40)  DEFAULT NULL,
  `iptalTarihi`      VARCHAR(40)  DEFAULT NULL,
  `createdAt`        VARCHAR(40)  DEFAULT NULL,
  `updatedAt`        VARCHAR(40)  DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_irsaliye_parti` (`partiId`),
  KEY `idx_irsaliye_durum` (`durum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE IF NOT EXISTS `kullanicilar` (
  `id`        VARCHAR(40)  NOT NULL,
  `ad`        VARCHAR(120) DEFAULT NULL,
  `email`     VARCHAR(160) DEFAULT NULL,
  `telefon`   VARCHAR(40)  DEFAULT NULL,
  `rol`       VARCHAR(20)  DEFAULT 'fasoncu',
  `yetkiler`  LONGTEXT     DEFAULT NULL,   -- JSON dizi: ["anasayfa","partiler",...]
  `sifre`     VARCHAR(128) DEFAULT NULL,   -- SHA-256 hash olarak saklanır
  `aktif`     TINYINT(1)   DEFAULT 1,
  `createdAt` VARCHAR(40)  DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `s_key`   VARCHAR(60) NOT NULL,
  `s_value` LONGTEXT    DEFAULT NULL,
  PRIMARY KEY (`s_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- İşlem günlüğü / audit log (v2.3)
-- Not: api.php bu tabloyu ve aşağıdaki yeni kolonları gerekirse
-- KENDİSİ oluşturur (otomatik şema güncelleme) — elle çalıştırmak isteğe bağlıdır.
CREATE TABLE IF NOT EXISTS `islem_gunlugu` (
  `id`          VARCHAR(40)  NOT NULL,
  `tarih`       VARCHAR(40)  DEFAULT NULL,
  `kullaniciAd` VARCHAR(120) DEFAULT NULL,
  `kullaniciId` VARCHAR(40)  DEFAULT NULL,
  `islem`       VARCHAR(80)  DEFAULT NULL,
  `detay`       TEXT         DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- v2.3 yeni kolonlar (api.php otomatik ekler; elle eklemek isterseniz):
-- Bu satırlar "kolon zaten var" hatası verirse sorun yok, yoksayın.
-- ALTER TABLE `kullanicilar` ADD COLUMN `firmaId` VARCHAR(40) DEFAULT NULL;
-- ALTER TABLE `partiler`     ADD COLUMN `fotolar` LONGTEXT DEFAULT NULL;
-- ALTER TABLE `urunler`      ADD COLUMN `foto` VARCHAR(255) DEFAULT NULL;
-- v2.4:
-- ALTER TABLE `urunler`      ADD COLUMN `firmaFiyatlari` LONGTEXT DEFAULT NULL;
-- ALTER TABLE `partiler`     ADD COLUMN `arsivde` TINYINT(1) DEFAULT 0;

-- Gelen kumaş girişleri (v2.6) — api.php gerekirse otomatik oluşturur
CREATE TABLE IF NOT EXISTS `kumas_stok` (
  `id`            VARCHAR(40)  NOT NULL,
  `kumasAdi`      VARCHAR(160) DEFAULT NULL,
  `renk`          VARCHAR(80)  DEFAULT NULL,
  `miktar`        DOUBLE       DEFAULT 0,
  `birim`         VARCHAR(20)  DEFAULT 'kg',
  `gelenFirmaId`  VARCHAR(40)  DEFAULT NULL,
  `gelenFirmaAdi` VARCHAR(255) DEFAULT NULL,
  `partiId`       VARCHAR(40)  DEFAULT NULL,
  `partiNo`       VARCHAR(30)  DEFAULT NULL,
  `referansNo`    VARCHAR(160) DEFAULT NULL,
  `notlar`        TEXT         DEFAULT NULL,
  `tarih`         VARCHAR(40)  DEFAULT NULL,
  `createdAt`     VARCHAR(40)  DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- Tanımlı kumaş türleri (v2.7 — AI irsaliye okuma eşleştirmesi)
CREATE TABLE IF NOT EXISTS `kumas_turleri` (
  `id`        VARCHAR(40)  NOT NULL,
  `ad`        VARCHAR(160) DEFAULT NULL,
  `birim`     VARCHAR(20)  DEFAULT 'kg',
  `createdAt` VARCHAR(40)  DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;
-- v2.7 yeni kolon (api.php otomatik ekler):
-- ALTER TABLE `kumas_stok` ADD COLUMN `topAdedi` DOUBLE DEFAULT NULL;

-- Telefon push bildirimi abonelikleri (v2.2)
-- Not: api.php bu tabloyu gerekirse kendisi de oluşturur;
-- buraya dokümantasyon ve elle kurulum için eklendi.
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id`        VARCHAR(64) NOT NULL,
  `endpoint`  TEXT        NOT NULL,
  `p256dh`    VARCHAR(255) DEFAULT NULL,
  `auth`      VARCHAR(64)  DEFAULT NULL,
  `createdAt` VARCHAR(40)  DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
