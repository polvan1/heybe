// HİS ERP - DEMO sunucusu (sadece `vite build --mode demo` derlemesinde kullanılır)
// public/api.php'nin davranışını tarayıcı içinde taklit eder: giriş, yetkiler,
// kayıt bazlı senkronizasyon. Veriler bu tarayıcıda saklanır; kimseyle paylaşılmaz.
import { ApiHatasi } from './api';
import { demoVerisiOlustur } from './demoVeri';

const DEPO_ANAHTARI = 'hiserp_demo_v1';

// public/inc/auth.php ile aynı kurallar
const YETKI_YAZMA = {
    anasayfa: ['myhis_partiler', 'myhis_irsaliyeler', 'myhis_cariHareketler', 'myhis_isAkisi', 'myhis_urunler'],
    partiler: ['myhis_partiler', 'myhis_irsaliyeler', 'myhis_cariHareketler', 'myhis_isAkisi', 'myhis_urunler'],
    urunler: ['myhis_urunler'],
    stok_takibi: ['myhis_stoklar', 'myhis_stokHareketleri', 'myhis_kumasStok', 'myhis_kumasTurleri', 'myhis_urunler'],
    firmalar: ['myhis_firmalar'],
    cari_hesaplar: ['myhis_cariHareketler', 'myhis_partiler'],
    irsaliyeler: ['myhis_irsaliyeler'],
};
const HERKES_YAZAR = ['myhis_bildirimler', 'myhis_islemGunlugu'];
const TUM_YETKILER = ['anasayfa', 'islerim', 'partiler', 'is_akisi', 'takvim', 'urunler', 'stok_takibi',
    'firmalar', 'cari_hesaplar', 'irsaliyeler', 'raporlar', 'kullanicilar', 'ayarlar'];

let durum = null;

function yukle() {
    if (durum) return durum;
    try {
        const kayit = localStorage.getItem(DEPO_ANAHTARI);
        if (kayit) durum = JSON.parse(kayit);
    } catch (e) { /* depolama kapalı: bellekte çalış */ }
    if (!durum || !durum.veri) durum = { veri: demoVerisiOlustur(), oturum: null, tema: 'light' };
    return durum;
}

function kaydet() {
    try { localStorage.setItem(DEPO_ANAHTARI, JSON.stringify(durum)); } catch (e) { /* bellekte devam */ }
}

export function demoSifirla() {
    try { localStorage.removeItem(DEPO_ANAHTARI); } catch (e) { /* yoksay */ }
    durum = null;
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
    const d = yukle();
    const p = new URLSearchParams(sorgu);
    const g = govde || {};

    if (p.has('auth')) {
        const islem = p.get('auth');
        if (islem === 'durum') return { kurulumGerekli: false, kullanici: guvenli(aktif()) };
        if (islem === 'giris') {
            const aranan = String(g.kimlik || '').trim().toLocaleLowerCase('tr');
            const k = d.veri.kullanicilar.find(u => [u.email, u.ad].some(x => x && x.toLocaleLowerCase('tr') === aranan));
            if (!k || k.aktif === false || k.sifre !== String(g.sifre || '')) hata(401, 'hatali_giris', 'Kullanıcı adı veya şifre hatalı.');
            d.oturum = k.id; kaydet();
            return { success: true, kullanici: guvenli(k) };
        }
        if (islem === 'cikis') { d.oturum = null; kaydet(); return { success: true }; }
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

    const ben = girisGerekli();
    if (govde === undefined) {
        const sonuc = {};
        Object.keys(d.veri).forEach(k => { if (k.startsWith('myhis_')) sonuc[k] = kopya(d.veri[k]); });
        const tam = yetkiVar(ben, 'kullanicilar');
        sonuc.myhis_kullanicilar = d.veri.kullanicilar.map(u => {
            const s = guvenli(u);
            return tam ? s : { id: s.id, ad: s.ad, rol: s.rol, firmaId: s.firmaId, aktif: s.aktif };
        });
        sonuc.myhis_tema = d.tema;
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
    kaydet();
    return { success: true };
}
