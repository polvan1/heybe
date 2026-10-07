// HİS ERP - DEMO örnek verisi
// Tamamen kurgusal firmalar, ürünler ve partiler (gerçek müşteri verisi DEĞİLDİR).
// Tarihler bugüne göre üretilir; böylece demo her açıldığında güncel görünür.

const GUN = 24 * 60 * 60 * 1000;
const tarih = (gunOnce, saat = 10) => {
    const d = new Date(Date.now() - gunOnce * GUN);
    d.setHours(saat, 15, 0, 0);
    return d.toISOString();
};
let sayac = 0;
const id = (onEk) => `${onEk}${(++sayac).toString(36).padStart(3, '0')}demo`;

const FIRMALAR = [
    { ad: 'Yıldız Kesim', lat: 41.0089, lng: 28.8917, tip: 'kesimhane', yetkiliKisi: 'Murat Yıldız', adres: 'Merter, İstanbul', gunlukKapasite: 3000, odemeVadesi: 10 },
    { ad: 'Doğan Kesimhane', lat: 41.0225, lng: 28.8722, tip: 'kesimhane', yetkiliKisi: 'Selim Doğan', adres: 'Güngören, İstanbul', gunlukKapasite: 2500, odemeVadesi: 15 },
    { ad: 'Akın Konfeksiyon', lat: 41.0386, lng: 28.8564, tip: 'atolye', yetkiliKisi: 'Hasan Akın', adres: 'Bağcılar, İstanbul', gunlukKapasite: 600, odemeVadesi: 20 },
    { ad: 'Güneş Tekstil Atölyesi', lat: 41.0433, lng: 28.8761, tip: 'atolye', yetkiliKisi: 'Ayşe Güneş', adres: 'Esenler, İstanbul', gunlukKapasite: 450, odemeVadesi: 25 },
    { ad: 'Ece Dikim Evi', lat: 40.9947, lng: 28.9044, tip: 'atolye', yetkiliKisi: 'Ece Kara', adres: 'Zeytinburnu, İstanbul', gunlukKapasite: 350, odemeVadesi: 5 },
    { ad: 'Kaya Atölye', tip: 'atolye', yetkiliKisi: 'Emre Kaya', adres: 'Sultangazi, İstanbul', gunlukKapasite: 500, odemeVadesi: 30 },
    { ad: 'Bulut Ütü-Paket', lat: 41.0461, lng: 28.9006, tip: 'utupaketci', yetkiliKisi: 'Kemal Bulut', adres: 'Bayrampaşa, İstanbul', gunlukKapasite: 1500, odemeVadesi: 10 },
    { ad: 'Nur Paketleme', lat: 41.0181, lng: 28.88, tip: 'utupaketci', yetkiliKisi: 'Nurten Şahin', adres: 'Güngören, İstanbul', gunlukKapasite: 1200, odemeVadesi: 20 },
    { ad: 'Renk Baskı', lat: 41.012, lng: 28.887, tip: 'baskici', yetkiliKisi: 'Okan Renk', adres: 'Merter, İstanbul', gunlukKapasite: 2000, odemeVadesi: 15 },
];

const URUNLER = [
    { urunKodu: 'HS-1021', urunAdi: 'Basic Bisiklet Yaka Tişört', bedenler: 'S,M,L,XL', dagilim: { S: 1, M: 2, L: 2, XL: 1 }, kesimFiyat: 3.5, dikimFiyat: 14, utuFiyat: 3 },
    { urunKodu: 'HS-1034', urunAdi: 'Oversize Pamuk Sweatshirt', bedenler: 'S,M,L,XL', dagilim: { S: 1, M: 1, L: 1, XL: 1 }, kesimFiyat: 5, dikimFiyat: 32, utuFiyat: 4.5 },
    { urunKodu: 'HS-2008', urunAdi: 'Kadın Viskon Uzun Elbise', bedenler: 'XS,S,M,L', dagilim: { XS: 1, S: 2, M: 2, L: 1 }, kesimFiyat: 4.5, dikimFiyat: 48, utuFiyat: 5 },
    { urunKodu: 'HS-2015', urunAdi: 'Halter Yaka Atlet', bedenler: 'S,M,L', dagilim: { S: 1, M: 1, L: 1 }, kesimFiyat: 2.5, dikimFiyat: 11, utuFiyat: 2.5 },
    { urunKodu: 'HS-3002', urunAdi: 'Çocuk Eşofman Takımı', bedenler: '4,6,8,10', dagilim: { 4: 1, 6: 1, 8: 1, 10: 1 }, kesimFiyat: 6, dikimFiyat: 38, utuFiyat: 5 },
    { urunKodu: 'HS-3017', urunAdi: 'Polo Yaka Pike Tişört', bedenler: 'S,M,L,XL,2XL', dagilim: { S: 1, M: 2, L: 2, XL: 1, '2XL': 1 }, kesimFiyat: 4, dikimFiyat: 22, utuFiyat: 3.5 },
    { urunKodu: 'HS-4004', urunAdi: 'Keten Gömlek', bedenler: 'S,M,L,XL', dagilim: { S: 1, M: 2, L: 2, XL: 1 }, kesimFiyat: 5.5, dikimFiyat: 40, utuFiyat: 6 },
    { urunKodu: 'HS-4011', urunAdi: 'Kapüşonlu Fermuarlı Hırka', bedenler: 'S,M,L,XL', dagilim: { S: 1, M: 1, L: 1, XL: 1 }, kesimFiyat: 6.5, dikimFiyat: 45, utuFiyat: 5 },
];

// [ürün index, renkler: [renk, kat sayısı], durum, kaç gün önce açıldı, kesimhane, atölye, ütücü, fire oranı]
const PARTILER = [
    [0, [['Beyaz', 120], ['Siyah', 100], ['Lacivert', 80]], 'tamamlandi', 34, 0, 2, 6, 0.01],
    [3, [['Siyah', 300], ['Ekru', 250]], 'tamamlandi', 27, 1, 3, 7, 0.02],
    [1, [['Antrasit', 150], ['Bej', 120]], 'tamamlandi', 21, 0, 5, 6, 0.015],
    [2, [['Haki', 90], ['Bordo', 70]], 'utupakette', 15, 1, 2, 7, 0.02],
    [5, [['Beyaz', 110], ['Lacivert', 90], ['Yeşil', 60]], 'utupakette', 12, 0, 4, 6, 0.01],
    [6, [['Beyaz', 80], ['Mavi', 70]], 'dikimde', 9, 1, 2, 6, 0],
    [4, [['Gri', 140], ['Lacivert', 120]], 'dikimde', 7, 0, 3, 7, 0],
    [7, [['Siyah', 100], ['Gri', 100]], 'dikimde', 5, 1, 5, 6, 0],
    [0, [['Pembe', 90], ['Mint', 90], ['Sarı', 60]], 'kesimde', 2, 0, 4, 7, 0],
    [3, [['Beyaz', 200], ['Siyah', 200]], 'kesimde', 1, 1, 2, 6, 0],
];

const DURUM_ETIKET = { kesimde: 'Kesimde', dikimde: 'Dikimde', utupakette: 'Ütü/Paket', tamamlandi: 'Tamamlandı' };

export function demoVerisiOlustur() {
    sayac = 0;
    const firmalar = FIRMALAR.map((f, i) => ({
        id: id('frm'), ...f, telefon: `0532 000 00 ${String(i + 10)}`, email: '', notlar: '',
        aktif: true, createdAt: tarih(60),
    }));

    const urunler = URUNLER.map(u => {
        const bedenler = u.bedenler.split(',');
        return {
            id: id('urn'), urunKodu: u.urunKodu, urunAdi: u.urunAdi, bedenler: u.bedenler,
            asorti: { bedenler, dagilim: u.dagilim },
            kesimFiyat: u.kesimFiyat, dikimFiyat: u.dikimFiyat, utuFiyat: u.utuFiyat,
            firmaFiyatlari: {}, stokAdet: 0, aktif: true, createdAt: tarih(55),
        };
    });
    // Örnek firma bazlı fiyat anlaşması: Ece Dikim Evi tişörtü daha ucuza dikiyor
    urunler[0].firmaFiyatlari = { [firmalar[4].id]: { dikim: 12.5 } };

    const partiler = [], cari = [], irsaliyeler = [], bildirimler = [], gunluk = [];
    const kesimhaneler = firmalar.filter(f => f.tip === 'kesimhane');

    PARTILER.forEach(([ui, renkler, durum, gunOnce, ki, ai, ti, fireOrani], n) => {
        const urun = urunler[ui];
        const { bedenler, dagilim } = urun.asorti;
        const renkSatirlari = renkler.map(([renk, kat]) => {
            const bedenAdetleri = Object.fromEntries(bedenler.map(b => [b, kat * (dagilim[b] || 0)]));
            return { renk, katSayisi: kat, bedenAdetleri, toplam: Object.values(bedenAdetleri).reduce((a, b) => a + b, 0) };
        });
        const toplam = renkSatirlari.reduce((a, r) => a + r.toplam, 0);
        const kesimhane = kesimhaneler[ki], atolye = firmalar[ai], utucu = firmalar[ti];
        const partiNo = 'P-' + String(n + 1).padStart(4, '0');
        const pid = id('prt');
        const siraIndex = ['kesimde', 'dikimde', 'utupakette', 'tamamlandi'].indexOf(durum);
        const dikimdenCikan = Math.round(toplam * (1 - fireOrani));

        const gecmis = [];
        const adimlar = [['kesimde', 'dikimde', toplam, toplam], ['dikimde', 'utupakette', toplam, dikimdenCikan], ['utupakette', 'tamamlandi', dikimdenCikan, dikimdenCikan]];
        adimlar.slice(0, siraIndex).forEach(([a, b, giren, cikan], i) => {
            gecmis.push({
                id: id('tsl'), tarih: tarih(gunOnce - (i + 1) * 3, 16), firmaAdi: 'Sistem (İlerletme)',
                adim: `${DURUM_ETIKET[a]} → ${DURUM_ETIKET[b]}`, girenAdet: giren, cikanAdet: cikan, fire: giren - cikan,
            });
        });

        const parti = {
            id: pid, partiNo, urunId: urun.id, urunKodu: urun.urunKodu, urunAdi: urun.urunAdi,
            toplamAdet: toplam, kalanAdet: siraIndex >= 1 ? 0 : toplam, renkler: renkSatirlari, asorti: urun.asorti,
            durum, kesimhaneId: kesimhane.id, dikimhaneId: atolye.id, utupaketciId: utucu.id,
            kesimBirimFiyat: urun.kesimFiyat,
            dikimBirimFiyat: urun.firmaFiyatlari?.[atolye.id]?.dikim || urun.dikimFiyat,
            utuBirimFiyat: urun.utuFiyat,
            firmaAtamalari: [], teslimatGecmisi: gecmis, fotolar: [], notlar: '', arsivde: false,
            createdAt: tarih(gunOnce), updatedAt: tarih(Math.max(gunOnce - siraIndex * 3, 0)),
        };
        if (siraIndex >= 1) parti.dikimBaslamaTarihi = tarih(gunOnce - 3);
        if (siraIndex >= 2) { parti.dikimBitisTarihi = tarih(gunOnce - 6); parti.dikimdenCikanAdet = dikimdenCikan; }
        if (siraIndex >= 1) parti.sonCikanAdet = gecmis[gecmis.length - 1].cikanAdet;
        partiler.push(parti);

        const irsaliyeOrtak = { partiId: pid, partiNo, urunKodu: urun.urunKodu, urunAdi: urun.urunAdi, renkler: renkSatirlari, asorti: urun.asorti };
        irsaliyeler.push({
            id: id('irs'), irsaliyeNo: 'IRS-' + String(irsaliyeler.length + 1).padStart(4, '0'), ...irsaliyeOrtak,
            toplamAdet: toplam, tip: 'kesimhane_dikimhane', durum: siraIndex >= 1 ? 'teslim_edildi' : 'taslak',
            gonderenFirmaId: kesimhane.id, gonderenFirmaAdi: kesimhane.ad, gonderenTel: kesimhane.telefon, gonderenAdres: kesimhane.adres,
            alanFirmaId: atolye.id, alanFirmaAdi: atolye.ad, alanTel: atolye.telefon, alanAdres: atolye.adres,
            notlar: `${partiNo} partisi oluşturulduğunda otomatik düzenlendi.`,
            tarih: tarih(gunOnce), createdAt: tarih(gunOnce), updatedAt: tarih(gunOnce),
            ...(siraIndex >= 1 ? { onayTarihi: tarih(gunOnce - 1), teslimTarihi: tarih(gunOnce - 3) } : {}),
        });
        if (siraIndex >= 2) {
            irsaliyeler.push({
                id: id('irs'), irsaliyeNo: 'IRS-' + String(irsaliyeler.length + 1).padStart(4, '0'), ...irsaliyeOrtak,
                toplamAdet: dikimdenCikan, tip: 'dikimhane_utupaketci', durum: siraIndex >= 3 ? 'teslim_edildi' : 'onaylandi',
                gonderenFirmaId: atolye.id, gonderenFirmaAdi: atolye.ad, gonderenTel: atolye.telefon, gonderenAdres: atolye.adres,
                alanFirmaId: utucu.id, alanFirmaAdi: utucu.ad, alanTel: utucu.telefon, alanAdres: utucu.adres,
                notlar: `${partiNo} dikimden çıktığında otomatik düzenlendi (${dikimdenCikan} adet).`,
                tarih: tarih(gunOnce - 6), createdAt: tarih(gunOnce - 6), updatedAt: tarih(gunOnce - 6), onayTarihi: tarih(gunOnce - 6),
                ...(siraIndex >= 3 ? { teslimTarihi: tarih(gunOnce - 8) } : {}),
            });
        }

        if (durum === 'tamamlandi') {
            [[kesimhane, parti.kesimBirimFiyat, 'Kesim'], [atolye, parti.dikimBirimFiyat, 'Dikim'], [utucu, parti.utuBirimFiyat, 'Ütü/Paket']]
                .forEach(([firma, fiyat, rol]) => {
                    cari.push({
                        id: id('car'), firmaId: firma.id, partiId: pid, tip: 'borc', tutar: Math.round(dikimdenCikan * fiyat * 100) / 100,
                        aciklama: `${partiNo} - ${urun.urunAdi} [${rol}] (${dikimdenCikan} ad × ${fiyat} TL)`,
                        tarih: tarih(gunOnce - 9), hesaplandi: false, createdAt: tarih(gunOnce - 9),
                    });
                });
            urun.stokAdet += dikimdenCikan;
            bildirimler.push({ id: id('bld'), tip: 'parti', baslik: `${partiNo} Tamamlandı!`, mesaj: `${urun.urunAdi} — ${dikimdenCikan} adet ile üretim tamamlandı`, link: `/parti/${pid}`, okundu: gunOnce > 25, tarih: tarih(gunOnce - 9, 17) });
        }
        gunluk.push({ id: id('lg'), tarih: tarih(gunOnce), kullaniciAd: 'Demo Yönetici', kullaniciId: 'usr_demo_admin', islem: 'Parti Oluşturuldu', detay: `${partiNo} — ${urun.urunAdi} (${toplam} adet)` });
    });

    // Ödemeler (alacak = firmaya yapılan ödeme)
    const odeme = (firma, tutar, gunOnce, aciklama) => cari.push({
        id: id('car'), firmaId: firma.id, partiId: null, tip: 'alacak', tutar, aciklama, tarih: tarih(gunOnce), hesaplandi: false, createdAt: tarih(gunOnce),
    });
    odeme(firmalar[2], 7500, 20, 'Havale ödemesi');
    odeme(firmalar[0], 1500, 18, 'Nakit ödeme');
    odeme(firmalar[3], 6000, 12, 'Havale ödemesi');

    bildirimler.push(
        { id: id('bld'), tip: 'irsaliye', baslik: 'İrsaliye teslim alındı', mesaj: 'P-0005 — Bulut Ütü-Paket teslim aldı', link: '/irsaliyeler', okundu: false, tarih: tarih(4, 15) },
        { id: id('bld'), tip: 'teslim_talebi', baslik: 'Teslim Bildirimi: P-0006', mesaj: 'Akın Konfeksiyon — 290 adet çıkış bildirdi. Onay için partiyi ilerletin.', link: `/parti/${partiler[5].id}`, okundu: false, tarih: tarih(0, 9) },
    );
    bildirimler.sort((a, b) => b.tarih.localeCompare(a.tarih));
    gunluk.sort((a, b) => b.tarih.localeCompare(a.tarih));

    const kumasTurleri = [
        { id: id('kt'), ad: 'Süprem 30/1', birim: 'kg', createdAt: tarih(50) },
        { id: id('kt'), ad: 'Ribana 2x1', birim: 'kg', createdAt: tarih(50) },
        { id: id('kt'), ad: 'İki İplik Şardonlu', birim: 'kg', createdAt: tarih(50) },
        { id: id('kt'), ad: 'Viskon Penye', birim: 'kg', createdAt: tarih(50) },
    ];
    const kumasStok = [
        { id: id('ks'), kumasAdi: 'Süprem 30/1', renk: 'Pembe', miktar: 186.4, topAdedi: 8, birim: 'kg', gelenFirmaId: firmalar[0].id, gelenFirmaAdi: firmalar[0].ad, partiId: partiler[8].id, partiNo: 'P-0009', referansNo: 'KMS-55120', notlar: '', tarih: tarih(3), createdAt: tarih(3) },
        { id: id('ks'), kumasAdi: 'Ribana 2x1', renk: 'Beyaz', miktar: 92, topAdedi: 4, birim: 'kg', gelenFirmaId: firmalar[1].id, gelenFirmaAdi: firmalar[1].ad, partiId: partiler[9].id, partiNo: 'P-0010', referansNo: 'KMS-55134', notlar: '', tarih: tarih(1), createdAt: tarih(1) },
    ];

    return {
        // Sevkiyat aracının çıkış noktası (demo)
        merkez: { ad: 'HİS Merkez (Merter)', lat: 41.0105, lng: 28.895 },
        myhis_firmalar: firmalar,
        myhis_urunler: urunler,
        myhis_partiler: partiler,
        myhis_cariHareketler: cari,
        myhis_isAkisi: [],
        myhis_bildirimler: bildirimler,
        myhis_stoklar: [],
        myhis_stokHareketleri: [],
        myhis_irsaliyeler: irsaliyeler,
        myhis_islemGunlugu: gunluk,
        myhis_kumasStok: kumasStok,
        myhis_kumasTurleri: kumasTurleri,
        myhis_araclar: [
            { id: 'arc_demo_1', ad: 'Kamyonet 1', plaka: '34 HIS 101', soforId: 'usr_demo_sofor1', aktif: true, createdAt: tarih(30) },
            { id: 'arc_demo_2', ad: 'Kamyonet 2', plaka: '34 HIS 102', soforId: 'usr_demo_sofor2', aktif: true, createdAt: tarih(30) },
        ],
        myhis_seferler: [],
        kullanicilar: [
            { id: 'usr_demo_admin', ad: 'Demo Yönetici', email: 'demo@hiserp.app', telefon: '', rol: 'admin', yetkiler: ['anasayfa', 'islerim', 'partiler', 'is_akisi', 'takvim', 'urunler', 'stok_takibi', 'firmalar', 'cari_hesaplar', 'irsaliyeler', 'harita', 'gorevlerim', 'raporlar', 'kullanicilar', 'ayarlar'], aktif: true, firmaId: null, sifre: 'demo123', createdAt: tarih(60) },
            { id: 'usr_demo_sofor1', ad: 'Şoför Ali', email: 'sofor@hiserp.app', telefon: '', rol: 'sofor', yetkiler: ['gorevlerim'], aktif: true, firmaId: null, sifre: 'demo123', createdAt: tarih(30) },
            { id: 'usr_demo_sofor2', ad: 'Şoför Veli', email: 'sofor2@hiserp.app', telefon: '', rol: 'sofor', yetkiler: ['gorevlerim'], aktif: true, firmaId: null, sifre: 'demo123', createdAt: tarih(30) },
            { id: 'usr_demo_fason', ad: 'Akın Konfeksiyon', email: 'fasoncu@hiserp.app', telefon: '', rol: 'fasoncu', yetkiler: ['islerim'], aktif: true, firmaId: firmalar[2].id, sifre: 'demo123', createdAt: tarih(40) },
        ],
    };
}
