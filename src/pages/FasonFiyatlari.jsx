// Fason fiyat tablosu (Excel benzeri): satırlarda modeller, sütunlarda fason türü başına önce varsayılan
// fiyat, sonra o türdeki her firmanın anlaşmalı fiyatı. Hücreler arasında Enter / ok tuşlarıyla gezilir,
// Excel'den kopyalanan bloklar yapıştırılabilir; değişiklikler "Kaydet" ile topluca yazılır.
// Firma hücresi boşsa varsayılan fiyat geçerlidir (Parti açarken firmaFiyatBul aynı kuralı kullanır).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Undo2, Search, FileSpreadsheet, Power } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { firmaAktifMi } from '../utils/firma';
import { sayiOku } from '../utils/excelOku';
import { excelIndir } from '../utils/excel';
import Notice from '../components/ui/Notice';
import { fasonFiyatGorur } from '../data/yetki';

const GRUPLAR = [
    { tip: 'kesim', firmaTip: 'kesimhane', baslik: 'KESİM', alan: 'kesimFiyat' },
    { tip: 'dikim', firmaTip: 'atolye', baslik: 'DİKİM (ATÖLYE)', alan: 'dikimFiyat' },
    { tip: 'utu', firmaTip: 'utupaketci', baslik: 'ÜTÜ / PAKET', alan: 'utuFiyat' },
];

const yaz = (n) => (n === null || n === undefined || n === '' || !(Number(n) > 0) ? ''
    : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 4 }));
const gecerliMi = (s) => String(s).trim() === '' || (Number.isFinite(sayiOku(s)) && sayiOku(s) >= 0 && /\d/.test(String(s)));

export default function FasonFiyatlari() {
    const { urunler, firmalar, urunGuncelle, currentUser } = useApp();
    const navigate = useNavigate();
    const [arama, setArama] = useState('');
    const [gizliGruplar, setGizliGruplar] = useState([]);
    const [pasifler, setPasifler] = useState(false);
    const [degisiklik, setDegisiklik] = useState({});   // `${urunId}|${kolon}` → yazılan metin
    const [bilgi, setBilgi] = useState('');
    const hucreler = useRef({});

    const gruplar = useMemo(() => GRUPLAR.filter(g => !gizliGruplar.includes(g.tip)).map(g => ({
        ...g,
        firmalar: firmalar
            .filter(f => f.tip === g.firmaTip && (pasifler || firmaAktifMi(f)))
            .sort((a, b) => a.ad.localeCompare(b.ad, 'tr')),
    })), [firmalar, gizliGruplar, pasifler]);

    // Sütunlar: her grupta önce varsayılan, sonra firmalar
    const kolonlar = useMemo(() => gruplar.flatMap(g => [
        { anahtar: `${g.tip}|*`, grup: g, firma: null },
        ...g.firmalar.map(f => ({ anahtar: `${g.tip}|${f.id}`, grup: g, firma: f })),
    ]), [gruplar]);

    const satirlar = useMemo(() => {
        const q = arama.trim().toLocaleLowerCase('tr');
        return [...urunler]
            .filter(u => !q || `${u.urunKodu} ${u.urunAdi}`.toLocaleLowerCase('tr').includes(q))
            .sort((a, b) => String(a.urunKodu).localeCompare(String(b.urunKodu), 'tr', { numeric: true }));
    }, [urunler, arama]);

    const kayitliDeger = (urun, kol) => (kol.firma ? urun.firmaFiyatlari?.[kol.firma.id]?.[kol.grup.tip] : urun[kol.grup.alan]);
    const hucreMetni = (urun, kol) => {
        const k = `${urun.id}|${kol.anahtar}`;
        return k in degisiklik ? degisiklik[k] : yaz(kayitliDeger(urun, kol));
    };
    const degistir = (urun, kol, metin) => {
        const k = `${urun.id}|${kol.anahtar}`;
        setDegisiklik(d => {
            const yeni = { ...d };
            if (metin === yaz(kayitliDeger(urun, kol))) delete yeni[k]; else yeni[k] = metin;
            return yeni;
        });
    };

    const degisiklikSayisi = Object.keys(degisiklik).length;
    const hataliVar = Object.values(degisiklik).some(v => !gecerliMi(v));

    // Kaydedilmemiş değişiklik varken sayfadan çıkılırsa uyar
    useEffect(() => {
        if (!degisiklikSayisi) return undefined;
        const uyar = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', uyar);
        return () => window.removeEventListener('beforeunload', uyar);
    }, [degisiklikSayisi]);

    const kaydet = () => {
        if (hataliVar) return;
        const urunBazli = {};
        Object.entries(degisiklik).forEach(([k, metin]) => {
            const [urunId, tip, firmaId] = k.split('|');
            (urunBazli[urunId] ||= []).push({ tip, firmaId, deger: String(metin).trim() === '' ? null : sayiOku(metin) });
        });
        let adet = 0;
        Object.entries(urunBazli).forEach(([urunId, liste]) => {
            const urun = urunler.find(u => u.id === urunId);
            if (!urun) return;
            const guncel = {};
            const ff = JSON.parse(JSON.stringify(urun.firmaFiyatlari || {}));
            let ffDegisti = false;
            liste.forEach(({ tip, firmaId, deger }) => {
                if (firmaId === '*') {
                    guncel[GRUPLAR.find(g => g.tip === tip).alan] = deger || 0;
                } else {
                    ffDegisti = true;
                    const f = { ...(ff[firmaId] || {}) };
                    if (deger > 0) f[tip] = deger; else delete f[tip];
                    if (Object.values(f).some(v => Number(v) > 0)) ff[firmaId] = f; else delete ff[firmaId];
                }
            });
            if (ffDegisti) guncel.firmaFiyatlari = ff;
            urunGuncelle(urunId, guncel);
            adet++;
        });
        setDegisiklik({});
        setBilgi(`${adet} modelin fason fiyatları kaydedildi. Yeni açılan partilerde bu fiyatlar kullanılır.`);
    };

    // ---- Excel gibi gezinme ----
    const odakla = (r, c) => {
        const el = hucreler.current[`${r}:${c}`];
        if (el) { el.focus(); el.select(); }
    };
    const tusBasildi = (e, r, c, urun, kol) => {
        const el = e.currentTarget;
        const basta = el.selectionStart === 0 && el.selectionEnd === 0;
        const sonda = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); odakla(e.shiftKey && e.key === 'Enter' ? r - 1 : r + 1, c); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); odakla(r - 1, c); }
        else if (e.key === 'ArrowLeft' && (basta || el.selectionEnd - el.selectionStart === el.value.length)) { e.preventDefault(); odakla(r, c - 1); }
        else if (e.key === 'ArrowRight' && (sonda || el.selectionEnd - el.selectionStart === el.value.length)) { e.preventDefault(); odakla(r, c + 1); }
        else if (e.key === 'Escape') { e.preventDefault(); degistir(urun, kol, yaz(kayitliDeger(urun, kol))); el.blur(); }
    };
    // Excel'den kopyalanan blok (sekme / satır ayrımlı) bu hücreden başlayarak yapıştırılır
    const yapistir = (e, r, c) => {
        const metin = e.clipboardData.getData('text/plain');
        if (!/[\t\n]/.test(metin.trim())) return;   // tek hücre: normal yapıştırma
        e.preventDefault();
        const blok = metin.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(s => s.split('\t'));
        setDegisiklik(d => {
            const yeni = { ...d };
            blok.forEach((satir, i) => satir.forEach((v, j) => {
                const urun = satirlar[r + i];
                const kol = kolonlar[c + j];
                if (!urun || !kol) return;
                const k = `${urun.id}|${kol.anahtar}`;
                const deger = v.trim();
                if (deger === yaz(kayitliDeger(urun, kol))) delete yeni[k]; else yeni[k] = deger;
            }));
            return yeni;
        });
    };

    const excelAl = () => {
        const sutunlar = [{ baslik: 'Model Kodu' }, { baslik: 'Ürün Adı' },
            ...kolonlar.map(k => ({ baslik: `${k.grup.baslik} — ${k.firma ? k.firma.ad : 'Varsayılan'}`, tip: 'para' }))];
        excelIndir('Fason_Fiyatlari', [{
            ad: 'Fason Fiyatları', sutunlar,
            satirlar: satirlar.map(u => [u.urunKodu, u.urunAdi, ...kolonlar.map(k => Number(kayitliDeger(u, k)) || null)]),
        }]);
    };

    if (!fasonFiyatGorur(currentUser)) {
        return <div className="empty-state"><div className="empty-state-title">Bu sayfayı görme yetkiniz yok</div></div>;
    }

    return (
        <div className="animate-fade-in fason-sayfa">
            <div className="page-header">
                <button className="btn btn-ghost" onClick={() => navigate('/urunler')}><ArrowLeft size={18} /> Ürünler</button>
                <h1 className="page-title">Fason Fiyatları</h1>
                <div className="page-header-actions">
                    <button className="btn btn-ghost" onClick={excelAl} title="Tabloyu Excel'e aktar"><FileSpreadsheet size={16} /> Excel</button>
                    <button className="btn btn-ghost" onClick={() => setDegisiklik({})} disabled={!degisiklikSayisi}><Undo2 size={16} /> Vazgeç</button>
                    <button className="btn btn-primary" onClick={kaydet} disabled={!degisiklikSayisi || hataliVar}>
                        <Save size={16} /> Kaydet{degisiklikSayisi ? ` (${degisiklikSayisi})` : ''}
                    </button>
                </div>
            </div>

            {bilgi && !degisiklikSayisi && <Notice tone="success">{bilgi}</Notice>}
            {hataliVar && <Notice tone="danger">Kırmızı hücrelerde sayı olmayan değer var; düzeltmeden kaydedilemez.</Notice>}

            <div className="fason-arac">
                <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder="Model kodu veya adı ara..." value={arama} onChange={e => setArama(e.target.value)} />
                </div>
                <div className="filter-row" style={{ marginBottom: 0 }}>
                    {GRUPLAR.map(g => (
                        <button key={g.tip} className={`filter-btn ${gizliGruplar.includes(g.tip) ? '' : 'active'}`}
                            onClick={() => setGizliGruplar(l => (l.includes(g.tip) ? l.filter(t => t !== g.tip) : [...l, g.tip]))}>
                            {g.baslik}
                        </button>
                    ))}
                    <button className={`filter-btn ${pasifler ? 'active' : ''}`} onClick={() => setPasifler(v => !v)}><Power size={13} /> Pasifler</button>
                </div>
            </div>

            <div className="fason-tablo-kap">
                <table className="fason-tablo">
                    <thead>
                        <tr className="grup-satir">
                            <th className="sabit s1" rowSpan={2}>Model</th>
                            <th className="sabit s2" rowSpan={2}>Ürün Adı</th>
                            {gruplar.map(g => <th key={g.tip} colSpan={g.firmalar.length + 1} className={`grup grup-${g.tip}`}>{g.baslik}</th>)}
                        </tr>
                        <tr className="firma-satir">
                            {kolonlar.map(k => (
                                <th key={k.anahtar} className={`${k.firma ? '' : 'varsayilan'} grup-${k.grup.tip}`} title={k.firma ? k.firma.ad : 'Firma anlaşması yoksa kullanılan fiyat'}>
                                    {k.firma ? k.firma.ad : 'Varsayılan'}{k.firma && !firmaAktifMi(k.firma) ? ' (pasif)' : ''}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {satirlar.map((u, r) => (
                            <tr key={u.id}>
                                <td className="sabit s1 kod">{u.urunKodu}</td>
                                <td className="sabit s2 ad" title={u.urunAdi}>{u.urunAdi}</td>
                                {kolonlar.map((k, c) => {
                                    const anahtar = `${u.id}|${k.anahtar}`;
                                    const metin = hucreMetni(u, k);
                                    const varsayilan = k.firma ? yaz(degisiklik[`${u.id}|${k.grup.tip}|*`] !== undefined ? sayiOku(degisiklik[`${u.id}|${k.grup.tip}|*`]) : u[k.grup.alan]) : '';
                                    const sinif = [
                                        k.firma ? '' : 'varsayilan',
                                        anahtar in degisiklik ? 'degisti' : '',
                                        anahtar in degisiklik && !gecerliMi(degisiklik[anahtar]) ? 'hatali' : '',
                                    ].join(' ');
                                    return (
                                        <td key={k.anahtar} className={sinif}>
                                            <input
                                                ref={el => { hucreler.current[`${r}:${c}`] = el; }}
                                                type="text" inputMode="decimal"
                                                value={metin}
                                                placeholder={varsayilan}
                                                aria-label={`${u.urunKodu} — ${k.grup.baslik} — ${k.firma ? k.firma.ad : 'Varsayılan'}`}
                                                onChange={e => degistir(u, k, e.target.value)}
                                                onFocus={e => e.target.select()}
                                                onKeyDown={e => tusBasildi(e, r, c, u, k)}
                                                onPaste={e => yapistir(e, r, c)}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {satirlar.length === 0 && <div className="empty-state"><div className="empty-state-title">Model bulunamadı</div></div>}
            </div>
            <p className="text-xs text-muted" style={{ marginTop: '8px' }}>
                Fiyatlar adet başı ₺. Firma hücresi boşsa (gri yazı) o firma için varsayılan fiyat geçerlidir.
                Enter / ok tuşlarıyla hücreler arasında gezebilir, Excel'den kopyaladığınız bir bloğu bir hücreye yapıştırabilirsiniz.
                Değişiklikler yeni açılan partilerde geçerli olur; açılmış partilerin fiyatı değişmez.
            </p>
        </div>
    );
}
