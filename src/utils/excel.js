// Gerçek Excel (.xlsx) dosyası üretir — harici kütüphane yok.
// .xlsx, içinde XML dosyaları olan bir ZIP'tir; burada sıkıştırmasız ZIP yazılır.
// Başlık satırı kalın + sabit (dondurulmuş), filtreli; sayılar sayı, tarihler tarih,
// tutarlar "#.##0,00 ₺" biçiminde gelir (Excel'de toplanabilir).
import { dosyaKaydet } from './belgeGoster';

const xmlEsc = (s) => String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- ZIP (sıkıştırmasız) ----
const CRC_TABLO = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
function crc32(bayt) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bayt.length; i++) c = CRC_TABLO[(c ^ bayt[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function zipOlustur(dosyalar) {
    const enc = new TextEncoder();
    const parcalar = [];
    const merkez = [];
    let ofset = 0;
    const simdi = new Date();
    const dosTarih = ((simdi.getFullYear() - 1980) << 9) | ((simdi.getMonth() + 1) << 5) | simdi.getDate();
    const dosSaat = (simdi.getHours() << 11) | (simdi.getMinutes() << 5) | Math.floor(simdi.getSeconds() / 2);

    dosyalar.forEach(({ ad, icerik }) => {
        const adB = enc.encode(ad);
        const veri = enc.encode(icerik);
        const crc = crc32(veri);
        const yerel = new DataView(new ArrayBuffer(30));
        yerel.setUint32(0, 0x04034b50, true); yerel.setUint16(4, 20, true); yerel.setUint16(6, 0x0800, true);
        yerel.setUint16(8, 0, true); yerel.setUint16(10, dosSaat, true); yerel.setUint16(12, dosTarih, true);
        yerel.setUint32(14, crc, true); yerel.setUint32(18, veri.length, true); yerel.setUint32(22, veri.length, true);
        yerel.setUint16(26, adB.length, true); yerel.setUint16(28, 0, true);
        parcalar.push(new Uint8Array(yerel.buffer), adB, veri);

        const m = new DataView(new ArrayBuffer(46));
        m.setUint32(0, 0x02014b50, true); m.setUint16(4, 20, true); m.setUint16(6, 20, true); m.setUint16(8, 0x0800, true);
        m.setUint16(10, 0, true); m.setUint16(12, dosSaat, true); m.setUint16(14, dosTarih, true);
        m.setUint32(16, crc, true); m.setUint32(20, veri.length, true); m.setUint32(24, veri.length, true);
        m.setUint16(28, adB.length, true); m.setUint32(42, ofset, true);
        merkez.push(new Uint8Array(m.buffer), adB);
        ofset += 30 + adB.length + veri.length;
    });
    const merkezBoyut = merkez.reduce((t, p) => t + p.length, 0);
    const son = new DataView(new ArrayBuffer(22));
    son.setUint32(0, 0x06054b50, true);
    son.setUint16(8, dosyalar.length, true); son.setUint16(10, dosyalar.length, true);
    son.setUint32(12, merkezBoyut, true); son.setUint32(16, ofset, true);
    return new Blob([...parcalar, ...merkez, new Uint8Array(son.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---- Çalışma kitabı ----
// Stil indeksleri (styles.xml cellXfs sırası)
const STIL = { normal: 0, baslik: 1, sayi: 2, para: 3, tarih: 4, kalinPara: 5, kalin: 6 };

const sutunHarfi = (i) => {
    let s = '';
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
};

// Excel tarih seri numarası (1900 sistemi), yerel saatle
function excelTarih(d) {
    const t = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(t.getTime())) return null;
    return (Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes()) - Date.UTC(1899, 11, 30)) / 86400000;
}

function hucre(ref, deger, tip, kalin) {
    if (deger === null || deger === undefined || deger === '') return '';
    if (tip === 'tarih') {
        const seri = excelTarih(deger);
        if (seri !== null) return `<c r="${ref}" s="${STIL.tarih}"><v>${seri}</v></c>`;
    }
    if ((tip === 'para' || tip === 'sayi') && deger !== '' && Number.isFinite(Number(deger))) {
        const s = tip === 'para' ? (kalin ? STIL.kalinPara : STIL.para) : STIL.sayi;
        return `<c r="${ref}" s="${s}"><v>${Number(deger)}</v></c>`;
    }
    if (typeof deger === 'number' && !tip) return `<c r="${ref}"${kalin ? ` s="${STIL.kalin}"` : ''}><v>${deger}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${kalin ? ` s="${STIL.kalin}"` : ''}><is><t xml:space="preserve">${xmlEsc(deger)}</t></is></c>`;
}

// Sütunda açılır liste (ör. firma türü): sutun.secenekler = ['A', 'B'] → başlığın altındaki 500 satır
function secimListeleri(sutunlar, ilkSatir) {
    const liste = sutunlar.map((s, i) => ({ s, i })).filter(({ s }) => s.secenekler?.length);
    if (!liste.length) return '';
    return `<dataValidations count="${liste.length}">${liste.map(({ s, i }) => {
        const harf = sutunHarfi(i);
        return `<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="${harf}${ilkSatir}:${harf}${ilkSatir + 499}"><formula1>"${xmlEsc(s.secenekler.join(','))}"</formula1></dataValidation>`;
    }).join('')}</dataValidations>`;
}

// Formül hücresi (ör. Tutar = Adet × Fiyat); Excel açılışta hesaplar (workbook calcPr fullCalcOnLoad)
function formulHucre(ref, formul, tip) {
    const s = tip === 'para' ? STIL.para : tip === 'sayi' ? STIL.sayi : null;
    return `<c r="${ref}"${s !== null ? ` s="${s}"` : ''}><f>${xmlEsc(formul)}</f></c>`;
}

function sayfaXml({ sutunlar, satirlar, toplamSatiri, ustBilgi = [], bosSatir = 0 }) {
    const genislikler = sutunlar.map((s, i) => s.genislik || Math.min(50, Math.max(
        String(s.baslik).length + 2,
        ...satirlar.slice(0, 300).map(r => String(r[i] ?? '').length + 1),
        s.tip === 'para' ? 14 : s.tip === 'tarih' ? 12 : 6)));
    const xmlSatirlar = [];
    let no = 1;
    ustBilgi.forEach(metin => {
        xmlSatirlar.push(`<row r="${no}">${hucre(`A${no}`, metin, null, no === 1)}</row>`);
        no++;
    });
    if (ustBilgi.length) no++; // boş satır
    const baslikNo = no;
    xmlSatirlar.push(`<row r="${no}">${sutunlar.map((s, i) => `<c r="${sutunHarfi(i)}${no}" t="inlineStr" s="${STIL.baslik}"><is><t>${xmlEsc(s.baslik)}</t></is></c>`).join('')}</row>`);
    no++;
    satirlar.forEach(r => {
        xmlSatirlar.push(`<row r="${no}">${sutunlar.map((s, i) => (s.formul
            ? formulHucre(`${sutunHarfi(i)}${no}`, s.formul(no), s.tip)
            : hucre(`${sutunHarfi(i)}${no}`, r[i], s.tip))).join('')}</row>`);
        no++;
    });
    // Şablonlar için: yalnızca formülleri olan boş satırlar (kullanıcı doldurdukça hesaplanır)
    for (let k = 0; k < bosSatir; k++) {
        const formuller = sutunlar.map((s, i) => (s.formul ? formulHucre(`${sutunHarfi(i)}${no}`, s.formul(no), s.tip) : '')).join('');
        xmlSatirlar.push(`<row r="${no}">${formuller}</row>`);
        no++;
    }
    if (toplamSatiri) {
        xmlSatirlar.push(`<row r="${no}">${sutunlar.map((s, i) => hucre(`${sutunHarfi(i)}${no}`, toplamSatiri[i], s.tip, true)).join('')}</row>`);
        no++;
    }
    const sonSutun = sutunHarfi(Math.max(sutunlar.length - 1, 0));
    const veriSonu = baslikNo + satirlar.length;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${baslikNo}" topLeftCell="A${baslikNo + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${genislikler.map((g, i) => `<col min="${i + 1}" max="${i + 1}" width="${g}" customWidth="1"/>`).join('')}</cols>
<sheetData>${xmlSatirlar.join('')}</sheetData>
${satirlar.length ? `<autoFilter ref="A${baslikNo}:${sonSutun}${veriSonu}"/>` : ''}
${secimListeleri(sutunlar, baslikNo + 1)}
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

const STILLER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;₺&quot;"/><numFmt numFmtId="165" formatCode="dd.mm.yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9EDF1"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF8494A3"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// Excel sayfa adı: en fazla 31 karakter, : \ / ? * [ ] yok, benzersiz
function sayfaAdlari(sayfalar) {
    const kullanilan = new Set();
    return sayfalar.map((s, i) => {
        let ad = String(s.ad || `Sayfa${i + 1}`).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || `Sayfa${i + 1}`;
        let aday = ad; let n = 2;
        while (kullanilan.has(aday.toLocaleLowerCase('tr'))) aday = `${ad.slice(0, 28)} ${n++}`;
        kullanilan.add(aday.toLocaleLowerCase('tr'));
        return aday;
    });
}

// sayfalar: [{ ad, sutunlar: [{ baslik, tip?: 'para'|'sayi'|'tarih', genislik?, secenekler?, formul?: (satirNo) => 'D2*E2' }],
//              satirlar: [[...]], toplamSatiri?, ustBilgi?: [metin], bosSatir?: formüllü boş satır sayısı }]
export function excelBlob(sayfalar) {
    const adlar = sayfaAdlari(sayfalar);
    const dosyalar = [
        { ad: '[Content_Types].xml', icerik: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sayfalar.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
        { ad: '_rels/.rels', icerik: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
        { ad: 'xl/workbook.xml', icerik: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${adlar.map((ad, i) => `<sheet name="${xmlEsc(ad)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
        { ad: 'xl/_rels/workbook.xml.rels', icerik: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sayfalar.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sayfalar.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
        { ad: 'xl/styles.xml', icerik: STILLER },
        ...sayfalar.map((s, i) => ({ ad: `xl/worksheets/sheet${i + 1}.xml`, icerik: sayfaXml(s) })),
    ];
    return zipOlustur(dosyalar);
}

const dosyaAdiTemizle = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_');

export function excelIndir(dosyaAdi, sayfalar) {
    return dosyaKaydet(excelBlob(sayfalar), `${dosyaAdiTemizle(dosyaAdi)}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Kolay kullanım: kayıt listesi + sütun tanımları → tek sayfalık Excel
// sutunlar: [{ baslik, deger: (kayit) => değer, tip? }]
export function listeyiExceleAktar(dosyaAdi, kayitlar, sutunlar, { sayfaAdi, ustBilgi, toplamlar } = {}) {
    const satirlar = kayitlar.map(k => sutunlar.map(s => s.deger(k)));
    const toplamSatiri = toplamlar ? sutunlar.map((s, i) => (i === 0 ? 'TOPLAM' : toplamlar.includes(i)
        ? satirlar.reduce((t, r) => t + (Number(r[i]) || 0), 0) : '')) : null;
    excelIndir(dosyaAdi, [{ ad: sayfaAdi || dosyaAdi, sutunlar, satirlar, toplamSatiri, ustBilgi }]);
}
