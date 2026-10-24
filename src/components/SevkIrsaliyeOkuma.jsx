import { useMemo, useState } from 'react';
import { Sparkles, Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import Notice from './ui/Notice';
import SearchableSelect from './SearchableSelect';
import { useApp } from '../context/AppContext';
import { apiIstek } from '../data/api';
import { gorselDataUrl } from '../utils/foto';
import { SABLON_KODU } from '../utils/irsaliyeSablonu';
import { secilebilirFirmalar } from '../utils/firma';

// ---- Eşleştirme yardımcıları (el yazısı → sistemdeki kayıt) ----
const norm = (s) => String(s ?? '').toLocaleUpperCase('tr-TR').replace(/[^0-9A-ZÇĞİÖŞÜ]/g, '');
const rakamlar = (s) => String(s ?? '').replace(/\D/g, '');

export function urunBul(urunler, model) {
    const n = norm(model);
    if (!n) return null;
    return urunler.find(u => norm(u.urunKodu) === n)
        || urunler.find(u => rakamlar(u.urunKodu) && rakamlar(u.urunKodu) === rakamlar(model) && rakamlar(model).length >= 3)
        || urunler.find(u => norm(u.urunKodu).endsWith(n) || n.endsWith(norm(u.urunKodu)))
        || urunler.find(u => norm(u.urunAdi) && (norm(u.urunAdi).includes(n) || n.includes(norm(u.urunAdi))))
        || null;
}

export function firmaBul(firmalar, ad, tip) {
    const n = norm(ad);
    if (!n) return null;
    const aday = secilebilirFirmalar(firmalar, { tip }); // pasif firmalarla eşleşmez
    return aday.find(f => norm(f.ad) === n)
        || aday.find(f => norm(f.ad).includes(n) || n.includes(norm(f.ad)))
        || aday.find(f => norm(f.ad).split(/\s+/)[0] && n.startsWith(norm(f.ad).slice(0, 5)))
        || null;
}

function partiBul(partiler, partiNo, urunId, kesimhaneId) {
    // Formdaki parti no yalnızca AYNI modelin partisiyse kullanılır (formda birden çok model olabilir)
    const no = rakamlar(partiNo);
    if (no) {
        const p = partiler.find(x => rakamlar(x.partiNo) && parseInt(rakamlar(x.partiNo), 10) === parseInt(no, 10));
        if (p && (!urunId || p.urunId === urunId)) return p;
    }
    if (!urunId) return null;
    const adaylar = partiler
        .filter(p => p.urunId === urunId && (!kesimhaneId || p.kesimhaneId === kesimhaneId) && p.durum !== 'tamamlandi')
        .sort((a, b) => (a.durum === 'kesimde' ? -1 : 1) - (b.durum === 'kesimde' ? -1 : 1) || new Date(b.createdAt) - new Date(a.createdAt));
    return adaylar[0] || null;
}

const tarihNorm = (t) => (/^\d{4}-\d{2}-\d{2}$/.test(t || '') ? t : new Date().toISOString().split('T')[0]);

// Görsel okunurken yapay zekâya verilen bağlam (bilinen kodlar/adlar → daha doğru okuma)
export function okumaBaglami({ urunler, firmalar, partiler }) {
    return {
        modeller: urunler.slice(0, 150).map(u => `${u.urunKodu} — ${u.urunAdi}`),
        atolyeler: secilebilirFirmalar(firmalar, { tip: 'atolye' }).map(f => f.ad),
        kesimhaneler: secilebilirFirmalar(firmalar, { tip: 'kesimhane' }).map(f => f.ad),
        partiler: partiler.filter(p => p.durum !== 'tamamlandi').slice(0, 100).map(p => p.partiNo),
    };
}

// Fotoğrafı okut → { okuma, saglayici, gorsel }
export async function sevkIrsaliyesiOkut(file, baglam) {
    const gorsel = await gorselDataUrl(file, 1800, 0.85);
    const json = await apiIstek('irsaliye_oku=1', { tur: 'sevk', data: gorsel, baglam })
        .catch(err => err.veri || { error: 'baglanti', mesaj: err.message });
    if (json.error === 'anahtar_yok') {
        const e = new Error(json.mesaj || 'Yapay zekâ okuma kapalı.');
        e.anahtarYok = true;
        throw e;
    }
    if (!json.success) throw new Error(json.mesaj || 'Form okunamadı. Fotoğrafı daha net çekip tekrar deneyin.');
    return { okuma: json.okuma, saglayici: json.saglayici, gorsel };
}

export default function SevkIrsaliyeOkuma({ sonuc, onClose, onKaydedildi }) {
    const { urunler, firmalar, partiler, irsaliyeEkle, currentUser } = useApp();
    const kesimhaneKullanici = currentUser?.rol === 'kesimhane';
    const kesimhaneler = secilebilirFirmalar(firmalar, { tip: 'kesimhane' });
    const atolyeler = secilebilirFirmalar(firmalar, { tip: 'atolye' });
    const o = sonuc.okuma || {};

    // İlk eşleştirme
    const ilk = useMemo(() => {
        const gonderen = kesimhaneKullanici
            ? firmalar.find(f => f.id === currentUser.firmaId)
            : firmaBul(firmalar, o.gonderen, 'kesimhane');
        const satirlar = (o.satirlar || [])
            .filter(s => s && (String(s.model || '').trim() || String(s.renk || '').trim() || s.adet))
            .map(s => {
                const urun = urunBul(urunler, s.model);
                const parti = partiBul(partiler, o.partiNo, urun?.id, gonderen?.id);
                const bedenler = s.bedenler && typeof s.bedenler === 'object' ? Object.fromEntries(
                    Object.entries(s.bedenler).filter(([, v]) => Number(v) > 0).map(([k, v]) => [String(k).toUpperCase(), parseInt(v, 10)])) : {};
                const bedenToplam = Object.values(bedenler).reduce((t, v) => t + v, 0);
                return {
                    dahil: true,
                    model: String(s.model || '').trim(),
                    urunId: urun?.id || '',
                    partiId: parti?.id || '',
                    renk: String(s.renk || '').trim(),
                    adet: String(Number.isFinite(Number(s.adet)) && Number(s.adet) > 0 ? parseInt(s.adet, 10) : (bedenToplam || '')),
                    bedenler,
                };
            });
        const ilkParti = partiler.find(p => p.id === satirlar.find(s => s.partiId)?.partiId);
        const alan = firmaBul(firmalar, o.alan, 'atolye') || firmalar.find(f => f.id === ilkParti?.dikimhaneId);
        return {
            gonderenId: gonderen?.id || ilkParti?.kesimhaneId || '',
            alanId: alan?.id || '',
            formNo: String(o.irsaliyeNo || '').trim(),
            tarih: tarihNorm(o.tarih),
            notlar: String(o.notlar || '').trim(),
            satirlar,
        };
    }, [sonuc]); // eslint-disable-line react-hooks/exhaustive-deps

    const [form, setForm] = useState(ilk);
    const [busy, setBusy] = useState(false);
    const satirGuncelle = (i, alan, deger) => setForm(f => ({ ...f, satirlar: f.satirlar.map((s, j) => j === i ? { ...s, [alan]: deger } : s) }));

    const kaydedilecek = form.satirlar.filter(s => s.dahil && (parseInt(s.adet, 10) > 0) && (s.urunId || s.model));
    const toplam = kaydedilecek.reduce((t, s) => t + (parseInt(s.adet, 10) || 0), 0);
    const formToplam = Number(o.toplamAdet) || null;
    const eksikUrun = kaydedilecek.some(s => !s.urunId);
    const hazir = kaydedilecek.length > 0 && form.gonderenId && form.alanId;

    const kaydet = async () => {
        if (!hazir) return;
        setBusy(true);
        const gonderen = firmalar.find(f => f.id === form.gonderenId);
        const alan = firmalar.find(f => f.id === form.alanId);
        // Okutulan formun fotoğrafı irsaliyeye eklenir (gerçek sunucuda; demoda saklanmaz)
        let formFotoUrl = '';
        if (import.meta.env.VITE_DEMO !== '1' && sonuc.gorsel) {
            try { formFotoUrl = (await apiIstek('foto=upload', { data: sonuc.gorsel }))?.url || ''; } catch (e) { /* fotoğrafsız devam */ }
        }
        // Her model (parti) için ayrı irsaliye
        const gruplar = new Map();
        kaydedilecek.forEach(s => {
            const anahtar = `${s.urunId || norm(s.model)}|${s.partiId}`;
            if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
            gruplar.get(anahtar).push(s);
        });
        let sayi = 0;
        gruplar.forEach(satirlar => {
            const ilkSatir = satirlar[0];
            const urun = urunler.find(u => u.id === ilkSatir.urunId);
            const parti = partiler.find(p => p.id === ilkSatir.partiId);
            const bedenAdlari = [...new Set(satirlar.flatMap(s => Object.keys(s.bedenler || {})))];
            irsaliyeEkle({
                partiId: parti?.id || null,
                partiNo: parti?.partiNo || '',
                urunId: urun?.id || null,
                urunKodu: urun?.urunKodu || ilkSatir.model,
                urunAdi: urun?.urunAdi || ilkSatir.model,
                toplamAdet: satirlar.reduce((t, s) => t + (parseInt(s.adet, 10) || 0), 0),
                renkler: satirlar.map(s => ({ renk: s.renk || '—', katSayisi: '', toplam: parseInt(s.adet, 10) || 0, bedenAdetleri: s.bedenler || {} })),
                ...(bedenAdlari.length ? { asorti: { bedenler: bedenAdlari } } : {}),
                tip: 'kesimhane_dikimhane',
                tarih: new Date(form.tarih).toISOString(),
                gonderenFirmaId: gonderen?.id, gonderenFirmaAdi: gonderen?.ad || '',
                gonderenTel: gonderen?.telefon || '', gonderenAdres: gonderen?.adres || '',
                alanFirmaId: alan?.id, alanFirmaAdi: alan?.ad || '',
                alanTel: alan?.telefon || '', alanAdres: alan?.adres || '',
                formNo: form.formNo,
                kaynak: 'sablon_okuma',
                formFotoUrl,
                notlar: [`${SABLON_KODU} formundan okundu${form.formNo ? ` (form no: ${form.formNo})` : ''}.`, form.notlar].filter(Boolean).join(' '),
            });
            sayi++;
        });
        setBusy(false);
        onKaydedildi?.(sayi);
        onClose();
    };

    return (
        <Modal
            title="Okunan irsaliyeyi kontrol edin"
            onClose={onClose}
            footer={<>
                <button className="btn btn-ghost" onClick={onClose}>İptal</button>
                <button className={`btn btn-primary ${busy ? 'is-loading' : ''}`} onClick={kaydet} disabled={!hazir || busy}>
                    <Sparkles size={16} /> {kesimhaneKullanici ? 'Taslak irsaliye oluştur' : 'İrsaliye oluştur'}
                </button>
            </>}
        >
            {sonuc.saglayici && <div className="text-xs text-muted" style={{ marginBottom: '12px' }}>Okuyan: {sonuc.saglayici}</div>}

            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">Gönderen kesimhane *</label>
                    {kesimhaneKullanici ? (
                        <input className="form-input" value={firmalar.find(f => f.id === form.gonderenId)?.ad || ''} readOnly />
                    ) : (
                        <SearchableSelect value={form.gonderenId} onChange={v => setForm({ ...form, gonderenId: v })}
                            options={kesimhaneler.map(f => ({ value: f.id, label: f.ad }))}
                            placeholder={o.gonderen ? `Okunan: ${o.gonderen}` : 'Seçin'} />
                    )}
                </div>
                <div className="form-group">
                    <label className="form-label">Alan atölye *</label>
                    <SearchableSelect value={form.alanId} onChange={v => setForm({ ...form, alanId: v })}
                        options={atolyeler.map(f => ({ value: f.id, label: f.ad }))}
                        placeholder={o.alan ? `Okunan: ${o.alan}` : 'Seçin'} />
                </div>
            </div>
            <div className="form-row">
                <div className="form-group">
                    <label className="form-label" htmlFor="okuma-tarih">Tarih</label>
                    <input id="okuma-tarih" type="date" className="form-input" value={form.tarih} onChange={e => setForm({ ...form, tarih: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="okuma-formno">Formdaki irsaliye no</label>
                    <input id="okuma-formno" className="form-input" value={form.formNo} onChange={e => setForm({ ...form, formNo: e.target.value })} />
                </div>
            </div>

            <label className="form-label">Okunan satırlar</label>
            <div className="okuma-satirlar">
                {form.satirlar.length === 0 && <Notice tone="warning">Formda dolu satır okunamadı. Satır ekleyebilir veya fotoğrafı yeniden çekebilirsiniz.</Notice>}
                {form.satirlar.map((s, i) => {
                    const urun = urunler.find(u => u.id === s.urunId);
                    const urunPartileri = partiler.filter(p => p.urunId === s.urunId && p.durum !== 'tamamlandi');
                    return (
                        <div key={i} className={`okuma-satir ${s.dahil ? '' : 'okuma-satir--pasif'} ${s.urunId ? '' : 'okuma-satir--uyari'}`}>
                            <div className="okuma-satir-ust">
                                <input type="checkbox" checked={s.dahil} onChange={e => satirGuncelle(i, 'dahil', e.target.checked)} aria-label="Satırı dahil et" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <SearchableSelect
                                        value={s.urunId}
                                        onChange={v => setForm(f => ({ ...f, satirlar: f.satirlar.map((x, j) => j === i ? { ...x, urunId: v, partiId: partiBul(partiler, '', v, f.gonderenId)?.id || '' } : x) }))}
                                        options={urunler.map(u => ({ value: u.id, label: `${u.urunKodu} — ${u.urunAdi}` }))}
                                        placeholder={s.model ? `Okunan model: ${s.model} (eşleşmedi)` : 'Model seçin'}
                                    />
                                </div>
                                <button type="button" className="btn-icon" onClick={() => setForm(f => ({ ...f, satirlar: f.satirlar.filter((_, j) => j !== i) }))} aria-label="Satırı sil">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div className="okuma-satir-alt">
                                <input className="form-input" value={s.renk} onChange={e => satirGuncelle(i, 'renk', e.target.value)} placeholder="Renk" aria-label="Renk" />
                                <input className="form-input" type="number" inputMode="numeric" min="0" value={s.adet} onChange={e => satirGuncelle(i, 'adet', e.target.value)} placeholder="Adet" aria-label="Adet" />
                                <select className="form-input" value={s.partiId} onChange={e => satirGuncelle(i, 'partiId', e.target.value)} aria-label="Parti">
                                    <option value="">Parti yok</option>
                                    {urunPartileri.map(p => <option key={p.id} value={p.id}>{p.partiNo}</option>)}
                                </select>
                            </div>
                            {Object.keys(s.bedenler || {}).length > 0 && (
                                <div className="text-xs text-muted">Beden: {Object.entries(s.bedenler).map(([b, v]) => `${b}:${v}`).join(' · ')}</div>
                            )}
                            {!urun && s.model && <div className="text-xs" style={{ color: 'var(--accent-warning)' }}>"{s.model}" sistemde bulunamadı; listeden seçin.</div>}
                        </div>
                    );
                })}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm(f => ({ ...f, satirlar: [...f.satirlar, { dahil: true, model: '', urunId: '', partiId: '', renk: '', adet: '', bedenler: {} }] }))}>
                    <Plus size={14} /> Satır ekle
                </button>
            </div>

            <div className="kesim-toplam">
                <span>Toplam {formToplam ? `(formda yazan: ${formToplam})` : ''}</span>
                <strong style={{ color: formToplam && formToplam !== toplam ? 'var(--accent-warning)' : undefined }}>{toplam.toLocaleString('tr-TR')} adet</strong>
            </div>

            {eksikUrun && <Notice tone="warning" style={{ marginTop: '12px' }}>Eşleşmeyen modeller okunduğu adla kaydedilir; mümkünse listeden doğru ürünü seçin.</Notice>}
            {formToplam && formToplam !== toplam && (
                <Notice tone="warning" style={{ marginTop: '12px' }}>Formdaki toplam ({formToplam}) ile satırların toplamı ({toplam}) farklı. Adetleri kontrol edin.</Notice>
            )}
            <Notice tone={kesimhaneKullanici ? 'warning' : 'info'} style={{ marginTop: '12px' }}>
                {kesimhaneKullanici ? 'İrsaliye TASLAK olarak kaydedilir; yönetici onaylar.' : 'İrsaliye "Onaylandı" olarak kaydedilir.'} Her model ayrı irsaliye olur.
            </Notice>
        </Modal>
    );
}
