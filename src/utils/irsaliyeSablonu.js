// Kesimhanelerin ELLE dolduracağı boş MY HİS kesim/sevk formu (yatay A4) — kâğıt formla aynı düzen.
// Doldurulan form (bu şablon ya da eski basılı MY HİS formu) telefonla fotoğraflanıp
// "Formu Okut" ile sisteme irsaliye olarak girilir; yapay zekâ renk × beden tablosunu okur.
import { belgeAc } from './belgeGoster';
import { kesimFormuSayfasi, kesimFormuBelgesi, formLogoUrl } from './kesimFormu';

export const SABLON_KODU = 'MY HİS kesim formu';

// kopya: kaç sayfa basılacak (her sayfa ayrı form)
export function yazdirBosSevkSablonu({ kesimhaneAdi = '', atolyeAdi = '', kopya = 1 } = {}) {
    const adet = Math.min(Math.max(parseInt(kopya, 10) || 1, 1), 20);
    const sayfa = kesimFormuSayfasi({ logoUrl: formLogoUrl(), kesimhaneAdi, atolyeAdi }, { bos: true });
    const baslik = 'Kesim Formu — Boş Şablon';
    belgeAc(kesimFormuBelgesi(Array.from({ length: adet }, () => sayfa), { baslik }), { baslik });
}
