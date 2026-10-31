// Kesimhanelerin ELLE dolduracağı boş MY HİS kesim/sevk irsaliyesi — A4'e iki A5 nüsha (atölye + ütü paket).
// Doldurulan form (bu şablon ya da eski basılı MY HİS formu) telefonla fotoğraflanıp
// "Formu Okut" ile sisteme irsaliye olarak girilir; yapay zekâ renk × beden tablosunu okur.
import { belgeAc } from './belgeGoster';
import { kesimFormuSayfasi, kesimFormuBelgesi, formLogoUrl } from './kesimFormu';

export const SABLON_KODU = 'MY HİS kesim formu';

// kopya: kaç A4 sayfa basılacak (her sayfada atölye + ütü paket nüshası)
export function yazdirBosSevkSablonu({ kesimhaneAdi = '', atolyeAdi = '', kopya = 1 } = {}) {
    const adet = Math.min(Math.max(parseInt(kopya, 10) || 1, 1), 20);
    const sayfa = kesimFormuSayfasi({ logoUrl: formLogoUrl(), kesimhaneAdi, atolyeAdi }, { bos: true });
    const baslik = 'Boş İrsaliye — A4\'e 2 nüsha';
    belgeAc(kesimFormuBelgesi(Array.from({ length: adet }, () => sayfa), { baslik }), { baslik });
}
