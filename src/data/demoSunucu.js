// HİS ERP - DEMO sunucusu (sadece `vite build --mode demo` derlemesinde kullanılır)
// public/api.php'nin davranışını tarayıcı içinde taklit eder: giriş, yetkiler,
// kayıt bazlı senkronizasyon. Veriler bu tarayıcıda saklanır; kimseyle paylaşılmaz.
import { ApiHatasi } from './api';
import { demoVerisiOlustur } from './demoVeri';

const DEPO_ANAHTARI = 'hiserp_demo_v5'; // veri yapısı değişince artırılır (eski demo verisi sıfırlanır)

// public/inc/auth.php ile aynı kurallar
const YETKI_YAZMA = {
    anasayfa: ['myhis_partiler', 'myhis_irsaliyeler', 'myhis_cariHareketler', 'myhis_isAkisi', 'myhis_urunler'],
    partiler: ['myhis_partiler', 'myhis_irsaliyeler', 'myhis_cariHareketler', 'myhis_isAkisi', 'myhis_urunler'],
    urunler: ['myhis_urunler'],
    stok_takibi: ['myhis_stoklar', 'myhis_stokHareketleri', 'myhis_kumasStok', 'myhis_kumasTurleri', 'myhis_urunler'],
    kumas_stok: ['myhis_kumasStok', 'myhis_kumasTurleri'],
    firmalar: ['myhis_firmalar'],
    cari_hesaplar: ['myhis_cariHareketler', 'myhis_partiler'],
    irsaliyeler: ['myhis_irsaliyeler'],
    harita: ['myhis_araclar', 'myhis_seferler'],
};
const HERKES_YAZAR = ['myhis_bildirimler', 'myhis_islemGunlugu'];
const TUM_YETKILER = ['anasayfa', 'islerim', 'partiler', 'is_akisi', 'takvim', 'urunler', 'stok_takibi', 'kumas_stok',
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
const yetkiVar = (k, y) => !!k && (k.rol === 'admin' || (k.yetkiler || []).includes(y)
    || (y === 'kumas_stok' && (k.yetkiler || []).includes('stok_takibi')));
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
    if (k.rol === 'kesimhane') {
        if (koleksiyon === 'myhis_partiler' || koleksiyon === 'myhis_irsaliyeler') return yetkiVar(k, 'partiler') || yetkiVar(k, 'irsaliyeler');
        if (koleksiyon === 'myhis_kumasStok' || koleksiyon === 'myhis_kumasTurleri') return yetkiVar(k, 'kumas_stok');
        return false;
    }
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
        const ben = girisGerekli();
        if (g.tur === 'sevk') {
            // Demo: gerçek yapay zekâ yerine örnek bir "okunmuş form" döner (akışı denemek için)
            await new Promise(r => setTimeout(r, 900));
            const v = yukle().veri;
            const kesimhane = v.myhis_firmalar.find(f => f.id === ben.firmaId) || v.myhis_firmalar.find(f => f.tip === 'kesimhane');
            const parti = v.myhis_partiler.find(x => x.kesimhaneId === kesimhane?.id && x.durum === 'kesimde') || v.myhis_partiler.find(x => x.durum === 'kesimde');
            const atolye = v.myhis_firmalar.find(f => f.id === parti?.dikimhaneId) || v.myhis_firmalar.find(f => f.tip === 'atolye');
            const urun = v.myhis_urunler.find(u => u.id === parti?.urunId) || v.myhis_urunler[0];
            const diger = v.myhis_urunler.find(u => u.id !== urun.id);
            return {
                success: true,
                saglayici: 'Demo (örnek okuma — gerçek sunucuda Gemini okur)',
                okuma: {
                    formKodu: 'HIS-KS1', tarih: new Date().toISOString().slice(0, 10), irsaliyeNo: '0147',
                    gonderen: kesimhane?.ad || '', alan: (atolye?.ad || '').toUpperCase(), partiNo: parti?.partiNo || '',
                    satirlar: [
                        { model: urun.urunKodu.replace('-', ' '), renk: 'Siyah', bedenler: { S: 40, M: 60, L: 40 }, adet: 140 },
                        { model: urun.urunKodu, renk: 'Beyaz', bedenler: {}, adet: 120 },
                        { model: diger ? diger.urunKodu.toLowerCase() : '', renk: 'lacivert', bedenler: {}, adet: 75 },
                    ],
                    toplamAdet: 335, notlar: '',
                },
            };
        }
        return { error: 'anahtar_yok', mesaj: 'Demo modunda kumaş irsaliyesi okuma kapalıdır. Gerçek sunucuda yapay zekâ anahtarı (ör. ücretsiz GEMINI_API_KEY) eklendiğinde çalışır.' };
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
        if (ben.rol === 'kesimhane') {
            Object.assign(sonuc, kesimhaneVerisi(d, ben));
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
    const yenile = ben.rol === 'kesimhane' ? kesimhaneYazimi(d, ben, degisiklikler) : false;
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
    return { success: true, yenile };
}

// ---- Kesimhane yetkilisi (public/inc/kesimhane.php ile aynı kurallar) ----
const KESIMHANE_FIRMA_ALANLARI = ['id', 'ad', 'tip', 'telefon', 'adres', 'yetkiliKisi', 'lat', 'lng', 'konumAdres', 'aktif'];
const KESIMHANE_URUN_GIZLI = ['kesimFiyat', 'dikimFiyat', 'utuFiyat', 'firmaFiyatlari', 'fiyatlar'];
const KESIMHANE_KUMAS_GIZLI = ['birimFiyat', 'tutar', 'cariHareketId'];
const kumasBagliBorc = (d, k) => {
    const borc = k?.cariHareketId ? d.veri.myhis_cariHareketler.find(h => h.id === k.cariHareketId) : null;
    return borc && !borc.hesaplandi && borc.kumasStokId === k.id ? borc : null;
};
const KESIMHANE_PARTI_ALANLARI = ['kesimDurumu', 'kesilenAdet', 'kesilenRenkler', 'kesimTarihi', 'kesimNotu',
    'gonderimTarihi', 'dikimeGonderilenAdet', 'fotolar', 'durum', 'kalanAdet', 'sonCikanAdet', 'teslimatGecmisi', 'dikimBaslamaTarihi', 'updatedAt'];
const KESIMHANE_IRSALIYE_ALANLARI = ['toplamAdet', 'notlar', 'renkler', 'updatedAt'];
const sec = (nesne, alanlar) => Object.fromEntries(alanlar.filter(a => a in nesne).map(a => [a, nesne[a]]));
const irsFirmaya = (i, firmaId) => i.gonderenFirmaId === firmaId || i.alanFirmaId === firmaId;

function kesimhaneVerisi(d, ben) {
    const f = ben.firmaId || '';
    const sonuc = {};
    Object.keys(d.veri).forEach(k => { if (k.startsWith('myhis_')) sonuc[k] = []; });
    if (f) {
        sonuc.myhis_partiler = kopya(d.veri.myhis_partiler.filter(p => p.kesimhaneId === f))
            .map(({ kesimBirimFiyat, dikimBirimFiyat, utuBirimFiyat, ...p }) => p);
        sonuc.myhis_irsaliyeler = kopya(d.veri.myhis_irsaliyeler.filter(i => irsFirmaya(i, f)));
        sonuc.myhis_kumasStok = kopya(d.veri.myhis_kumasStok.filter(k => k.kesimhaneId === f))
            .map(k => { KESIMHANE_KUMAS_GIZLI.forEach(a => delete k[a]); return k; });
    }
    sonuc.myhis_kumasTurleri = kopya(d.veri.myhis_kumasTurleri);
    sonuc.myhis_urunler = kopya(d.veri.myhis_urunler).map(u => { KESIMHANE_URUN_GIZLI.forEach(a => delete u[a]); return u; });
    sonuc.myhis_firmalar = d.veri.myhis_firmalar.map(x => sec(x, KESIMHANE_FIRMA_ALANLARI));
    sonuc.myhis_bildirimler = kopya(d.veri.myhis_bildirimler.filter(b => b.kullaniciId === ben.id));
    sonuc.myhis_kullanicilar = [{ id: ben.id, ad: ben.ad, rol: ben.rol, firmaId: ben.firmaId, aktif: true }];
    return sonuc;
}

function fiyatBul(urun, firmaId, tip) {
    if (!urun) return 0;
    const ozel = firmaId && urun.firmaFiyatlari?.[firmaId]?.[tip];
    if (ozel !== undefined && ozel !== null && ozel !== '' && parseFloat(ozel) > 0) return parseFloat(ozel);
    return parseFloat(urun[tip + 'Fiyat']) || 0;
}

function sonrakiNo(liste, alan, desen, ek) {
    let max = 0;
    [...liste.map(x => x[alan]), ...ek].forEach(no => { const m = desen.exec(no || ''); if (m) max = Math.max(max, +m[1]); });
    return max + 1;
}

function kesimhaneYazimi(d, ben, degisiklikler) {
    const f = ben.firmaId || '';
    if (!f) hata(403, 'yetki_yok', 'Hesabınıza kesimhane firması bağlanmamış. Yöneticinize başvurun.');
    const firma = d.veri.myhis_firmalar.find(x => x.id === f);
    let duzeltildi = false;
    ['myhis_partiler', 'myhis_irsaliyeler', 'myhis_kumasTurleri'].forEach(k => {
        if (degisiklikler[k]?.delete?.length) hata(403, 'yetki_yok', 'Bu kayıtları silme yetkiniz yok.');
    });
    const partiNoDegisen = {}; const yeniPartiNolari = []; const yeniPartiIdleri = new Set();
    const partiler = degisiklikler.myhis_partiler?.upsert || [];
    partiler.forEach((p, i) => {
        const mevcut = d.veri.myhis_partiler.find(x => x.id === p.id);
        if (mevcut) {
            if (mevcut.kesimhaneId !== f) hata(403, 'yetki_yok', 'Bu parti kesimhanenize ait değil.');
            const yeni = { ...kopya(mevcut), ...sec(p, KESIMHANE_PARTI_ALANLARI) };
            const eski = mevcut.durum || 'kesimde';
            if (yeni.durum !== eski && !(eski === 'kesimde' && yeni.durum === 'dikimde')) { yeni.durum = eski; duzeltildi = true; }
            partiler[i] = yeni;
        } else {
            const urun = d.veri.myhis_urunler.find(u => u.id === p.urunId);
            const no = 'P-' + String(sonrakiNo(d.veri.myhis_partiler, 'partiNo', /^P-(\d+)$/, yeniPartiNolari)).padStart(4, '0');
            yeniPartiNolari.push(no); yeniPartiIdleri.add(p.id);
            if (p.partiNo !== no) partiNoDegisen[p.id] = no;
            partiler[i] = { ...p, partiNo: no, kesimhaneId: f, durum: 'kesimde', arsivde: false, firmaAtamalari: [], olusturanFirmaId: f,
                kesimBirimFiyat: fiyatBul(urun, f, 'kesim'), dikimBirimFiyat: fiyatBul(urun, p.dikimhaneId, 'dikim'), utuBirimFiyat: fiyatBul(urun, p.utupaketciId, 'utu') };
            duzeltildi = true;
        }
    });
    const yil = new Date().getFullYear(); const yeniIrs = [];
    const irsaliyeler = degisiklikler.myhis_irsaliyeler?.upsert || [];
    irsaliyeler.forEach((r, i) => {
        const mevcut = d.veri.myhis_irsaliyeler.find(x => x.id === r.id);
        if (mevcut) {
            if (!irsFirmaya(mevcut, f)) hata(403, 'yetki_yok', 'Bu irsaliye firmanıza ait değil.');
            const yeni = { ...kopya(mevcut), ...sec(r, KESIMHANE_IRSALIYE_ALANLARI) };
            const eski = mevcut.durum || 'taslak'; const istenen = r.durum || eski;
            if (istenen === 'iptal' && eski === 'taslak') { yeni.durum = 'iptal'; if (r.iptalTarihi) yeni.iptalTarihi = r.iptalTarihi; }
            else if (istenen !== eski) duzeltildi = true;
            irsaliyeler[i] = yeni;
        } else {
            if (!irsFirmaya(r, f)) hata(403, 'yetki_yok', 'Sadece kendi firmanızın irsaliyesini oluşturabilirsiniz.');
            if (r.partiId && !yeniPartiIdleri.has(r.partiId)) {
                const parti = d.veri.myhis_partiler.find(x => x.id === r.partiId);
                if (!parti || parti.kesimhaneId !== f) hata(403, 'yetki_yok', 'Bu parti kesimhanenize ait değil.');
            }
            const no = `IRS-${yil}-` + String(sonrakiNo(d.veri.myhis_irsaliyeler, 'irsaliyeNo', new RegExp(`^IRS-${yil}-(\\d+)$`), yeniIrs)).padStart(4, '0');
            yeniIrs.push(no);
            const yeni = { ...r, irsaliyeNo: no, durum: 'taslak', olusturanFirmaId: f };
            delete yeni.onayTarihi;
            if (r.partiId && partiNoDegisen[r.partiId]) yeni.partiNo = partiNoDegisen[r.partiId];
            if (r.irsaliyeNo !== no || r.durum !== 'taslak') duzeltildi = true;
            irsaliyeler[i] = yeni;
        }
    });
    (degisiklikler.myhis_kumasStok?.upsert || []).forEach((k, i, dizi) => {
        const mevcut = d.veri.myhis_kumasStok.find(x => x.id === k.id);
        if (mevcut && mevcut.kesimhaneId !== f) hata(403, 'yetki_yok', 'Bu kumaş kaydı kesimhanenize ait değil.');
        if (k.kesimhaneId !== f) duzeltildi = true;
        const yeni = { ...k, kesimhaneId: f, kesimhaneAdi: firma?.ad || '' };
        KESIMHANE_KUMAS_GIZLI.forEach(a => { if (mevcut && a in mevcut) yeni[a] = mevcut[a]; else delete yeni[a]; });
        const borc = kumasBagliBorc(d, mevcut);
        if (borc) {
            const tutar = Math.round((parseFloat(yeni.miktar) || 0) * (parseFloat(mevcut.birimFiyat) || 0) * 100) / 100;
            if (Math.abs(tutar - (borc.tutar || 0)) > 0.001) {
                (degisiklikler.myhis_cariHareketler ||= { upsert: [] }).upsert ||= [];
                degisiklikler.myhis_cariHareketler.upsert.push({ ...kopya(borc), tutar, miktar: parseFloat(yeni.miktar) || 0 });
                yeni.tutar = tutar;
            }
        }
        dizi[i] = yeni;
    });
    (degisiklikler.myhis_kumasStok?.delete || []).forEach(id => {
        const mevcut = d.veri.myhis_kumasStok.find(x => x.id === id);
        if (mevcut && mevcut.kesimhaneId !== f) hata(403, 'yetki_yok', 'Bu kumaş kaydı kesimhanenize ait değil.');
        const borc = kumasBagliBorc(d, mevcut);
        if (borc) {
            (degisiklikler.myhis_cariHareketler ||= {}).delete ||= [];
            degisiklikler.myhis_cariHareketler.delete.push(borc.id);
        }
    });
    return duzeltildi;
}
