// Excel (.xlsx) dosyasının ilk sayfasını satır dizisi olarak okur — harici kütüphane yok.
// .xlsx bir ZIP'tir; sıkıştırılmış parçalar tarayıcının DecompressionStream'i ile açılır.
// Dönen değer: [[hücre, hücre, ...], ...] (boş hücre '', sayılar sayı, metinler metin)

async function ac(bayt, yontem) {
    if (yontem === 0) return bayt;
    if (yontem !== 8) throw new Error('Desteklenmeyen sıkıştırma');
    if (typeof DecompressionStream === 'undefined') throw new Error('Tarayıcınız Excel dosyası açmayı desteklemiyor; tarayıcıyı güncelleyin veya CSV kullanın.');
    const akis = new Blob([bayt]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(akis).arrayBuffer());
}

// ZIP içindeki dosyalar: Map(ad → () => Promise<metin>)
function zipIcerigi(tampon) {
    const v = new DataView(tampon);
    const bayt = new Uint8Array(tampon);
    let son = -1;
    for (let i = tampon.byteLength - 22; i >= Math.max(0, tampon.byteLength - 66000); i--) {
        if (v.getUint32(i, true) === 0x06054b50) { son = i; break; }
    }
    if (son < 0) throw new Error('Dosya bir Excel (.xlsx) dosyası değil');
    const adet = v.getUint16(son + 10, true);
    let p = v.getUint32(son + 16, true);
    const dec = new TextDecoder();
    const dosyalar = new Map();
    for (let n = 0; n < adet; n++) {
        if (v.getUint32(p, true) !== 0x02014b50) break;
        const yontem = v.getUint16(p + 10, true);
        const boyut = v.getUint32(p + 20, true);
        const adUz = v.getUint16(p + 28, true), ekUz = v.getUint16(p + 30, true), notUz = v.getUint16(p + 32, true);
        const yerel = v.getUint32(p + 42, true);
        const ad = dec.decode(bayt.subarray(p + 46, p + 46 + adUz));
        const veriBasi = yerel + 30 + v.getUint16(yerel + 26, true) + v.getUint16(yerel + 28, true);
        dosyalar.set(ad, async () => dec.decode(await ac(bayt.subarray(veriBasi, veriBasi + boyut), yontem)));
        p += 46 + adUz + ekUz + notUz;
    }
    return dosyalar;
}

const xml = (metin) => new DOMParser().parseFromString(metin, 'application/xml');
const etiketler = (dugum, ad) => Array.from(dugum.getElementsByTagNameNS('*', ad));

// "AB12" → 27 (0 tabanlı sütun)
function sutunNo(ref) {
    const harf = /^[A-Z]+/.exec(ref || '')?.[0] || '';
    let n = 0;
    for (const h of harf) n = n * 26 + (h.charCodeAt(0) - 64);
    return n - 1;
}

export async function excelOku(dosya) {
    const tampon = await dosya.arrayBuffer();
    const zip = zipIcerigi(tampon);
    const oku = async (ad) => (zip.has(ad) ? zip.get(ad)() : null);

    // İlk sayfanın dosya yolu (workbook.xml → ilişkiler)
    let sayfaYolu = 'xl/worksheets/sheet1.xml';
    const kitap = await oku('xl/workbook.xml');
    const iliski = await oku('xl/_rels/workbook.xml.rels');
    if (kitap && iliski) {
        const ilk = etiketler(xml(kitap), 'sheet')[0];
        const rid = ilk && (ilk.getAttribute('r:id') || ilk.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
        const hedef = etiketler(xml(iliski), 'Relationship').find(r => r.getAttribute('Id') === rid)?.getAttribute('Target');
        if (hedef) sayfaYolu = hedef.startsWith('/') ? hedef.slice(1) : `xl/${hedef.replace(/^\.\//, '')}`;
    }
    const sayfa = await oku(sayfaYolu);
    if (!sayfa) throw new Error('Excel dosyasında sayfa bulunamadı');

    const ortak = await oku('xl/sharedStrings.xml');
    const metinler = ortak
        ? etiketler(xml(ortak), 'si').map(si => etiketler(si, 't')
            .filter(t => t.parentNode?.localName !== 'rPh')   // fonetik okunuşları alma
            .map(t => t.textContent).join(''))
        : [];

    const satirlar = [];
    etiketler(xml(sayfa), 'row').forEach((r, i) => {
        const no = (parseInt(r.getAttribute('r'), 10) || i + 1) - 1;
        const satir = [];
        etiketler(r, 'c').forEach((c, j) => {
            const ref = c.getAttribute('r');
            const sutun = ref ? sutunNo(ref) : j;
            const tip = c.getAttribute('t');
            const v = etiketler(c, 'v')[0]?.textContent ?? '';
            let deger;
            if (tip === 's') deger = metinler[parseInt(v, 10)] ?? '';
            else if (tip === 'inlineStr') deger = etiketler(c, 't').map(t => t.textContent).join('');
            else if (tip === 'str' || tip === 'e') deger = v;
            else if (tip === 'b') deger = v === '1' ? 1 : 0;
            else deger = v === '' ? '' : Number(v);
            satir[sutun] = deger;
        });
        satirlar[no] = Array.from(satir, d => d ?? '');
    });
    return Array.from(satirlar, s => s || []);
}

// "1,50" / "1.50" / 1.5 → 1.5 ; boş veya anlamsız → 0
export function sayiOku(deger) {
    if (typeof deger === 'number') return Number.isFinite(deger) ? deger : 0;
    let s = String(deger ?? '').trim().replace(/[₺\s]|TL/gi, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

// CSV / TXT / Excel'den kopyalanmış metin (; , veya sekme ile ayrılmış) → satırlar
export function metniSatirlaraBol(metin) {
    const satirlar = String(metin).replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!satirlar.length) return [];
    const ilk = satirlar[0];
    const ayrac = ilk.includes('\t') ? '\t' : ilk.includes(';') ? ';' : ',';
    return satirlar.map(l => l.split(ayrac).map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()));
}

// Seçilen dosyayı (xlsx / csv / txt) oku → satırlar
export async function tabloDosyasiOku(dosya) {
    const ad = String(dosya.name || '').toLowerCase();
    if (ad.endsWith('.xls')) throw new Error('Eski Excel biçimi (.xls) okunamıyor. Excel\'de "Farklı Kaydet → Excel Çalışma Kitabı (.xlsx)" ile kaydedip tekrar deneyin.');
    if (ad.endsWith('.xlsx') || ad.endsWith('.xlsm')) return excelOku(dosya);
    return metniSatirlaraBol(await dosya.text());
}
