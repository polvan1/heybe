// Atölye kapasitesi: geçmiş işlerden öğrenilen günlük üretim ve eldeki iş yükü

// Tamamlanan atamalardan ürün bazlı günlük kapasite hesapla
export function calculateLearnedCapacities(firmalar, partiler) {
    // { firmaId: { urunId: { totalPieces, totalDays, count } } }
    const history = {};

    partiler.forEach(parti => {
        const urunId = parti.urunId || 'unknown';
        const firmaId = parti.dikimhaneId;

        // YENİ SİSTEM: parti üzerindeki dikimBaslamaTarihi ve dikimBitisTarihi
        if (parti.dikimBaslamaTarihi && parti.dikimBitisTarihi && firmaId) {
            const cikanAdet = parti.dikimdenCikanAdet || parti.toplamAdet;
            
            if (cikanAdet > 0) {
                const start = new Date(parti.dikimBaslamaTarihi);
                const end = new Date(parti.dikimBitisTarihi);
                const diffMs = end - start;
                const diffDays = Math.max(diffMs / (1000 * 60 * 60 * 24), 0.5); // En az yarım gün

                if (!history[firmaId]) history[firmaId] = {};
                if (!history[firmaId][urunId]) {
                    history[firmaId][urunId] = { totalPieces: 0, totalDays: 0, count: 0, records: [] };
                }

                const dailyRate = cikanAdet / diffDays;

                history[firmaId][urunId].totalPieces += cikanAdet;
                history[firmaId][urunId].totalDays += diffDays;
                history[firmaId][urunId].count += 1;
                history[firmaId][urunId].records.push({
                    partiNo: parti.partiNo,
                    urunAdi: parti.urunAdi,
                    adet: cikanAdet,
                    gun: Math.round(diffDays * 10) / 10,
                    gunlukUretim: Math.round(dailyRate),
                });
                return; // Yeni sistemde veri bulunduysa eski sisteme bakmaya gerek yok
            }
        }

        // ESKİ SİSTEM: firmaAtamalari dizisi (Geçmiş verilerin kaybolmaması için destek)
        if (!parti.firmaAtamalari) return;

        parti.firmaAtamalari.forEach(atama => {
            if (!atama.tamamlandi || !atama.tamamlanmaTarihi || !atama.tarih) return;
            // Sadece dikim adımındaki atamaları say
            if (atama.adim !== 'dikimde') return;

            const eqFirmaId = atama.firmaId;
            const cikanAdet = atama.cikanAdet || 0;

            if (cikanAdet <= 0 || !eqFirmaId) return;

            const start = new Date(atama.tarih);
            const end = new Date(atama.tamamlanmaTarihi);
            const diffMs = end - start;
            const diffDays = Math.max(diffMs / (1000 * 60 * 60 * 24), 0.5); // En az yarım gün

            if (!history[eqFirmaId]) history[eqFirmaId] = {};
            if (!history[eqFirmaId][urunId]) {
                history[eqFirmaId][urunId] = { totalPieces: 0, totalDays: 0, count: 0, records: [] };
            }

            const dailyRate = cikanAdet / diffDays;

            history[eqFirmaId][urunId].totalPieces += cikanAdet;
            history[eqFirmaId][urunId].totalDays += diffDays;
            history[eqFirmaId][urunId].count += 1;
            history[eqFirmaId][urunId].records.push({
                partiNo: parti.partiNo,
                urunAdi: parti.urunAdi,
                adet: cikanAdet,
                gun: Math.round(diffDays * 10) / 10,
                gunlukUretim: Math.round(dailyRate),
            });
        });
    });

    return history;
}

// Belirli bir firma + ürün için tahmini günlük kapasite
export function getEstimatedDailyCapacity(firmaId, urunId, history, firmaGunlukKapasite) {
    if (history[firmaId] && history[firmaId][urunId]) {
        const h = history[firmaId][urunId];
        // Toplam üretim / toplam gün = ağırlıklı ortalama
        return {
            kapasite: Math.round(h.totalPieces / h.totalDays),
            kaynak: 'ogrenilmis', // Öğrenilmiş veri
            veriSayisi: h.count,
        };
    }
    // Genel firma kapasitesine düş
    if (firmaGunlukKapasite && firmaGunlukKapasite > 0) {
        return {
            kapasite: firmaGunlukKapasite,
            kaynak: 'varsayilan', // Varsayılan (firma genel)
            veriSayisi: 0,
        };
    }
    return { kapasite: 0, kaynak: 'yok', veriSayisi: 0 };
}

// ---- Atölye yükü ve darboğaz (İş Akışı kanbanı) ----
// Her aşamadaki firma için eldeki iş (adet) ve tahmini gün:
//   kesim: kesilmemiş partilerin planlanan adedi / firmanın günlük kapasitesi
//   dikim: kalan adet / öğrenilmiş (model bazlı) ya da firmanın günlük kapasitesi
//   ütü/paket: kalan adet / günlük kapasite
// Gün eşiği: ≤3 normal, ≤7 yoğun, >7 darboğaz. Kapasite bilinmiyorsa gün hesaplanmaz.
export const YUK_ESIK = { yogun: 3, darbogaz: 7 };
const ASAMA_FIRMA = { kesimde: 'kesimhaneId', dikimde: 'dikimhaneId', utupakette: 'utupaketciId' };

export const partiKalanAdet = (p) => {
    if (p.durum === 'kesimde') return p.kesimDurumu === 'kesildi' ? 0 : (Number(p.toplamAdet) || 0);
    return Number(p.kalanAdet) || Number(p.dikimeGonderilenAdet) || Number(p.kesilenAdet) || Number(p.toplamAdet) || 0;
};

export function yukDurumu(gun) {
    if (gun === null) return 'bilinmiyor';
    if (gun > YUK_ESIK.darbogaz) return 'darbogaz';
    if (gun > YUK_ESIK.yogun) return 'yogun';
    return 'normal';
}

export function atolyeYukleri(partiler, firmalar) {
    const gecmis = calculateLearnedCapacities(firmalar, partiler);
    const yukler = {};
    partiler.filter(p => ASAMA_FIRMA[p.durum] && !p.arsivde).forEach(p => {
        const firmaId = p[ASAMA_FIRMA[p.durum]];
        if (!firmaId) return;
        const adet = partiKalanAdet(p);
        if (!adet) return;
        const firma = firmalar.find(f => f.id === firmaId);
        const anahtar = `${p.durum}|${firmaId}`;
        const y = yukler[anahtar] || (yukler[anahtar] = { anahtar, asama: p.durum, firmaId, ad: firma?.ad || 'Bilinmeyen firma', adet: 0, parti: 0, gun: 0, kapasiteBilinmiyor: false });
        y.adet += adet;
        y.parti += 1;
        const kap = p.durum === 'dikimde'
            ? getEstimatedDailyCapacity(firmaId, p.urunId || 'unknown', gecmis, firma?.gunlukKapasite).kapasite
            : Number(firma?.gunlukKapasite) || 0;
        if (kap > 0) y.gun += adet / kap; else y.kapasiteBilinmiyor = true;
    });
    return Object.values(yukler).map(y => {
        const gun = y.kapasiteBilinmiyor && y.gun === 0 ? null : Math.round(y.gun * 10) / 10;
        return { ...y, gun, durum: yukDurumu(gun) };
    }).sort((a, b) => (b.gun ?? -1) - (a.gun ?? -1));
}
