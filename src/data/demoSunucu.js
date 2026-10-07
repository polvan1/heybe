// HİS ERP - DEMO sunucusu (sadece `vite build --mode demo` derlemesinde kullanılır)
// public/api.php'nin davranışını tarayıcı içinde taklit eder: giriş, yetkiler,
// kayıt bazlı senkronizasyon. Veriler bu tarayıcıda saklanır; kimseyle paylaşılmaz.
import { ApiHatasi } from './api';
import { demoVerisiOlustur } from './demoVeri';

const DEPO_ANAHTARI = 'hiserp_demo_v3'; // veri yapısı değişince artırılır (eski demo verisi sıfırlanır)

// public/inc/auth.php ile aynı kurallar
const YETKI_YAZMA = {
    anasayfa: ['myhis_partiler', 'myhis_irsaliyeler', 'myhis_cariHareketler', 'myhis_isAkisi', 'myhis_urunler'],
    partiler: ['myhis_partiler', 'myhis_irsaliyeler', 'myhis_cariHareketler', 'myhis_isAkisi', 'myhis_urunler'],
    urunler: ['myhis_urunler'],
    stok_takibi: ['myhis_stoklar', 'myhis_stokHareketleri', 'myhis_kumasStok', 'myhis_kumasTurleri', 'myhis_urunler'],
    firmalar: ['myhis_firmalar'],
    cari_hesaplar: ['myhis_cariHareketler', 'myhis_partiler'],
    irsaliyeler: ['myhis_irsaliyeler'],
    harita: ['myhis_araclar', 'myhis_seferler'],
};
const HERKES_YAZAR = ['myhis_bildirimler', 'myhis_islemGunlugu'];
const TUM_YETKILER = ['anasayfa', 'islerim', 'partiler', 'is_akisi', 'takvim', 'urunler', 'stok_takibi',
    'firmalar', 'cari_hesaplar', 'irsaliyeler', 'harita', 'gorevlerim', 'raporlar', 'kullanicilar', 'ayarlar'];

let durum = null;

// Veri her istekte depodan okunur: aynı tarayıcıda iki sekme açıkken (ör. biri sevk
// sorumlusu, biri şoför) birinin yaptığı değişikliği diğeri de görür.
// Oturum ise sekmeye özeldir (sessionStorage), böylece iki sekmede farklı kişi girebilir.
const OTURUM_ANAHTARI = 'hiserp_demo_oturum';
let bellekOturum = null;

// Depodan taze oku: her isteğin başında BİR kez çağrılır (istek içinde aynı nesne kullanılır)
function depodanOku() {
    try {
        const kayit = localStorage.getItem(DEPO_ANAHTARI);
        if (kayit) durum = JSON.parse(kayit);
    } catch (e) { /* depolama kapalı: bellekte çalış */ }
    if (!durum || !durum.veri) {
        const veri = demoVerisiOlustur();
        durum = { veri, tema: 'light', merkez: veri.merkez };
        delete veri.merkez;
        kaydet();
    }
    try { bellekOturum = sessionStorage.getItem(OTURUM_ANAHTARI) || bellekOturum; } catch (e) { /* bellekte */ }
    durum.oturum = bellekOturum;
    return durum;
}

function yukle() {
    return durum || depodanOku();
}

function oturumAyarla(id) {
    bellekOturum = id;
    try { if (id) sessionStorage.setItem(OTURUM_ANAHTARI, id); else sessionStorage.removeItem(OTURUM_ANAHTARI); } catch (e) { /* bellekte */ }
}

function kaydet() {
    const { oturum, ...paylasilan } = durum; // oturum sekmeye özel, paylaşılmaz
    try { localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(paylasilan)); } catch (e) { /* bellekte devam */ }
}

export function demoSifirla() {
    try { localStorage.removeItem(DEPO_ANAHTARI); } catch (e) { /* yoksay */ }
    durum = null;
    oturumAyarla(null);
}

const kopya = (x) => JSON.parse(JSON.stringify(x));
const hata = (kod, hataKodu, mesaj) => { throw new ApiHatasi(mesaj, kod, hataKodu, { error: hataKodu, mesaj }); };
const guvenli = (k) => { if (!k) return null; const { sifre, ...geri } = k; return kopya(geri); };
const yetkiVar = (k, y) => k && (k.rol === 'admin' || (k.yetkiler || []).includes(y));
const yeniId = (onEk = '') => onEk + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function aktif() {
    const d = yukle();
    const k = d.veri.kullanicilar.find(u => u.id === d.oturum);
    return k && k.aktif !== false ? k : null;
}

function girisGerekli() {
    const k = aktif();
    if (!k) hata(401, 'oturum_yok', 'Oturum açmanız gerekiyor.');
    return k;
}

function yazabilirMi(k, koleksiyon) {
    if (k.rol === 'admin' || HERKES_YAZAR.includes(koleksiyon)) return true;
    if (k.rol === 'izleyici') return false;
    return (k.yetkiler || []).some(y => (YETKI_YAZMA[y] || []).includes(koleksiyon));
}

function gunluk(k, islem, detay) {
    yukle().veri.myhis_islemGunlugu.unshift({ id: yeniId(), tarih: new Date().toISOString(), kullaniciAd: k?.ad || 'Sistem', kullaniciId: k?.id || null, islem, detay });
}

// Ağ gecikmesi hissi (çok kısa)
const bekle = () => new Promise(r => setTimeout(r, 60));

export async function demoIstek(sorgu, govde) {
    await bekle();
    const d = depodanOku();
    const p = new URLSearchParams(sorgu);
    const g = govde || {};

    if (p.has('auth')) {
        const islem = p.get('auth');
        if (islem === 'durum') return { kurulumGerekli: false, kullanici: guvenli(aktif()) };
        if (islem === 'giris') {
            const aranan = String(g.kimlik || '').trim().toLocaleLowerCase('tr');
            const k = d.veri.kullanicilar.find(u => [u.email, u.ad].some(x => x && x.toLocaleLowerCase('tr') === aranan));
            if (!k || k.aktif === false || k.sifre !== String(g.sifre || '')) hata(401, 'hatali_giris', 'Kullanıcı adı veya şifre hatalı.');
            oturumAyarla(k.id); d.oturum = k.id;
            return { success: true, kullanici: guvenli(k) };
        }
        if (islem === 'cikis') { oturumAyarla(null); d.oturum = null; return { success: true }; }
        hata(400, 'bilinmeyen', 'Demo modunda desteklenmiyor.');
    }

    if (p.has('kullanici')) {
        const ben = girisGerekli();
        if (!yetkiVar(ben, 'kullanicilar')) hata(403, 'yetki_yok', 'Bu işlem için yetkiniz yok.');
        const islem = p.get('kullanici');
        const temizle = (hedef) => {
            ['ad', 'email', 'telefon'].forEach(a => { if (a in g) hedef[a] = String(g[a] || '').trim(); });
            if ('rol' in g) {
                if (g.rol === 'admin' && ben.rol !== 'admin') hata(403, 'yetki_yok', 'Yönetici hesabını sadece yönetici oluşturabilir.');
                hedef.rol = g.rol;
            }
            if (Array.isArray(g.yetkiler)) hedef.yetkiler = g.yetkiler.filter(y => TUM_YETKILER.includes(y));
            if ('aktif' in g) hedef.aktif = !!g.aktif;
            if ('firmaId' in g) hedef.firmaId = g.firmaId || null;
            if (g.sifre) {
                if (String(g.sifre).length < 6) hata(400, 'zayif_sifre', 'Şifre en az 6 karakter olmalı.');
                hedef.sifre = String(g.sifre);
            }
            return hedef;
        };
        if (islem === 'ekle') {
            if (!g.sifre) hata(400, 'zayif_sifre', 'Şifre en az 6 karakter olmalı.');
            const k = temizle({ id: yeniId('usr_'), rol: 'izleyici', yetkiler: [], aktif: true, firmaId: null, createdAt: new Date().toISOString() });
            if (!k.ad) hata(400, 'eksik', 'Ad Soyad girin.');
            d.veri.kullanicilar.push(k); gunluk(ben, 'Kullanıcı Eklendi', `${k.ad} (${k.rol})`); kaydet();
            return { success: true, kullanici: guvenli(k) };
        }
        const k = d.veri.kullanicilar.find(u => u.id === g.id);
        if (!k) hata(404, 'yok', 'Kullanıcı bulunamadı.');
        if (k.rol === 'admin' && ben.rol !== 'admin') hata(403, 'yetki_yok', 'Yönetici hesabını sadece yönetici değiştirebilir.');
        if (islem === 'guncelle') {
            const eskiRol = k.rol;
            temizle(k);
            if (k.id === ben.id) { k.aktif = true; k.rol = eskiRol; }
            gunluk(ben, 'Kullanıcı Güncellendi', k.ad); kaydet();
            return { success: true, kullanici: guvenli(k) };
        }
        if (islem === 'sil') {
            if (k.id === ben.id) hata(400, 'kendini_silme', 'Oturumu açık olan kullanıcıyı silemezsiniz.');
            d.veri.kullanicilar = d.veri.kullanicilar.filter(u => u.id !== k.id);
            gunluk(ben, 'Kullanıcı Silindi', k.ad); kaydet();
            return { success: true };
        }
    }

    if (p.has('foto')) {
        girisGerekli();
        // Demoda fotoğraf sunucuya gitmez; görselin kendisi saklanır
        if (p.get('foto') === 'upload') return { url: g.data };
        return { success: true };
    }

    if (p.has('irsaliye_oku')) {
        girisGerekli();
        return { error: 'anahtar_yok', mesaj: 'Demo modunda yapay zekâ ile irsaliye okuma kapalıdır. Gerçek sunucuda config.php içine Anthropic API anahtarı eklendiğinde çalışır.' };
    }

    if (p.has('push')) {
        girisGerekli();
        hata(400, 'demo', 'Telefon bildirimleri demo modunda kapalıdır; gerçek sunucuda (HTTPS) çalışır.');
    }

    // Şoför işlemleri (public/inc/sefer.php ile aynı kurallar)
    if (p.has('sefer')) {
        const ben = girisGerekli();
        const islem = p.get('sefer');
        const simdi = new Date().toISOString();
        if (islem === 'konum') {
            d.veri.myhis_araclar.forEach(a => { if (a.soforId === ben.id) Object.assign(a, { sonLat: +g.lat, sonLng: +g.lng, sonKonumZamani: simdi }); });
            kaydet();
            return { success: true };
        }
        const s = d.veri.myhis_seferler.find(x => x.id === g.seferId);
        if (!s) hata(404, 'yok', 'Sefer bulunamadı.');
        if (islem === 'iptal') {
            if (!yetkiVar(ben, 'harita')) hata(403, 'yetki_yok', 'Bu işlem için yetkiniz yok.');
            if (s.durum === 'tamamlandi') hata(400, 'bitti', 'Tamamlanmış sefer iptal edilemez.');
            Object.assign(s, { durum: 'iptal', bitisZamani: simdi, updatedAt: simdi });
            if (s.soforId) d.veri.myhis_bildirimler.unshift({ id: yeniId(), tip: 'sefer', baslik: 'Seferiniz iptal edildi', mesaj: `${ben.ad} seferi iptal etti.`, link: '/gorevlerim', okundu: false, tarih: simdi, kullaniciId: s.soforId });
            gunluk(ben, 'Sefer İptal Edildi', s.aracAdi || s.id); kaydet();
            return { success: true };
        }
        if (islem === 'durak') {
            if (s.soforId !== ben.id && !yetkiVar(ben, 'harita')) hata(403, 'yetki_yok', 'Bu sefer size atanmamış.');
            if (s.durum === 'iptal') hata(400, 'iptal', 'Bu sefer iptal edilmiş.');
            const durak = s.duraklar?.[g.durakNo];
            if (!durak || durak.tip !== 'durak') hata(400, 'durak', 'Geçersiz durak.');
            const geriAl = g.islem === 'geri_al';
            if (geriAl) { durak.durum = 'bekliyor'; delete durak.tamamlanmaZamani; }
            else if (durak.durum !== 'tamamlandi') {
                durak.durum = 'tamamlandi'; durak.tamamlanmaZamani = simdi;
                const irs = (id) => d.veri.myhis_irsaliyeler.find(i => i.id === id);
                (durak.alimlar || []).forEach(x => { const i = irs(x.irsaliyeId); if (i && i.durum === 'taslak') Object.assign(i, { durum: 'onaylandi', onayTarihi: simdi, updatedAt: simdi }); });
                (durak.teslimler || []).forEach(x => { const i = irs(x.irsaliyeId); if (i) Object.assign(i, { durum: 'teslim_edildi', teslimTarihi: simdi, updatedAt: simdi }); });
            }
            const isler = s.duraklar.filter(x => x.tip === 'durak');
            const biten = isler.filter(x => x.durum === 'tamamlandi').length;
            s.durum = biten === isler.length ? 'tamamlandi' : biten ? 'yolda' : 'atandi';
            s.bitisZamani = s.durum === 'tamamlandi' ? simdi : null;
            if (biten && !s.baslamaZamani) s.baslamaZamani = simdi;
            s.updatedAt = simdi;
            if (!geriAl) {
                const teslim = (durak.teslimler || []).map(x => x.etiket);
                const mesaj = `${ben.ad} — ${durak.ad}${teslim.length ? ': ' + teslim.join(', ') + ' teslim edildi' : ': yük alındı'}`;
                d.veri.myhis_bildirimler.unshift({ id: yeniId(), tip: 'sefer', baslik: s.durum === 'tamamlandi' ? 'Sefer tamamlandı' : `Durak tamamlandı (${biten}/${isler.length})`, mesaj, link: '/harita', okundu: false, tarih: simdi, kullaniciId: null });
                gunluk(ben, 'Durak Tamamlandı', mesaj);
            }
            kaydet();
            return { success: true, sefer: kopya(s) };
        }
        hata(400, 'bilinmeyen', 'Bilinmeyen işlem.');
    }

    const ben = girisGerekli();
    if (govde === undefined) {
        const sonuc = {};
        if (ben.rol === 'sofor') {
            // Şoför sadece kendi seferlerini ve onlarla ilgili verileri görür (sync.php soforVerisi)
            Object.keys(d.veri).forEach(k => { if (k.startsWith('myhis_')) sonuc[k] = []; });
            const seferler = d.veri.myhis_seferler.filter(s => s.soforId === ben.id);
            const irsIdleri = new Set(seferler.flatMap(s => (s.duraklar || []).flatMap(x => [...(x.alimlar || []), ...(x.teslimler || [])].map(y => y.irsaliyeId))));
            sonuc.myhis_seferler = kopya(seferler);
            sonuc.myhis_irsaliyeler = kopya(d.veri.myhis_irsaliyeler.filter(i => irsIdleri.has(i.id)));
            sonuc.myhis_firmalar = d.veri.myhis_firmalar.map(({ id, ad, tip, telefon, adres, yetkiliKisi, lat, lng, konumAdres, aktif }) => ({ id, ad, tip, telefon, adres, yetkiliKisi, lat, lng, konumAdres, aktif }));
            sonuc.myhis_araclar = kopya(d.veri.myhis_araclar.filter(a => a.soforId === ben.id));
            sonuc.myhis_bildirimler = kopya(d.veri.myhis_bildirimler.filter(b => b.kullaniciId === ben.id));
            sonuc.myhis_kullanicilar = [{ id: ben.id, ad: ben.ad, rol: ben.rol, firmaId: ben.firmaId, aktif: true }];
            sonuc.myhis_tema = d.tema;
            if (d.merkez) sonuc.myhis_merkez = JSON.stringify(d.merkez);
            return sonuc;
        }
        Object.keys(d.veri).forEach(k => { if (k.startsWith('myhis_')) sonuc[k] = kopya(d.veri[k]); });
        sonuc.myhis_bildirimler = sonuc.myhis_bildirimler.filter(b => !b.kullaniciId || b.kullaniciId === ben.id);
        const tam = yetkiVar(ben, 'kullanicilar');
        sonuc.myhis_kullanicilar = d.veri.kullanicilar.map(u => {
            const s = guvenli(u);
            return tam ? s : { id: s.id, ad: s.ad, rol: s.rol, firmaId: s.firmaId, aktif: s.aktif };
        });
        sonuc.myhis_tema = d.tema;
        if (d.merkez) sonuc.myhis_merkez = JSON.stringify(d.merkez);
        return sonuc;
    }

    // POST: delta kaydet
    const degisiklikler = g.degisiklikler || {};
    const reddedilen = Object.keys(degisiklikler).filter(k => !(k in d.veri) || !k.startsWith('myhis_') || !yazabilirMi(ben, k));
    if (reddedilen.length) hata(403, 'yetki_yok', 'Bu verileri değiştirme yetkiniz yok.');
    Object.entries(degisiklikler).forEach(([k, { upsert = [], delete: sil = [] }]) => {
        let liste = d.veri[k];
        upsert.forEach(satir => {
            if (!satir?.id) return;
            const i = liste.findIndex(r => r.id === satir.id);
            if (i >= 0) liste[i] = kopya(satir); else liste.push(kopya(satir));
        });
        if (sil.length) liste = liste.filter(r => !sil.includes(r.id));
        if (k === 'myhis_bildirimler' || k === 'myhis_islemGunlugu') liste.sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)));
        d.veri[k] = liste;
    });
    if (g.myhis_tema === 'light' || g.myhis_tema === 'dark') d.tema = g.myhis_tema;
    if (g.myhis_merkez && Number.isFinite(+g.myhis_merkez.lat) && Number.isFinite(+g.myhis_merkez.lng)
        && (yetkiVar(ben, 'ayarlar') || yetkiVar(ben, 'harita'))) {
        d.merkez = { ad: String(g.myhis_merkez.ad || 'Merkez').slice(0, 120), lat: +g.myhis_merkez.lat, lng: +g.myhis_merkez.lng };
    }
    kaydet();
    return { success: true };
}
