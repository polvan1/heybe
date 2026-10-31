// Yazdırılacak belgeleri (irsaliye, etiket, rapor, ekstre) UYGULAMANIN İÇİNDE gösterir.
// Eskiden window.open ile yeni pencere açılıyordu; telefona yüklenen uygulamada (PWA) o pencerenin
// geri/kapat düğmesi olmadığından uygulamayı kapatmadan çıkılamıyordu. Artık belge tam ekran bir
// katmanda açılır: üstte "Geri" ve "Yazdır"; Android geri tuşu ve Esc de kapatır.

let kapatAcik = null;

export function belgeKapat() {
    if (kapatAcik) kapatAcik();
}

// html: tam belge (<html>…</html>). Belgedeki kendi yazdırma/kapatma betikleri çıkarılır;
// yazdırma bu katmandan yapılır (otomatikYazdir: açılınca bir kez yazdırma penceresi gelir).
export function belgeAc(html, { baslik = 'Belge', otomatikYazdir = true } = {}) {
    belgeKapat();
    const temiz = String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

    const kok = document.createElement('div');
    kok.className = 'belge-katman';
    kok.setAttribute('role', 'dialog');
    kok.setAttribute('aria-modal', 'true');
    kok.setAttribute('aria-label', baslik);
    kok.innerHTML = `
        <div class="belge-ust">
            <button type="button" class="belge-dugme belge-geri" aria-label="Geri dön">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
                <span>Geri</span>
            </button>
            <span class="belge-baslik"></span>
            <button type="button" class="belge-dugme belge-yazdir">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <span>Yazdır</span>
            </button>
        </div>
        <iframe class="belge-cerceve"></iframe>`;
    kok.querySelector('.belge-baslik').textContent = baslik;
    const cerceve = kok.querySelector('iframe');
    cerceve.title = baslik;

    const yazdir = () => {
        try {
            cerceve.contentWindow.focus();
            cerceve.contentWindow.print();
        } catch (e) {
            alert('Yazdırma başlatılamadı: ' + e.message);
        }
    };

    // Telefonun geri tuşu: katman açılınca geçmişe bir adım eklenir, geri gelince katman kapanır
    let gecmisEklendi = false;
    try { history.pushState({ hisBelge: true }, ''); gecmisEklendi = true; } catch (e) { /* geçmiş kullanılamıyor */ }
    const geriTusu = () => kapat(false);
    const klavye = (e) => { if (e.key === 'Escape') kapat(); };

    function kapat(geriAl = true) {
        window.removeEventListener('popstate', geriTusu);
        document.removeEventListener('keydown', klavye);
        kok.remove();
        document.body.classList.remove('belge-acik');
        kapatAcik = null;
        if (geriAl && gecmisEklendi && history.state?.hisBelge) history.back();
    }

    kok.querySelector('.belge-geri').addEventListener('click', () => kapat());
    kok.querySelector('.belge-yazdir').addEventListener('click', yazdir);
    window.addEventListener('popstate', geriTusu);
    document.addEventListener('keydown', klavye);
    if (otomatikYazdir) cerceve.addEventListener('load', () => setTimeout(yazdir, 350), { once: true });

    document.body.appendChild(kok);
    document.body.classList.add('belge-acik');
    cerceve.srcdoc = temiz;
    kapatAcik = kapat;
    kok.querySelector('.belge-geri').focus();
}

// Dosya kaydetme (Excel, PDF, yedek): telefona yüklenen uygulamada indirme bağlantısı dosyayı
// uygulamanın içinde, geri düğmesi olmayan bir görüntüleyicide açabiliyor. Orada paylaşım menüsü
// kullanılır (Dosyalar'a kaydet, WhatsApp, yazdır…); bilgisayarda normal indirme yapılır.
export const uygulamaModu = () => {
    try {
        return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    } catch (e) { return false; }
};

export async function dosyaKaydet(blob, dosyaAdi, { baslik } = {}) {
    if (uygulamaModu() && typeof File !== 'undefined' && navigator.canShare) {
        const dosya = new File([blob], dosyaAdi, { type: blob.type || 'application/octet-stream' });
        if (navigator.canShare({ files: [dosya] })) {
            try {
                await navigator.share({ files: [dosya], title: baslik || dosyaAdi });
                return 'paylasildi';
            } catch (e) {
                if (e.name === 'AbortError') return 'iptal';
            }
        }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = dosyaAdi;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return 'indirildi';
}
