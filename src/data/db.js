// HİS ERP - Veri Katmanı (sunucu API senkronizasyonlu)
import { sha256 } from '../utils/sha256';
import { API_URL, API_KEY } from './api';

const STORAGE_KEYS = {
  firmalar: 'myhis_firmalar',
  urunler: 'myhis_urunler',
  partiler: 'myhis_partiler',
  cariHareketler: 'myhis_cariHareketler',
  isAkisi: 'myhis_isAkisi',
  bildirimler: 'myhis_bildirimler',
  stoklar: 'myhis_stoklar',
  stokHareketleri: 'myhis_stokHareketleri',
  irsaliyeler: 'myhis_irsaliyeler',
  tema: 'myhis_tema',
  kullanicilar: 'myhis_kullanicilar',
  islemGunlugu: 'myhis_islemGunlugu',
  kumasStok: 'myhis_kumasStok',
  kumasTurleri: 'myhis_kumasTurleri',
};

// Generic CRUD helpers
let inMemoryDb = {};
const API_HEADERS = { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY };

// --- SENKRONİZASYON ALTYAPISI ---
// Değişen koleksiyonlar biriktirilir ve tek POST ile SADECE değişenler gönderilir.
// Böylece iki cihaz aynı anda açıkken birbirinin farklı koleksiyonlarını ezmez.
let pendingKeys = new Set();
let persistTimer = null;

function notifySync(ok) {
  try {
    window.dispatchEvent(new CustomEvent('myhis:sync', { detail: { ok } }));
  } catch (e) { /* SSR/test ortamı */ }
}

function schedulePersist(key) {
  pendingKeys.add(key);
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(flushPersist, 250);
}

export async function flushPersist() {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  if (pendingKeys.size === 0) return true;
  const keys = [...pendingKeys];
  pendingKeys.clear();
  const payload = {};
  keys.forEach(k => { payload[k] = inMemoryDb[k]; });
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify(payload),
      keepalive: true, // sayfa kapanırken de gönderilebilsin
    });
    if (!response.ok) {
      console.error('Veritabanı sunucuya kaydedilemedi:', response.status);
      keys.forEach(k => pendingKeys.add(k)); // tekrar denenebilsin
      notifySync(false);
      return false;
    }
    notifySync(true);
    return true;
  } catch (e) {
    console.error('Veritabanı bağlantı hatası:', e);
    keys.forEach(k => pendingKeys.add(k));
    notifySync(false);
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { flushPersist(); });
}

async function persistNow(keys) {
  keys.forEach(k => pendingKeys.add(k));
  return flushPersist();
}

// Sunucudan güncel veriyi çek (başka cihazda yapılan değişiklikleri almak için).
// Henüz sunucuya GÖNDERİLMEMİŞ yerel değişiklikler (pendingKeys) EZİLMEZ.
export async function refetchFromServer() {
  try {
    const response = await fetch(`${API_URL}?t=${Date.now()}`, { headers: { 'X-Api-Key': API_KEY } });
    if (!response.ok) return false;
    const data = await response.json();
    if (!data || typeof data !== 'object') return false;
    Object.keys(data).forEach(k => {
      if (!pendingKeys.has(k)) inMemoryDb[k] = data[k];
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function initDB() {
  try {
    const response = await fetch(`${API_URL}?t=${Date.now()}`, { headers: { 'X-Api-Key': API_KEY } });
    if (!response.ok) {
      notifySync(false);
      return;
    }
    const data = await response.json();
    inMemoryDb = data || {};

    // Migration: tarayıcıda eski localStorage verisi varsa dosya/DB'ye aktar
    const isMigrated = localStorage.getItem('myhis_migrated');
    const hasOldData = localStorage.getItem(STORAGE_KEYS.partiler);

    if (!isMigrated && hasOldData) {
      console.log('Eski veriler tespit edildi, sunucuya aktarılıyor...');
      for (const key of Object.values(STORAGE_KEYS)) {
        const item = localStorage.getItem(key);
        if (item) {
          try { inMemoryDb[key] = JSON.parse(item); } catch (e) { inMemoryDb[key] = item; }
        }
      }
      localStorage.setItem('myhis_migrated', 'true');
      await persistNow(Object.values(STORAGE_KEYS));
    } else if (Object.keys(inMemoryDb).length === 0) {
      // SADECE fetch başarılı olduysa VE veritabanı cidden boşsa örnek veriler yükle.
      seedData();
      await flushPersist();
    }
  } catch (error) {
    console.error('Veritabanı yükleme hatası:', error);
    // Hata durumunda örnek veri yüklemiyoruz ki mevcut sunucu verisini bozmayalım
    notifySync(false);
  }
}

function getAll(key) {
  if (!inMemoryDb[key]) return [];
  return Array.isArray(inMemoryDb[key]) ? inMemoryDb[key] : [];
}

function saveAll(key, data) {
  inMemoryDb[key] = data;
  schedulePersist(key);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

// --- İŞLEM GÜNLÜĞÜ (AUDIT LOG) ---
// Kim, ne zaman, ne yaptı? AppContext girişte aktif kullanıcıyı bildirir.
let aktifKullanici = null;

export function setAktifKullanici(user) {
  aktifKullanici = user;
}

export function getIslemGunlugu() {
  return getAll(STORAGE_KEYS.islemGunlugu);
}

export function logIslem(islem, detay) {
  const gunluk = getIslemGunlugu();
  gunluk.unshift({
    id: generateId(),
    tarih: new Date().toISOString(),
    kullaniciAd: aktifKullanici?.ad || 'Sistem',
    kullaniciId: aktifKullanici?.id || null,
    islem,   // örn: 'Parti Silindi'
    detay,   // örn: 'P-0012 — Erkek Basic T-Shirt (500 adet)'
  });
  // Son 1000 kayıt tutulur
  if (gunluk.length > 1000) gunluk.length = 1000;
  saveAll(STORAGE_KEYS.islemGunlugu, gunluk);
}

// --- FIRMALAR ---
export function getFirmalar() {
  return getAll(STORAGE_KEYS.firmalar);
}

export function getFirmaById(id) {
  return getFirmalar().find(f => f.id === id);
}

export function addFirma(firma) {
  const firmalar = getFirmalar();
  const newFirma = {
    id: generateId(),
    ...firma,
    odemeVadesi: firma.odemeVadesi || null, // Ayın kaçında ödeme (1-31)
    aktif: true,
    createdAt: new Date().toISOString(),
  };
  firmalar.push(newFirma);
  saveAll(STORAGE_KEYS.firmalar, firmalar);
  logIslem('Firma Eklendi', newFirma.ad);
  return newFirma;
}

export function updateFirma(id, updates) {
  const firmalar = getFirmalar();
  const index = firmalar.findIndex(f => f.id === id);
  if (index !== -1) {
    firmalar[index] = { ...firmalar[index], ...updates };
    saveAll(STORAGE_KEYS.firmalar, firmalar);
    return firmalar[index];
  }
  return null;
}

export function deleteFirma(id) {
  // Bağlı kayıt kontrolü: veri bütünlüğünü korumak için ilişkili kaydı olan firma silinemez
  const partiKullanimi = getPartiler().some(p =>
    p.kesimhaneId === id || p.dikimhaneId === id || p.utupaketciId === id ||
    (p.firmaAtamalari || []).some(a => a.firmaId === id)
  );
  const cariKullanimi = getCariHareketler().some(h => h.firmaId === id);
  const irsaliyeKullanimi = getIrsaliyeler().some(i => i.gonderenFirmaId === id || i.alanFirmaId === id);

  if (partiKullanimi || cariKullanimi || irsaliyeKullanimi) {
    return {
      ok: false,
      reason: 'Bu firmaya bağlı parti, cari hareket veya irsaliye kayıtları var. Firmayı silmek yerine pasife alabilir ya da önce bağlı kayıtları silebilirsiniz.',
    };
  }

  const silinen = getFirmaById(id);
  const firmalar = getFirmalar().filter(f => f.id !== id);
  saveAll(STORAGE_KEYS.firmalar, firmalar);
  logIslem('Firma Silindi', silinen?.ad || id);
  return { ok: true };
}

// --- ÜRÜNLER ---
export function getUrunler() {
  return getAll(STORAGE_KEYS.urunler);
}

export function getUrunById(id) {
  return getUrunler().find(u => u.id === id);
}

export function addUrun(urun) {
  const urunler = getUrunler();
  const newUrun = {
    id: generateId(),
    ...urun,
    stokAdet: urun.stokAdet || 0,
    createdAt: new Date().toISOString(),
  };
  urunler.push(newUrun);
  saveAll(STORAGE_KEYS.urunler, urunler);
  logIslem('Ürün Eklendi', `${newUrun.urunKodu} — ${newUrun.urunAdi}`);
  return newUrun;
}

export function updateUrun(id, updates) {
  const urunler = getUrunler();
  const index = urunler.findIndex(u => u.id === id);
  if (index !== -1) {
    urunler[index] = { ...urunler[index], ...updates };
    saveAll(STORAGE_KEYS.urunler, urunler);
    return urunler[index];
  }
  return null;
}

// Firma bazlı fiyat anlaşması çözümü: ürünün o firmaya özel fiyatı varsa onu,
// yoksa ürünün varsayılan fiyatını döndürür. tip: 'kesim' | 'dikim' | 'utu'
export function firmaFiyatBul(urun, firmaId, tip) {
  if (!urun) return 0;
  const ozel = firmaId && urun.firmaFiyatlari?.[firmaId]?.[tip];
  if (ozel !== undefined && ozel !== null && ozel !== '' && parseFloat(ozel) > 0) {
    return parseFloat(ozel);
  }
  return parseFloat(urun[tip + 'Fiyat']) || 0;
}

export function deleteUrun(id) {
  const silinen = getUrunById(id);
  const urunler = getUrunler().filter(u => u.id !== id);
  saveAll(STORAGE_KEYS.urunler, urunler);
  logIslem('Ürün Silindi', silinen ? `${silinen.urunKodu} — ${silinen.urunAdi}` : id);
}

// --- PARTİLER ---
export const DURUM_SIRALAMA = [
  'kesimde',
  'dikimde',
  'utupakette',
  'tamamlandi',
];

export const DURUM_LABELS = {
  kesimde: 'Kesimde',
  dikimde: 'Dikimde',
  utupakette: 'Ütü/Paket',
  tamamlandi: 'Tamamlandı',
};

export const FIRMA_TIP_LABELS = {
  kesimhane: 'Kesimhane',
  baskici: 'Baskıcı',
  atolye: 'Atölye (Dikimhane)',
  utupaketci: 'Ütü/Paketçi',
};

export const ADIM_FIRMA_TIP = {
  kesimde: 'kesimhane',
  dikimde: 'atolye',
  utupakette: 'utupaketci',
};

export function getPartiler() {
  return getAll(STORAGE_KEYS.partiler);
}

export function getPartiById(id) {
  return getPartiler().find(p => p.id === id);
}

export function addParti(parti) {
  const partiler = getPartiler();
  // Parti no: mevcut en yüksek numaradan devam et (silme sonrası numara tekrarını önler)
  const maxPartiNo = partiler.reduce((max, p) => {
    const m = /^P-(\d+)$/.exec(p.partiNo || '');
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  const newParti = {
    id: generateId(),
    partiNo: 'P-' + String(maxPartiNo + 1).padStart(4, '0'),
    ...parti,
    kalanAdet: parti.toplamAdet,
    durum: 'kesimde',
    firmaAtamalari: [],
    teslimatGecmisi: [], // Yeni: teslimat log'u
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  partiler.push(newParti);
  saveAll(STORAGE_KEYS.partiler, partiler);

  // Parti oluşturulunca sevkiyat irsaliyesi OTOMATİK oluşturulur
  // (kesimhane → dikimhane; İrsaliyeler sayfasında taslak olarak görünür)
  if (newParti.kesimhaneId && newParti.dikimhaneId) {
    const gonderen = getFirmaById(newParti.kesimhaneId);
    const alan = getFirmaById(newParti.dikimhaneId);
    addIrsaliye({
      partiId: newParti.id,
      partiNo: newParti.partiNo,
      urunKodu: newParti.urunKodu,
      urunAdi: newParti.urunAdi,
      toplamAdet: newParti.toplamAdet,
      renkler: newParti.renkler,
      asorti: newParti.asorti,
      tip: 'kesimhane_dikimhane',
      gonderenFirmaId: newParti.kesimhaneId,
      gonderenFirmaAdi: gonderen?.ad || '',
      alanFirmaId: newParti.dikimhaneId,
      alanFirmaAdi: alan?.ad || '',
      gonderenTel: gonderen?.telefon || '',
      gonderenAdres: gonderen?.adres || '',
      alanTel: alan?.telefon || '',
      alanAdres: alan?.adres || '',
      notlar: `${newParti.partiNo} partisi oluşturulduğunda otomatik düzenlendi.`,
    });
  }

  logIslem('Parti Oluşturuldu', `${newParti.partiNo} — ${newParti.urunAdi} (${newParti.toplamAdet} adet)`);
  return newParti;
}

export function updateParti(id, updates) {
  const partiler = getPartiler();
  const index = partiler.findIndex(p => p.id === id);
  if (index !== -1) {
    partiler[index] = { ...partiler[index], ...updates, updatedAt: new Date().toISOString() };
    saveAll(STORAGE_KEYS.partiler, partiler);
    return partiler[index];
  }
  return null;
}

export function deleteParti(id) {
  const silinen = getPartiById(id);
  logIslem('Parti Silindi', silinen ? `${silinen.partiNo} — ${silinen.urunAdi} (${silinen.toplamAdet} adet)` : id);
  const partiler = getPartiler().filter(p => p.id !== id);
  saveAll(STORAGE_KEYS.partiler, partiler);
  const hareketler = getCariHareketler().filter(h => h.partiId !== id);
  saveAll(STORAGE_KEYS.cariHareketler, hareketler);
  const akis = getIsAkisi().filter(a => a.partiId !== id);
  saveAll(STORAGE_KEYS.isAkisi, akis);
  // Partiye bağlı irsaliyeleri de temizle (öksüz kayıt kalmasın)
  const irsaliyeler = getIrsaliyeler().filter(i => i.partiId !== id);
  saveAll(STORAGE_KEYS.irsaliyeler, irsaliyeler);
}

// --- PARTİ ARŞİVİ ---
// Bir parti şu durumda arşivde sayılır:
//  1) Manuel arşivlendiyse (parti.arsivde === true), VEYA
//  2) OTOMATİK: üretimi tamamlandı VE partinin tüm borçları "hesabı görüldü"
//     (Cari Detay'daki "Hesabı Kapat" işlemi sonrası kendiliğinden arşive düşer)
export function isPartiArsivde(parti, hareketler) {
  if (!parti) return false;
  if (parti.arsivde === true) return true;
  if (parti.durum !== 'tamamlandi') return false;
  const tumHareketler = hareketler || getCariHareketler();
  const borclar = tumHareketler.filter(h => h.partiId === parti.id && h.tip === 'borc');
  if (borclar.length === 0) return false; // hesap hiç oluşmadıysa arşive otomatik düşmez
  return borclar.every(b => b.hesaplandi);
}

export function setPartiArsiv(id, arsivde) {
  const parti = getPartiById(id);
  if (!parti) return null;
  logIslem(arsivde ? 'Parti Arşivlendi' : 'Parti Arşivden Çıkarıldı', `${parti.partiNo} — ${parti.urunAdi}`);
  return updateParti(id, { arsivde: !!arsivde });
}

// Firma atama & parti tamamlama
export function ataFirma(partiId, atama) {
  const parti = getPartiById(partiId);
  if (!parti) return null;
  const newAtama = {
    id: generateId(),
    ...atama,
    cikanAdet: 0,
    tamamlandi: false,
    tarih: new Date().toISOString(),
  };
  parti.firmaAtamalari.push(newAtama);
  updateParti(partiId, { firmaAtamalari: parti.firmaAtamalari });

  addIsAkisiAdim({
    partiId,
    adim: parti.durum,
    firmaId: atama.firmaId,
    girilenAdet: atama.adet,
    cikanAdet: 0,
    durum: 'devam',
  });

  return newAtama;
}

export function tamamlaAtama(partiId, atamaId, cikanAdet) {
  const parti = getPartiById(partiId);
  if (!parti) return null;

  const atamaIndex = parti.firmaAtamalari.findIndex(a => a.id === atamaId);
  if (atamaIndex === -1) return null;

  const atama = parti.firmaAtamalari[atamaIndex];
  const girenAdet = atama.adet;
  atama.cikanAdet = cikanAdet;
  atama.tamamlandi = true;
  atama.tamamlanmaTarihi = new Date().toISOString();
  parti.firmaAtamalari[atamaIndex] = atama;

  // Teslimat geçmişi log'u
  const gecmis = parti.teslimatGecmisi || [];
  const firma = getFirmaById(atama.firmaId);
  gecmis.push({
    id: generateId(),
    tarih: new Date().toISOString(),
    firmaAdi: firma?.ad || '—',
    firmaId: atama.firmaId,
    adim: atama.adim || parti.durum,
    girenAdet,
    cikanAdet,
    fire: girenAdet - cikanAdet,
  });

  updateParti(partiId, { firmaAtamalari: parti.firmaAtamalari, teslimatGecmisi: gecmis });

  // Fire yüksekse bildirim
  const fireOrani = girenAdet > 0 ? ((girenAdet - cikanAdet) / girenAdet) * 100 : 0;
  if (fireOrani > 5) {
    addBildirim({
      tip: 'fire',
      baslik: `Yüksek Fire: ${parti.partiNo}`,
      mesaj: `${firma?.ad || 'Firma'} → ${cikanAdet}/${girenAdet} adet (${fireOrani.toFixed(1)}% fire)`,
      link: `/parti/${partiId}`,
    });
  }

  // NOT: Borç yazma işlemi kaldırıldı. Borçlar sadece ütü/paketten çıktığında (tamamlandı) yazılır.

  const akisler = getIsAkisi().filter(a => a.partiId === partiId && a.firmaId === atama.firmaId);
  if (akisler.length > 0) {
    updateIsAkisiAdim(akisler[akisler.length - 1].id, {
      cikanAdet,
      durum: 'tamamlandi',
      bitisTarihi: new Date().toISOString(),
    });
  }

  // Parti tamamlanınca bildirim
  if (parti.durum === 'tamamlandi' || (parti.firmaAtamalari.every(a => a.tamamlandi))) {
    addBildirim({
      tip: 'parti',
      baslik: `${parti.partiNo} Tamamlandı`,
      mesaj: `${parti.urunAdi} — ${cikanAdet} adet çıktı`,
      link: `/parti/${partiId}`,
    });
  }

  return atama;
}

export function ilerletPartiDurum(partiId, cikanAdet) {
  const parti = getPartiById(partiId);
  if (!parti) return null;
  const currentIndex = DURUM_SIRALAMA.indexOf(parti.durum);
  if (currentIndex < DURUM_SIRALAMA.length - 1) {
    const yeniDurum = DURUM_SIRALAMA[currentIndex + 1];
    const adet = cikanAdet || parti.toplamAdet || 0;

    // Teslimat geçmişine ekle
    const gecmis = parti.teslimatGecmisi || [];
    gecmis.push({
      id: generateId(),
      tarih: new Date().toISOString(),
      firmaAdi: 'Sistem (İlerletme)',
      adim: `${DURUM_LABELS[parti.durum]} → ${DURUM_LABELS[yeniDurum]}`,
      girenAdet: parti.toplamAdet,
      cikanAdet: adet,
      fire: parti.toplamAdet - adet,
    });

    // BORÇ YAZMA: Sadece ütü/paketten çıktığında (tamamlandı) TÜM firmalara borç yazılır
    if (yeniDurum === 'tamamlandi') {
      const firmaBirimFiyatMap = [
        { firmaId: parti.kesimhaneId, birimFiyat: parti.kesimBirimFiyat || 0, rol: 'Kesim' },
        { firmaId: parti.dikimhaneId, birimFiyat: parti.dikimBirimFiyat || 0, rol: 'Dikim' },
        { firmaId: parti.utupaketciId, birimFiyat: parti.utuBirimFiyat || 0, rol: 'Ütü/Paket' },
      ];

      firmaBirimFiyatMap.forEach(({ firmaId, birimFiyat, rol }) => {
        if (firmaId && birimFiyat > 0) {
          const mevcutBorclar = getCariHareketler().filter(
            h => h.firmaId === firmaId && h.partiId === partiId && h.tip === 'borc'
          );
          if (mevcutBorclar.length === 0) {
            addCariHareket({
              firmaId,
              partiId,
              tip: 'borc',
              tutar: adet * birimFiyat,
              aciklama: `${parti.partiNo} - ${parti.urunAdi} [${rol}] (${adet} ad × ${birimFiyat} TL)`,
            });
          }
        }
      });

      addBildirim({
        tip: 'parti',
        baslik: `${parti.partiNo} Tamamlandı!`,
        mesaj: `${parti.urunAdi} — ${adet} adet ile üretim tamamlandı`,
        link: `/parti/${partiId}`,
      });

      // Ürün stokuna ekle (ütü/paketten çıkan adet)
      if (parti.urunId) {
        const urun = getUrunById(parti.urunId);
        if (urun) {
          updateUrun(urun.id, { stokAdet: (urun.stokAdet || 0) + adet });
        }
      }
    }

    logIslem('Parti İlerletildi', `${parti.partiNo}: ${DURUM_LABELS[parti.durum]} → ${DURUM_LABELS[yeniDurum]} (${adet} adet çıkış)`);

    const guncellemeler = {
      durum: yeniDurum,
      kalanAdet: Math.max((parti.kalanAdet || parti.toplamAdet) - adet, 0),
      sonCikanAdet: adet,
      teslimatGecmisi: gecmis,
    };

    if (yeniDurum === 'dikimde') {
      guncellemeler.dikimBaslamaTarihi = new Date().toISOString();
    }
    if (parti.durum === 'dikimde' && (yeniDurum === 'utupakette' || yeniDurum === 'tamamlandi')) {
      guncellemeler.dikimBitisTarihi = new Date().toISOString();
      guncellemeler.dikimdenCikanAdet = adet;
    }

    // Dikimden ütü/pakete geçişte sevkiyat irsaliyesi OTOMATİK oluşturulur
    // (dikimhane → ütü/paketçi; adet = dikimden çıkan adet)
    if (parti.durum === 'dikimde' && yeniDurum === 'utupakette' && parti.dikimhaneId && parti.utupaketciId) {
      const gonderen = getFirmaById(parti.dikimhaneId);
      const alan = getFirmaById(parti.utupaketciId);
      addIrsaliye({
        partiId: parti.id,
        partiNo: parti.partiNo,
        urunKodu: parti.urunKodu,
        urunAdi: parti.urunAdi,
        toplamAdet: adet,
        renkler: parti.renkler,
        asorti: parti.asorti,
        tip: 'dikimhane_utupaketci',
        gonderenFirmaId: parti.dikimhaneId,
        gonderenFirmaAdi: gonderen?.ad || '',
        alanFirmaId: parti.utupaketciId,
        alanFirmaAdi: alan?.ad || '',
        gonderenTel: gonderen?.telefon || '',
        gonderenAdres: gonderen?.adres || '',
        alanTel: alan?.telefon || '',
        alanAdres: alan?.adres || '',
        notlar: `${parti.partiNo} dikimden çıktığında otomatik düzenlendi (${adet} adet).`,
      });
    }

    return updateParti(partiId, guncellemeler);
  }
  return parti;
}

// --- CARİ HAREKETLER ---
export function getCariHareketler() {
  return getAll(STORAGE_KEYS.cariHareketler);
}

export function getCariHareketlerByFirma(firmaId) {
  return getCariHareketler().filter(h => h.firmaId === firmaId);
}

export function addCariHareket(hareket) {
  const hareketler = getCariHareketler();
  const newHareket = {
    id: generateId(),
    ...hareket,
    tarih: hareket.tarih || new Date().toISOString(),
  };
  hareketler.push(newHareket);
  saveAll(STORAGE_KEYS.cariHareketler, hareketler);
  const firma = getFirmaById(newHareket.firmaId);
  logIslem(newHareket.tip === 'borc' ? 'Borç Kaydı' : 'Ödeme Kaydı', `${firma?.ad || ''}: ${Number(newHareket.tutar).toLocaleString('tr-TR')} ₺ — ${newHareket.aciklama || ''}`);
  return newHareket;
}

export function deleteCariHareket(id) {
  const silinen = getCariHareketler().find(h => h.id === id);
  const hareketler = getCariHareketler().filter(h => h.id !== id);
  saveAll(STORAGE_KEYS.cariHareketler, hareketler);
  if (silinen) {
    const firma = getFirmaById(silinen.firmaId);
    logIslem('Cari Hareket Silindi', `${firma?.ad || ''}: ${Number(silinen.tutar).toLocaleString('tr-TR')} ₺ — ${silinen.aciklama || ''}`);
  }
}

export function getFirmaBakiye(firmaId) {
  const hareketler = getCariHareketlerByFirma(firmaId);
  let borc = 0;
  let alacak = 0;
  hareketler.forEach(h => {
    if (h.hesaplandi) return;
    if (h.tip === 'borc') borc += h.tutar;
    else alacak += h.tutar;
  });
  return { borc, alacak, bakiye: borc - alacak };
}

export function setHareketlerHesaplandi(hareketIds) {
  const hareketler = getCariHareketler();
  hareketIds.forEach(id => {
    const index = hareketler.findIndex(h => h.id === id);
    if (index !== -1) {
      hareketler[index].hesaplandi = true;
      hareketler[index].hesapTarihi = new Date().toISOString();
    }
  });
  saveAll(STORAGE_KEYS.cariHareketler, hareketler);
  logIslem('Hesap Kapatıldı', `${hareketIds.length} hareket hesaplandı olarak işaretlendi`);
}

// --- BİLDİRİMLER ---
export function getBildirimler() {
  return getAll(STORAGE_KEYS.bildirimler);
}

export function addBildirim(bildirim) {
  const bildirimler = getBildirimler();
  const newBildirim = {
    id: generateId(),
    ...bildirim,
    okundu: false,
    tarih: new Date().toISOString(),
  };
  bildirimler.unshift(newBildirim); // En yeni başta
  // Max 50 bildirim tut
  if (bildirimler.length > 50) bildirimler.length = 50;
  saveAll(STORAGE_KEYS.bildirimler, bildirimler);
  return newBildirim;
}

export function markBildirimOkundu(id) {
  const bildirimler = getBildirimler();
  const index = bildirimler.findIndex(b => b.id === id);
  if (index !== -1) {
    bildirimler[index].okundu = true;
    saveAll(STORAGE_KEYS.bildirimler, bildirimler);
  }
}

export function markAllBildirimlerOkundu() {
  const bildirimler = getBildirimler();
  bildirimler.forEach(b => { b.okundu = true; });
  saveAll(STORAGE_KEYS.bildirimler, bildirimler);
}

export function getOkunmamisBildirimSayisi() {
  return getBildirimler().filter(b => !b.okundu).length;
}

// --- STOK / KUMAŞ TAKİBİ ---
export function getStoklar() {
  return getAll(STORAGE_KEYS.stoklar);
}

export function getStokById(id) {
  return getStoklar().find(s => s.id === id);
}

export function addStok(stok) {
  const stoklar = getStoklar();
  const newStok = {
    id: generateId(),
    ...stok,
    kalanMiktar: stok.miktar || 0,
    createdAt: new Date().toISOString(),
  };
  stoklar.push(newStok);
  saveAll(STORAGE_KEYS.stoklar, stoklar);
  return newStok;
}

export function updateStok(id, updates) {
  const stoklar = getStoklar();
  const index = stoklar.findIndex(s => s.id === id);
  if (index !== -1) {
    stoklar[index] = { ...stoklar[index], ...updates };
    saveAll(STORAGE_KEYS.stoklar, stoklar);
    return stoklar[index];
  }
  return null;
}

export function deleteStok(id) {
  const stoklar = getStoklar().filter(s => s.id !== id);
  saveAll(STORAGE_KEYS.stoklar, stoklar);
}

export function getStokHareketleri() {
  return getAll(STORAGE_KEYS.stokHareketleri);
}

export function addStokHareketi(hareket) {
  const hareketler = getStokHareketleri();
  const newHareket = {
    id: generateId(),
    ...hareket,
    tarih: new Date().toISOString(),
  };
  hareketler.push(newHareket);
  saveAll(STORAGE_KEYS.stokHareketleri, hareketler);

  // Stok miktarını güncelle
  const stok = getStokById(hareket.stokId);
  if (stok) {
    const yeniMiktar = hareket.tip === 'giris'
      ? (stok.kalanMiktar || 0) + hareket.miktar
      : (stok.kalanMiktar || 0) - hareket.miktar;
    updateStok(hareket.stokId, { kalanMiktar: Math.max(yeniMiktar, 0) });
  }

  return newHareket;
}

// --- KUMAŞ TÜRLERİ (yapay zekâ irsaliye okuma bunlarla eşleştirir) ---
export function getKumasTurleri() {
  return getAll(STORAGE_KEYS.kumasTurleri);
}

export function addKumasTuru(ad, birim) {
  const turler = getKumasTurleri();
  if (turler.some(t => t.ad.toLowerCase() === ad.toLowerCase())) return null; // aynı ad iki kez eklenmesin
  const yeni = { id: generateId(), ad: ad.trim(), birim: birim || 'kg', createdAt: new Date().toISOString() };
  turler.push(yeni);
  saveAll(STORAGE_KEYS.kumasTurleri, turler);
  logIslem('Kumaş Türü Eklendi', yeni.ad);
  return yeni;
}

export function deleteKumasTuru(id) {
  const silinen = getKumasTurleri().find(t => t.id === id);
  saveAll(STORAGE_KEYS.kumasTurleri, getKumasTurleri().filter(t => t.id !== id));
  if (silinen) logIslem('Kumaş Türü Silindi', silinen.ad);
}

// --- KUMAŞ STOK (gelen kumaş girişleri) ---
export function getKumasStoklar() {
  return getAll(STORAGE_KEYS.kumasStok);
}

export function addKumasStok(kayit) {
  const kayitlar = getKumasStoklar();
  const yeni = {
    id: generateId(),
    ...kayit,
    tarih: kayit.tarih || new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  kayitlar.push(yeni);
  saveAll(STORAGE_KEYS.kumasStok, kayitlar);
  logIslem('Kumaş Girişi', `${yeni.kumasAdi}${yeni.renk ? ` (${yeni.renk})` : ''} — ${yeni.miktar} ${yeni.birim || ''}${yeni.gelenFirmaAdi ? ` • ${yeni.gelenFirmaAdi}` : ''}`);
  return yeni;
}

export function updateKumasStok(id, updates) {
  const kayitlar = getKumasStoklar();
  const index = kayitlar.findIndex(k => k.id === id);
  if (index !== -1) {
    kayitlar[index] = { ...kayitlar[index], ...updates };
    saveAll(STORAGE_KEYS.kumasStok, kayitlar);
    return kayitlar[index];
  }
  return null;
}

export function deleteKumasStok(id) {
  const silinen = getKumasStoklar().find(k => k.id === id);
  saveAll(STORAGE_KEYS.kumasStok, getKumasStoklar().filter(k => k.id !== id));
  if (silinen) logIslem('Kumaş Girişi Silindi', `${silinen.kumasAdi} — ${silinen.miktar} ${silinen.birim || ''}`);
}

// --- İRSALİYELER ---
export const IRSALIYE_DURUM_LABELS = {
  taslak: 'Taslak',
  onaylandi: 'Onaylandı',
  teslim_edildi: 'Teslim Edildi',
  iptal: 'İptal',
};

export const IRSALIYE_TIP_LABELS = {
  kesimhane_dikimhane: 'Kesimhane → Dikimhane',
  kesimhane_baskici: 'Kesimhane → Baskıcı',
  dikimhane_utupaketci: 'Dikimhane → Ütü/Paket',
  genel: 'Genel Sevkiyat',
};

export function getIrsaliyeler() {
  return getAll(STORAGE_KEYS.irsaliyeler);
}

export function getIrsaliyeById(id) {
  return getIrsaliyeler().find(i => i.id === id);
}

export function getIrsaliyelerByParti(partiId) {
  return getIrsaliyeler().filter(i => i.partiId === partiId);
}

export function getIrsaliyelerByFirma(firmaId) {
  return getIrsaliyeler().filter(i => i.gonderenFirmaId === firmaId || i.alanFirmaId === firmaId);
}

function generateIrsaliyeNo() {
  const irsaliyeler = getIrsaliyeler();
  const yil = new Date().getFullYear();
  // Yıla ait en yüksek sıra numarasından devam et (silme sonrası numara tekrarını önler)
  const re = new RegExp(`^IRS-${yil}-(\\d+)$`);
  const maxSira = irsaliyeler.reduce((max, i) => {
    const m = re.exec(i.irsaliyeNo || '');
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  return `IRS-${yil}-${String(maxSira + 1).padStart(4, '0')}`;
}

export function addIrsaliye(irsaliye) {
  const irsaliyeler = getIrsaliyeler();
  const newIrsaliye = {
    id: generateId(),
    irsaliyeNo: generateIrsaliyeNo(),
    ...irsaliye,
    durum: irsaliye.durum || 'taslak',
    tarih: irsaliye.tarih || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  irsaliyeler.push(newIrsaliye);
  saveAll(STORAGE_KEYS.irsaliyeler, irsaliyeler);
  return newIrsaliye;
}

export function updateIrsaliye(id, updates) {
  const irsaliyeler = getIrsaliyeler();
  const index = irsaliyeler.findIndex(i => i.id === id);
  if (index !== -1) {
    irsaliyeler[index] = { ...irsaliyeler[index], ...updates, updatedAt: new Date().toISOString() };
    saveAll(STORAGE_KEYS.irsaliyeler, irsaliyeler);
    return irsaliyeler[index];
  }
  return null;
}

export function deleteIrsaliye(id) {
  const silinen = getIrsaliyeById(id);
  const irsaliyeler = getIrsaliyeler().filter(i => i.id !== id);
  saveAll(STORAGE_KEYS.irsaliyeler, irsaliyeler);
  logIslem('İrsaliye Silindi', silinen ? `${silinen.irsaliyeNo} (${silinen.partiNo || ''})` : id);
}

export function onaylaIrsaliye(id) {
  const irs = getIrsaliyeById(id);
  logIslem('İrsaliye Onaylandı', irs?.irsaliyeNo || id);
  return updateIrsaliye(id, { durum: 'onaylandi', onayTarihi: new Date().toISOString() });
}

export function teslimEtIrsaliye(id) {
  const irsaliye = getIrsaliyeById(id);
  if (!irsaliye) return null;
  const updated = updateIrsaliye(id, { durum: 'teslim_edildi', teslimTarihi: new Date().toISOString() });
  // Bildirim oluştur
  addBildirim({
    tip: 'irsaliye',
    baslik: `İrsaliye Teslim Edildi: ${irsaliye.irsaliyeNo}`,
    mesaj: `${irsaliye.partiNo || ''} — ${irsaliye.toplamAdet || 0} adet teslim edildi`,
    link: `/irsaliyeler`,
  });
  return updated;
}

export function iptalIrsaliye(id) {
  const irs = getIrsaliyeById(id);
  logIslem('İrsaliye İptal Edildi', irs?.irsaliyeNo || id);
  return updateIrsaliye(id, { durum: 'iptal', iptalTarihi: new Date().toISOString() });
}

// --- TEMA ---
export function getTema() {
  return inMemoryDb[STORAGE_KEYS.tema] || 'light';
}

export function setTema(tema) {
  inMemoryDb[STORAGE_KEYS.tema] = tema;
  schedulePersist(STORAGE_KEYS.tema);
}

// --- FİRMA PERFORMANS HESAPLAMA ---
export function getFirmaPerformans(firmaId) {
  const partiler = getPartiler();
  const isAkisi = getIsAkisi();

  // Bu firmaya atanmış tüm işler
  let toplamIs = 0;
  let tamamlananIs = 0;
  let toplamGiren = 0;
  let toplamCikan = 0;
  let toplamSure = 0; // gün olarak
  let sureliIsler = 0;

  partiler.forEach(p => {
    (p.firmaAtamalari || []).forEach(a => {
      if (a.firmaId === firmaId) {
        toplamIs++;
        if (a.tamamlandi) {
          tamamlananIs++;
          toplamGiren += a.adet || 0;
          toplamCikan += a.cikanAdet || 0;
          if (a.tarih && a.tamamlanmaTarihi) {
            const gun = (new Date(a.tamamlanmaTarihi) - new Date(a.tarih)) / (1000 * 60 * 60 * 24);
            toplamSure += gun;
            sureliIsler++;
          }
        }
      }
    });
  });

  const fireOrani = toplamGiren > 0 ? ((toplamGiren - toplamCikan) / toplamGiren) * 100 : 0;
  const ortTeslimSuresi = sureliIsler > 0 ? toplamSure / sureliIsler : 0;
  const tamamlanmaOrani = toplamIs > 0 ? (tamamlananIs / toplamIs) * 100 : 0;

  // Performans skoru (100 üzerinden)
  let skor = 100;
  skor -= fireOrani * 5; // Fire çıkarma
  if (ortTeslimSuresi > 7) skor -= (ortTeslimSuresi - 7) * 3; // 7 günden uzunsa düş
  skor = Math.max(0, Math.min(100, Math.round(skor)));

  return {
    toplamIs,
    tamamlananIs,
    toplamGiren,
    toplamCikan,
    fireOrani: fireOrani.toFixed(1),
    ortTeslimSuresi: ortTeslimSuresi.toFixed(1),
    tamamlanmaOrani: tamamlanmaOrani.toFixed(0),
    skor,
  };
}

// --- VADE TAKİBİ ---
export function getVadesiGelenFirmalar() {
  const firmalar = getFirmalar();
  const bugun = new Date();
  const gunNo = bugun.getDate();
  const sonuc = [];

  firmalar.forEach(firma => {
    if (!firma.odemeVadesi) return;
    const bakiye = getFirmaBakiye(firma.id);
    if (bakiye.bakiye <= 0) return; // Borç yoksa atla

    const vadeGunu = parseInt(firma.odemeVadesi, 10);
    const fark = vadeGunu - gunNo;

    let durum = 'normal';
    if (fark < 0) durum = 'gecikti';
    else if (fark <= 3) durum = 'yaklasti';

    if (durum !== 'normal') {
      sonuc.push({
        firma,
        bakiye: bakiye.bakiye,
        vadeGunu,
        fark,
        durum,
      });
    }
  });

  return sonuc.sort((a, b) => a.fark - b.fark);
}

// --- İŞ AKIŞI ---
export function getIsAkisi() {
  return getAll(STORAGE_KEYS.isAkisi);
}

export function addIsAkisiAdim(adim) {
  const akis = getIsAkisi();
  const newAdim = {
    id: generateId(),
    ...adim,
    baslangicTarihi: new Date().toISOString(),
    bitisTarihi: null,
  };
  akis.push(newAdim);
  saveAll(STORAGE_KEYS.isAkisi, akis);
  return newAdim;
}

export function updateIsAkisiAdim(id, updates) {
  const akis = getIsAkisi();
  const index = akis.findIndex(a => a.id === id);
  if (index !== -1) {
    akis[index] = { ...akis[index], ...updates };
    saveAll(STORAGE_KEYS.isAkisi, akis);
    return akis[index];
  }
  return null;
}

// --- CSV EXPORT HELPER ---
export function exportToCSV(data, headers, filename) {
  const csvRows = [];
  csvRows.push(headers.map(h => h.label).join(';'));
  data.forEach(row => {
    csvRows.push(headers.map(h => {
      let val = typeof h.key === 'function' ? h.key(row) : (row[h.key] ?? '');
      // Escape
      val = String(val).replace(/"/g, '""');
      if (String(val).includes(';') || String(val).includes('"')) val = `"${val}"`;
      return val;
    }).join(';'));
  });

  const csvString = '\uFEFF' + csvRows.join('\n'); // BOM for Turkish chars
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// --- SEED DATA ---
export function seedData() {
  if (getFirmalar().length > 0) return;

  const firmalar = [
    { ad: 'Yıldız Kesimhane', tip: 'kesimhane', telefon: '0532 111 2233', adres: 'Merter, İstanbul', yetkiliKisi: 'Ahmet Yıldız', notlar: '', gunlukKapasite: 500, odemeVadesi: 20 },
    { ad: 'Star Baskı', tip: 'baskici', telefon: '0533 222 3344', adres: 'Güngören, İstanbul', yetkiliKisi: 'Mehmet Kaya', notlar: 'Dijital baskı uzmanı', gunlukKapasite: 300, odemeVadesi: 15 },
    { ad: 'Özkan Tekstil Atölyesi', tip: 'atolye', telefon: '0534 333 4455', adres: 'Zeytinburnu, İstanbul', yetkiliKisi: 'Ali Özkan', notlar: '', gunlukKapasite: 200, odemeVadesi: 25 },
    { ad: 'Güneş Ütü Paket', tip: 'utupaketci', telefon: '0535 444 5566', adres: 'Bayrampaşa, İstanbul', yetkiliKisi: 'Fatma Güneş', notlar: '', gunlukKapasite: 400, odemeVadesi: 20 },
    { ad: 'Demir Kesim', tip: 'kesimhane', telefon: '0536 555 6677', adres: 'Bağcılar, İstanbul', yetkiliKisi: 'Hasan Demir', notlar: '', gunlukKapasite: 600, odemeVadesi: null },
    { ad: 'Efe Dikim Atölyesi', tip: 'atolye', telefon: '0537 666 7788', adres: 'Esenler, İstanbul', yetkiliKisi: 'Efe Çelik', notlar: '', gunlukKapasite: 150, odemeVadesi: 20 },
  ];
  firmalar.forEach(f => addFirma(f));

  const urunler = [
    {
      urunKodu: 'TS-001',
      urunAdi: 'Erkek Basic T-Shirt',
      asorti: {
        bedenler: ['S', 'M', 'L', 'XL', '2XL'],
        dagilim: { 'S': 1, 'M': 2, 'L': 3, 'XL': 2, '2XL': 1 },
      },
    },
    {
      urunKodu: 'TS-002',
      urunAdi: 'Kadın V-Yaka T-Shirt',
      asorti: {
        bedenler: ['XS', 'S', 'M', 'L', 'XL'],
        dagilim: { 'XS': 1, 'S': 2, 'M': 3, 'L': 2, 'XL': 1 },
      },
    },
    {
      urunKodu: 'SW-001',
      urunAdi: 'Unisex Oversize Sweatshirt',
      asorti: {
        bedenler: ['S', 'M', 'L', 'XL'],
        dagilim: { 'S': 1, 'M': 2, 'L': 2, 'XL': 1 },
      },
    },
  ];
  urunler.forEach(u => addUrun(u));
}

// --- KULLANICILAR & KİMLİK DOĞRULAMA ---
function isSifreHash(v) {
  return typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
}

export function hashSifre(sifre) {
  return sha256(String(sifre));
}

export function getKullanicilar() {
  return getAll(STORAGE_KEYS.kullanicilar);
}

export function addKullanici(kullanici) {
  const kullanicilar = getKullanicilar();
  const yeniKullanici = {
    ...kullanici,
    // Şifreyi asla düz metin saklama
    sifre: kullanici.sifre && !isSifreHash(kullanici.sifre) ? hashSifre(kullanici.sifre) : (kullanici.sifre || ''),
    id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    createdAt: new Date().toISOString()
  };
  kullanicilar.push(yeniKullanici);
  saveAll(STORAGE_KEYS.kullanicilar, kullanicilar);
  logIslem('Kullanıcı Eklendi', `${yeniKullanici.ad} (${yeniKullanici.rol})`);
  return yeniKullanici;
}

export function updateKullanici(id, updates) {
  const kullanicilar = getKullanicilar();
  const index = kullanicilar.findIndex(k => k.id === id);
  if (index !== -1) {
    const safeUpdates = { ...updates };
    if (safeUpdates.sifre && !isSifreHash(safeUpdates.sifre)) {
      safeUpdates.sifre = hashSifre(safeUpdates.sifre);
    }
    kullanicilar[index] = { ...kullanicilar[index], ...safeUpdates };
    saveAll(STORAGE_KEYS.kullanicilar, kullanicilar);
    return kullanicilar[index];
  }
  return null;
}

export function deleteKullanici(id) {
  const kullanicilar = getKullanicilar();
  const silinen = kullanicilar.find(k => k.id === id);
  saveAll(STORAGE_KEYS.kullanicilar, kullanicilar.filter(k => k.id !== id));
  logIslem('Kullanıcı Silindi', silinen?.ad || id);
}

export function verifyLogin(kimlik, sifre) {
  const aranan = String(kimlik || '').trim().toLowerCase();
  if (!aranan) return { ok: false, error: 'Kullanıcı adı veya e-posta girin.' };
  const user = getKullanicilar().find(k =>
    k.aktif !== false && (
      (k.email && k.email.toLowerCase() === aranan) ||
      (k.ad && k.ad.toLowerCase() === aranan)
    )
  );
  if (!user) return { ok: false, error: 'Kullanıcı bulunamadı veya pasif durumda.' };

  const stored = user.sifre || '';
  const dogru = isSifreHash(stored)
    ? stored === hashSifre(sifre)
    : stored === String(sifre); // eski düz metin şifre desteği

  if (!dogru) return { ok: false, error: 'Şifre hatalı.' };

  // Eski düz metin şifreyi hash'e yükselt
  if (!isSifreHash(stored)) {
    updateKullanici(user.id, { sifre: hashSifre(sifre) });
  }
  return { ok: true, user };
}

// --- OTURUM (12 saat geçerli) ---
const SESSION_KEY = 'myhis_session';
const SESSION_TTL = 12 * 60 * 60 * 1000;

export function saveSession(userId) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, expires: Date.now() + SESSION_TTL }));
}

export function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s && s.userId && s.expires > Date.now()) return s.userId;
  } catch (e) { /* bozuk kayıt */ }
  return null;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// --- YEDEKLEME ---
export function exportBackup() {
  const yedek = {};
  Object.values(STORAGE_KEYS).forEach(k => {
    if (inMemoryDb[k] !== undefined) yedek[k] = inMemoryDb[k];
  });
  const blob = new Blob([JSON.stringify(yedek, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `his-erp-yedek_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function importBackup(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('Dosya geçerli bir JSON değil.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Geçersiz yedek dosyası.');
  }
  const bilinen = Object.values(STORAGE_KEYS);
  const keys = Object.keys(data).filter(k => bilinen.includes(k));
  if (keys.length === 0) {
    throw new Error('Yedek dosyasında tanınan HİS ERP verisi bulunamadı.');
  }
  keys.forEach(k => { inMemoryDb[k] = data[k]; });
  logIslem('Yedek Geri Yüklendi', `${keys.length} veri grubu yedekten geri yüklendi`);
  const ok = await persistNow(keys);
  if (!ok) throw new Error('Yedek yüklendi ancak sunucuya kaydedilemedi. Bağlantıyı kontrol edin.');
  return keys.length;
}

// --- FASONCU TESLİM BİLDİRİMİ ---
// Fasoncu kendi ekranından "işim bitti, X adet çıktı" bildirir;
// bildirim (ve push) yöneticiye düşer, yönetici partiyi ilerleterek onaylar.
export function fasoncuTeslimBildir(partiId, cikanAdet, notu) {
  const parti = getPartiById(partiId);
  if (!parti) return null;
  const firma = aktifKullanici?.firmaId ? getFirmaById(aktifKullanici.firmaId) : null;
  addBildirim({
    tip: 'teslim_talebi',
    baslik: `Teslim Bildirimi: ${parti.partiNo}`,
    mesaj: `${firma?.ad || aktifKullanici?.ad || 'Fasoncu'} — ${cikanAdet} adet çıkış bildirdi${notu ? ` (${notu})` : ''}. Onay için partiyi ilerletin.`,
    link: `/parti/${partiId}`,
  });
  logIslem('Teslim Bildirildi', `${parti.partiNo}: ${cikanAdet} adet (${firma?.ad || '—'})`);
  return true;
}
