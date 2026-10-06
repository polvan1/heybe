// Sunucu API ortak yardımcıları.
// Kimlik doğrulama sunucu tarafındaki oturum çereziyle yapılır (HttpOnly);
// kodda hiçbir anahtar veya şifre tutulmaz.
export const API_URL = import.meta.env.BASE_URL + 'api.php';

export class ApiHatasi extends Error {
    constructor(mesaj, durum, kod, veri) {
        super(mesaj);
        this.durum = durum;   // HTTP durum kodu
        this.kod = kod;       // sunucunun hata kodu (örn. 'yetki_yok')
        this.veri = veri;
    }
}

// Oturum düştüğünde (401) uygulama giriş ekranına döner
function oturumDustu() {
    try { window.dispatchEvent(new CustomEvent('myhis:oturum-dustu')); } catch (e) { /* yoksay */ }
}

// sorgu: 'auth=giris' gibi; govde verilirse POST yapılır
export async function apiIstek(sorgu = '', govde, secenekler = {}) {
    // Demo derlemesi: sunucu yerine tarayıcı içi demo sunucusu (normal derlemeye girmez)
    if (import.meta.env.VITE_DEMO === '1') {
        const { demoIstek } = await import('./demoSunucu');
        try {
            return await demoIstek(sorgu, govde);
        } catch (e) {
            if (e instanceof ApiHatasi && e.durum === 401 && !sorgu.startsWith('auth=')) oturumDustu();
            throw e;
        }
    }
    const url = `${API_URL}?${sorgu ? sorgu + '&' : ''}t=${Date.now()}`;
    const post = govde !== undefined;
    const yanit = await fetch(url, {
        method: post ? 'POST' : 'GET',
        credentials: 'same-origin',
        headers: post ? { 'Content-Type': 'application/json', 'X-HisERP': '1' } : {},
        body: post ? JSON.stringify(govde) : undefined,
        keepalive: secenekler.keepalive || false,
    });
    let veri = null;
    try { veri = await yanit.json(); } catch (e) { /* boş/bozuk yanıt */ }
    if (!yanit.ok) {
        if (yanit.status === 401 && !sorgu.startsWith('auth=')) oturumDustu();
        throw new ApiHatasi(veri?.mesaj || `Sunucu hatası (${yanit.status})`, yanit.status, veri?.error, veri);
    }
    return veri;
}
