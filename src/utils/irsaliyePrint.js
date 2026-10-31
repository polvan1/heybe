// Ortak irsaliye yazdırma — MY HİS kesim/sevk irsaliyesi: A4'e alt alta iki A5 (atölye + ütü paket nüshası).
// Hem İrsaliyeler sayfası (kayıtlı irsaliye) hem Partiler'deki hızlı yazdırma bu şablonu kullanır.
// Parti verilirse kesim tarihi, kritikler, ütü/paketçi ve çıkan adetler de forma yazılır.
import QRCode from 'qrcode';
import { IRSALIYE_TIP_LABELS } from '../data/db';
import { belgeAc } from './belgeGoster';
import { kesimFormuSayfasi, kesimFormuBelgesi, formLogoUrl } from './kesimFormu';

// boyut eski çağrılar için kabul edilir; çıktı her zaman A4'e iki A5 nüshadır
export async function yazdirIrsaliye(irsaliye, boyut = 'A4', { parti = null, firmalar = [] } = {}) { // eslint-disable-line no-unused-vars
    const firmaAdi = (id) => (id ? firmalar.find(f => f.id === id)?.ad || '' : '');
    const tipEtiketi = irsaliye.tipLabel || IRSALIYE_TIP_LABELS[irsaliye.tip] || 'Sevkiyat';
    const dikimdenUtuye = irsaliye.tip === 'dikimhane_utupaketci';

    // QR: telefonla okutunca uygulamada ilgili parti açılır
    let qr = '';
    const partiId = irsaliye.partiId || parti?.id;
    if (partiId) {
        try {
            qr = await QRCode.toDataURL(new URL(`#/parti/${partiId}`, window.location.href).href, { margin: 0, width: 160 });
        } catch (e) { /* QR üretilemezse irsaliye QR'sız basılır */ }
    }

    let renkler = (irsaliye.renkler?.length ? irsaliye.renkler : parti?.renkler) || [];
    // Renk/beden girilmemiş partide (ör. defterden aktarılan) toplam adet tek satırda görünür
    if (!renkler.length && irsaliye.toplamAdet) renkler = [{ renk: '—', bedenAdetleri: {}, toplam: irsaliye.toplamAdet }];

    const sayfa = kesimFormuSayfasi({
        logoUrl: formLogoUrl(),
        qr,
        no: irsaliye.irsaliyeNo || '',
        tipEtiketi,
        partiNo: irsaliye.partiNo || parti?.partiNo || '',
        kesimTarihi: parti?.kesimTarihi || parti?.createdAt || irsaliye.tarih,
        cikisTarihi: irsaliye.tarih || new Date().toISOString(),
        kesimhaneAdi: dikimdenUtuye ? firmaAdi(parti?.kesimhaneId) : (irsaliye.gonderenFirmaAdi || firmaAdi(parti?.kesimhaneId)),
        siparisVeren: parti?.siparisVeren || '',
        modelKodu: irsaliye.urunKodu || parti?.urunKodu,
        modelAdi: irsaliye.urunAdi || parti?.urunAdi,
        atolyeAdi: dikimdenUtuye ? irsaliye.gonderenFirmaAdi : (irsaliye.alanFirmaAdi || firmaAdi(parti?.dikimhaneId)),
        atolyedenCikan: parti?.dikimdenCikanAdet || (dikimdenUtuye ? irsaliye.toplamAdet : ''),
        atolyedenCikmaTarihi: parti?.dikimBitisTarihi,
        asorti: irsaliye.asorti || parti?.asorti,
        renkler,
        dikimKritik: parti?.dikimNotu || '',
        utuPaketci: dikimdenUtuye ? irsaliye.alanFirmaAdi : firmaAdi(parti?.utupaketciId),
        utudenCikan: parti?.durum === 'tamamlandi' ? parti.sonCikanAdet : '',
        not: irsaliye.notlar || '',
    });
    const baslik = `İrsaliye ${irsaliye.irsaliyeNo || irsaliye.partiNo || ''}`.trim();
    belgeAc(kesimFormuBelgesi([sayfa], { baslik }), { baslik });
}
