import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DURUM_LABELS, FIRMA_TIP_LABELS } from '../data/db';
import { firmaRozetSinifi } from '../utils/firma';
import BarChart from '../components/ui/BarChart';
import MetricTile from '../components/ui/MetricTile';
import {
    BarChart3, TrendingUp, Package, Layers, Wallet,
    Factory, Award, Calendar, PieChart, ArrowUpRight, ArrowDownRight, FileSpreadsheet, FileText
} from 'lucide-react';
import { excelIndir } from '../utils/excel';
import { raporYazdir, tlBicim } from '../utils/raporYazdir';
import { useKurlar, paraBicim } from '../data/kur';
import { modelMaliyeti, partiMaliyeti, partiUretimAdedi, maliyetTanimliMi } from '../utils/maliyet';

export default function Raporlar() {
    const { partiler, firmalar, urunler, cariHareketler, kumasStoklar, maliyetAyar } = useApp();
    const { kurlar } = useKurlar();

    // ======== MALİYET VE KÂRLILIK ========
    // Model bazında: kart maliyeti, satış fiyatı, marj; tamamlanan partilerde gerçekleşen kâr
    // Atölye bazında: partilere yazılan fason borçları ve adet başı ortalama
    const karlilik = useMemo(() => {
        const modeller = urunler.filter(maliyetTanimliMi).map(u => {
            const h = modelMaliyeti(u, { kurlar, ayar: maliyetAyar });
            const ups = partiler.filter(p => p.urunId === u.id);
            const tamamlanan = ups.filter(p => p.durum === 'tamamlandi');
            const gercek = tamamlanan.map(p => partiMaliyeti(p, { urun: u, cariHareketler, kumasStoklar, kurlar, ayar: maliyetAyar }));
            const gelir = gercek.reduce((t, g) => t + (g.gelir || 0), 0);
            const kar = gercek.reduce((t, g) => t + (g.kar || 0), 0);
            return {
                id: u.id, urunKodu: u.urunKodu, urunAdi: u.urunAdi, birimMaliyet: h.birimMaliyet, satis: h.satisTl, marj: h.karMarji,
                hedef: h.hedefKarMarji, uretilen: ups.reduce((t, p) => t + partiUretimAdedi(p), 0),
                tamamlananAdet: gercek.reduce((t, g) => t + g.adet, 0), gelir: h.satisTl !== null ? gelir : null, kar: h.satisTl !== null ? kar : null,
            };
        }).sort((a, b) => (b.kar ?? -Infinity) - (a.kar ?? -Infinity));
        const atolye = {};
        cariHareketler.filter(h => h.tip === 'borc' && h.partiId).forEach(h => {
            const p = partiler.find(x => x.id === h.partiId);
            if (!p) return;
            const a = atolye[h.firmaId] || (atolye[h.firmaId] = { firmaId: h.firmaId, partiler: new Set(), toplam: 0, adet: 0 });
            if (!a.partiler.has(p.id)) { a.partiler.add(p.id); a.adet += partiUretimAdedi(p); }
            a.toplam += Number(h.tutar) || 0;
        });
        const atolyeler = Object.values(atolye).map(a => {
            const f = firmalar.find(x => x.id === a.firmaId);
            return { ad: f?.ad || 'Bilinmeyen', tip: f?.tip || '', parti: a.partiler.size, adet: a.adet, toplam: a.toplam, adetBasi: a.adet ? a.toplam / a.adet : 0 };
        }).sort((a, b) => b.toplam - a.toplam);
        return { modeller, atolyeler };
    }, [urunler, partiler, cariHareketler, kumasStoklar, firmalar, kurlar, maliyetAyar]);

    const reports = useMemo(() => {
        // ======== ÜRETİM ÖZETİ ========
        const toplamParti = partiler.length;
        const aktifPartiler = partiler.filter(p => p.durum !== 'tamamlandi');
        const tamamlananPartiler = partiler.filter(p => p.durum === 'tamamlandi');
        const toplamUretim = partiler.reduce((t, p) => t + (Number(p.toplamAdet) || 0), 0);
        const tamamlananUretim = tamamlananPartiler.reduce((t, p) => t + (Number(p.toplamAdet) || 0), 0);
        const aktifUretim = aktifPartiler.reduce((t, p) => t + (Number(p.toplamAdet) || 0), 0);
        const tamamlanmaOrani = toplamParti > 0 ? Math.round((tamamlananPartiler.length / toplamParti) * 100) : 0;

        // ======== DURUM DAĞILIMI ========
        const durumDagilimi = {};
        partiler.forEach(p => {
            durumDagilimi[p.durum] = (durumDagilimi[p.durum] || 0) + 1;
        });

        // ======== ÜRÜN BAZLI ========
        const urunRapor = {};
        partiler.forEach(p => {
            const key = p.urunId || p.urunKodu || 'Bilinmeyen';
            if (!urunRapor[key]) {
                urunRapor[key] = {
                    urunKodu: p.urunKodu,
                    urunAdi: p.urunAdi,
                    partiSayisi: 0,
                    toplamAdet: 0,
                    tamamlanan: 0,
                    devamEden: 0,
                };
            }
            urunRapor[key].partiSayisi++;
            urunRapor[key].toplamAdet += (Number(p.toplamAdet) || 0);
            if (p.durum === 'tamamlandi') {
                urunRapor[key].tamamlanan += (Number(p.toplamAdet) || 0);
            } else {
                urunRapor[key].devamEden += (Number(p.toplamAdet) || 0);
            }
        });
        const urunListesi = Object.values(urunRapor).sort((a, b) => b.toplamAdet - a.toplamAdet);

        // ======== DİKİMHANE PERFORMANSI ========
        const dikimhaneler = firmalar.filter(f => f.tip === 'atolye');
        const dikimhaneRapor = dikimhaneler.map(f => {
            const atananPartiler = partiler.filter(p => p.dikimhaneId === f.id);
            const aktif = atananPartiler.filter(p => p.durum !== 'tamamlandi');
            const tamamlanan = atananPartiler.filter(p => p.durum === 'tamamlandi');
            const toplamAdet = atananPartiler.reduce((t, p) => t + (Number(p.toplamAdet) || 0), 0);
            const tamamlananAdet = tamamlanan.reduce((t, p) => t + (Number(p.toplamAdet) || 0), 0);

            // Tamamlanan atamalardan ortalama günlük üretim hesapla
            let toplamGun = 0;
            let toplamUretilen = 0;
            partiler.forEach(parti => {
                if (parti.firmaAtamalari) {
                    parti.firmaAtamalari.forEach(atama => {
                        if (atama.firmaId === f.id && atama.tamamlandi && atama.tarih && atama.tamamlanmaTarihi) {
                            const days = Math.max((new Date(atama.tamamlanmaTarihi) - new Date(atama.tarih)) / (1000 * 60 * 60 * 24), 0.5);
                            toplamGun += days;
                            toplamUretilen += (Number(atama.cikanAdet) || 0);
                        }
                    });
                }
            });
            const gunlukOrtalama = toplamGun > 0 ? Math.round(toplamUretilen / toplamGun) : 0;

            return {
                id: f.id,
                ad: f.ad,
                yetkili: f.yetkiliKisi,
                partiSayisi: atananPartiler.length,
                aktifParti: aktif.length,
                tamamlananParti: tamamlanan.length,
                toplamAdet,
                tamamlananAdet,
                gunlukOrtalama,
                kapasite: f.gunlukKapasite || 0,
                verimlilik: (f.gunlukKapasite && gunlukOrtalama) ? Math.round((gunlukOrtalama / f.gunlukKapasite) * 100) : 0,
            };
        }).sort((a, b) => b.toplamAdet - a.toplamAdet);

        // ======== CARİ DURUM ========
        const firmaCari = {};
        cariHareketler.forEach(h => {
            if (!firmaCari[h.firmaId]) {
                firmaCari[h.firmaId] = { borc: 0, odenen: 0 };
            }
            const tutar = Number(h.tutar) || 0;
            if (h.tip === 'borc') firmaCari[h.firmaId].borc += tutar;
            else firmaCari[h.firmaId].odenen += tutar;
        });

        const cariRapor = Object.entries(firmaCari).map(([firmaId, cari]) => {
            const firma = firmalar.find(f => f.id === firmaId);
            return {
                firmaId,
                firmaAd: firma?.ad || 'Bilinmeyen',
                firmaTip: firma?.tip || '',
                borc: cari.borc,
                odenen: cari.odenen,
                bakiye: cari.borc - cari.odenen,
            };
        }).sort((a, b) => b.bakiye - a.bakiye);

        const toplamBorc = cariRapor.reduce((t, c) => t + c.borc, 0);
        const toplamOdenen = cariRapor.reduce((t, c) => t + c.odenen, 0);
        const toplamBakiye = toplamBorc - toplamOdenen;

        // ======== AYLIK TREND (son 6 ay) ========
        const aylikTrend = [];
        const simdi = new Date();
        for (let i = 5; i >= 0; i--) {
            const ay = new Date(simdi.getFullYear(), simdi.getMonth() - i, 1);
            const aySonu = new Date(simdi.getFullYear(), simdi.getMonth() - i + 1, 0);
            const ayLabel = ay.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });

            const ayPartileri = partiler.filter(p => {
                const tarih = new Date(p.createdAt);
                return tarih >= ay && tarih <= aySonu;
            });

            aylikTrend.push({
                ay: ayLabel,
                partiSayisi: ayPartileri.length,
                toplamAdet: ayPartileri.reduce((t, p) => t + (Number(p.toplamAdet) || 0), 0),
            });
        }
        const maxAylikAdet = Math.max(...aylikTrend.map(a => a.toplamAdet), 1);

        return {
            toplamParti, aktifPartiler, tamamlananPartiler,
            toplamUretim, tamamlananUretim, aktifUretim, tamamlanmaOrani,
            durumDagilimi,
            urunListesi,
            dikimhaneRapor,
            cariRapor, toplamBorc, toplamOdenen, toplamBakiye,
            aylikTrend, maxAylikAdet,
        };
    }, [partiler, firmalar, urunler, cariHareketler]);

    // Raporun tabloları: Excel'de ayrı sayfalar, PDF'te alt alta
    const raporTablolari = () => {
        const r = reports;
        return [
            {
                ad: 'Özet', baslik: 'Üretim Özeti',
                sutunlar: [{ baslik: 'Gösterge', genislik: 28 }, { baslik: 'Değer', tip: 'sayi' }],
                satirlar: [
                    ['Toplam parti', r.toplamParti], ['Aktif parti', r.aktifPartiler], ['Tamamlanan parti', r.tamamlananPartiler],
                    ['Toplam üretim (adet)', r.toplamUretim], ['Tamamlanan (adet)', r.tamamlananUretim], ['Devam eden (adet)', r.aktifUretim],
                    ['Tamamlanma oranı (%)', r.tamamlanmaOrani],
                ],
            },
            {
                ad: 'Ürünler', baslik: 'Ürün Bazlı Üretim',
                sutunlar: [{ baslik: 'Ürün Kodu' }, { baslik: 'Ürün' }, { baslik: 'Parti', tip: 'sayi' }, { baslik: 'Toplam Adet', tip: 'sayi' }, { baslik: 'Tamamlanan', tip: 'sayi' }, { baslik: 'Devam Eden', tip: 'sayi' }],
                satirlar: r.urunListesi.map(u => [u.urunKodu, u.urunAdi, u.partiSayisi, u.toplamAdet, u.tamamlanan, u.devamEden]),
            },
            {
                ad: 'Dikimhaneler', baslik: 'Dikimhane Performansı',
                sutunlar: [{ baslik: 'Dikimhane' }, { baslik: 'Yetkili' }, { baslik: 'Parti', tip: 'sayi' }, { baslik: 'Aktif', tip: 'sayi' }, { baslik: 'Tamamlanan', tip: 'sayi' },
                    { baslik: 'Toplam Adet', tip: 'sayi' }, { baslik: 'Günlük Ort.', tip: 'sayi' }, { baslik: 'Kapasite', tip: 'sayi' }, { baslik: 'Verim (%)', tip: 'sayi' }],
                satirlar: r.dikimhaneRapor.map(d => [d.ad, d.yetkili || '', d.partiSayisi, d.aktifParti, d.tamamlananParti, d.toplamAdet, d.gunlukOrtalama, d.kapasite || null, d.verimlilik || null]),
            },
            {
                ad: 'Cari', baslik: 'Cari Durum',
                sutunlar: [{ baslik: 'Firma' }, { baslik: 'Tür' }, { baslik: 'Borç', tip: 'para' }, { baslik: 'Ödenen', tip: 'para' }, { baslik: 'Bakiye', tip: 'para' }],
                satirlar: r.cariRapor.map(c => [c.firmaAd, FIRMA_TIP_LABELS[c.firmaTip] || c.firmaTip, c.borc, c.odenen, c.bakiye]),
                toplamSatiri: ['TOPLAM', '', r.toplamBorc, r.toplamOdenen, r.toplamBakiye],
            },
            {
                ad: 'Model Kârlılığı', baslik: 'Model Maliyet ve Kârlılık',
                sutunlar: [{ baslik: 'Ürün Kodu' }, { baslik: 'Ürün' }, { baslik: 'Birim Maliyet', tip: 'para' }, { baslik: 'Satış Fiyatı', tip: 'para' }, { baslik: 'Marj %', tip: 'sayi' },
                    { baslik: 'Üretilen Adet', tip: 'sayi' }, { baslik: 'Tamamlanan Gelir', tip: 'para' }, { baslik: 'Gerçekleşen Kâr', tip: 'para' }],
                satirlar: karlilik.modeller.map(m => [m.urunKodu, m.urunAdi, m.birimMaliyet, m.satis, m.marj === null ? null : Math.round(m.marj * 10) / 10, m.uretilen, m.gelir, m.kar]),
            },
            {
                ad: 'Atölye Fason', baslik: 'Atölye Bazında Fason Maliyeti',
                sutunlar: [{ baslik: 'Firma' }, { baslik: 'Tür' }, { baslik: 'Parti', tip: 'sayi' }, { baslik: 'Adet', tip: 'sayi' }, { baslik: 'Toplam Fason', tip: 'para' }, { baslik: 'Adet Başı', tip: 'para' }],
                satirlar: karlilik.atolyeler.map(a => [a.ad, FIRMA_TIP_LABELS[a.tip] || a.tip, a.parti, a.adet, a.toplam, a.adetBasi]),
            },
            {
                ad: 'Aylık Trend', baslik: 'Son 6 Ay',
                sutunlar: [{ baslik: 'Ay' }, { baslik: 'Parti', tip: 'sayi' }, { baslik: 'Adet', tip: 'sayi' }],
                satirlar: r.aylikTrend.map(a => [a.ay, a.partiSayisi, a.toplamAdet]),
            },
        ];
    };
    const tarihMetni = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    const excelAl = () => excelIndir('Rapor', raporTablolari().map(t => ({ ...t, ustBilgi: [`HİS ERP — ${t.baslik}`, tarihMetni] })));
    const pdfAl = () => raporYazdir({
        baslik: 'Üretim ve Cari Raporu', altBaslik: tarihMetni, yatay: true,
        ozet: [
            { etiket: 'Toplam parti', deger: String(reports.toplamParti) },
            { etiket: 'Toplam üretim', deger: `${reports.toplamUretim.toLocaleString('tr-TR')} adet` },
            { etiket: 'Tamamlanma', deger: `%${reports.tamamlanmaOrani}` },
            { etiket: 'Cari bakiye', deger: tlBicim(reports.toplamBakiye), vurgu: true },
        ],
        tablolar: raporTablolari().slice(1),
    });

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Raporlar</h1>
                    <span className="text-sm text-muted">{tarihMetni}</span>
                </div>
                <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost" onClick={excelAl}><FileSpreadsheet size={18} /> Excel</button>
                    <button className="btn btn-ghost" onClick={pdfAl}><FileText size={18} /> PDF</button>
                </div>
            </div>

            {/* ======== ÜST ÖZET KARTLARI ======== */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '28px' }}>
                <div className="stat-card blue">
                    <div className="stat-icon"><Layers size={22} /></div>
                    <div className="stat-value">{reports.toplamParti}</div>
                    <div className="stat-label">Toplam Parti</div>
                </div>
                <div className="stat-card orange">
                    <div className="stat-icon"><TrendingUp size={22} /></div>
                    <div className="stat-value">{reports.aktifPartiler.length}</div>
                    <div className="stat-label">Aktif Parti</div>
                </div>
                <div className="stat-card green">
                    <div className="stat-icon"><Award size={22} /></div>
                    <div className="stat-value">{reports.tamamlanmaOrani}%</div>
                    <div className="stat-label">Tamamlanma Oranı</div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-icon"><Package size={22} /></div>
                    <div className="stat-value">{reports.toplamUretim.toLocaleString('tr-TR')}</div>
                    <div className="stat-label">Toplam Üretim (adet)</div>
                </div>
                <div className="stat-card red">
                    <div className="stat-icon"><Wallet size={22} /></div>
                    <div className="stat-value">₺{reports.toplamBakiye.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}</div>
                    <div className="stat-label">Toplam Bakiye</div>
                </div>
            </div>

            {/* ======== 2 SÜTUN LAYOUT ======== */}
            <div className="report-grid-2col">
                {/* --- PARTİ DURUM DAĞILIMI --- */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><PieChart size={18} /> Parti Durum Dağılımı</h3>
                    </div>
                    <div className="hbar-list">
                        {Object.entries(reports.durumDagilimi).map(([durum, sayi]) => {
                            const pct = reports.toplamParti > 0 ? Math.round((sayi / reports.toplamParti) * 100) : 0;
                            return (
                                <div key={durum} className={`renk-${durum}`}>
                                    <div className="hbar-head">
                                        <span>{DURUM_LABELS[durum] || durum}</span>
                                        <span>{sayi} parti · {pct}%</span>
                                    </div>
                                    <div className="hbar-track">
                                        <div className="hbar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                        {Object.keys(reports.durumDagilimi).length === 0 && (
                            <div className="text-sm text-muted" style={{ padding: '20px', textAlign: 'center' }}>Henüz parti yok</div>
                        )}
                    </div>
                </div>

                {/* --- AYLIK ÜRETİM TRENDİ --- */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><Calendar size={18} /> Aylık Üretim Trendi</h3>
                    </div>
                    <BarChart
                        data={reports.aylikTrend.map(ay => ({ label: ay.ay, value: ay.toplamAdet, sub: `${ay.partiSayisi} parti` }))}
                        height={200}
                        barWidth={32}
                        highlight="last"
                    />
                </div>
            </div>

            {/* ======== ÜRÜN BAZLI ÜRETİM ======== */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <h3 className="card-title"><Package size={18} /> Ürün Bazlı Üretim</h3>
                    <span className="text-sm text-muted">{reports.urunListesi.length} ürün</span>
                </div>

                {reports.urunListesi.length === 0 ? (
                    <div className="text-sm text-muted" style={{ padding: '24px', textAlign: 'center' }}>Henüz üretim verisi yok</div>
                ) : (
                    <>
                        <div className="desktop-only">
                            <div className="table-container" style={{ border: 'none' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Ürün Kodu</th>
                                            <th>Ürün Adı</th>
                                            <th style={{ textAlign: 'center' }}>Parti Sayısı</th>
                                            <th style={{ textAlign: 'right' }}>Toplam Adet</th>
                                            <th style={{ textAlign: 'right' }}>Tamamlanan</th>
                                            <th style={{ textAlign: 'right' }}>Devam Eden</th>
                                            <th style={{ minWidth: '120px' }}>İlerleme</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reports.urunListesi.map((u, i) => {
                                            const pct = u.toplamAdet > 0 ? Math.round((u.tamamlanan / u.toplamAdet) * 100) : 0;
                                            return (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 600 }}>{u.urunKodu}</td>
                                                    <td>{u.urunAdi}</td>
                                                    <td style={{ textAlign: 'center' }}>{u.partiSayisi}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{u.toplamAdet.toLocaleString('tr-TR')}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--accent-success)' }}>{u.tamamlanan.toLocaleString('tr-TR')}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--accent-warning)' }}>{u.devamEden.toLocaleString('tr-TR')}</td>
                                                    <td>
                                                        <div className="workload-bar-wrapper">
                                                            <div className="workload-bar">
                                                                <div className="workload-bar-fill normal" style={{ width: `${pct}%` }} />
                                                            </div>
                                                            <span className="workload-bar-label">{pct}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="mobile-only">
                            <div className="mobile-list" style={{ margin: 0 }}>
                                {reports.urunListesi.map((u, i) => {
                                    const pct = u.toplamAdet > 0 ? Math.round((u.tamamlanan / u.toplamAdet) * 100) : 0;
                                    return (
                                        <div key={i} className="mobile-list-item">
                                            <div className="mobile-list-item-header">
                                                <span className="mobile-list-item-title">{u.urunKodu}</span>
                                                <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{u.toplamAdet.toLocaleString('tr-TR')} ad.</span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', marginBottom: '6px' }}>{u.urunAdi}</div>
                                            <div className="workload-bar-wrapper" style={{ marginBottom: '4px' }}>
                                                <div className="workload-bar">
                                                    <div className="workload-bar-fill normal" style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="workload-bar-label">{pct}%</span>
                                            </div>
                                            <div className="mobile-list-item-meta">
                                                <span>{u.partiSayisi} parti</span>
                                                <span style={{ color: 'var(--accent-success)' }}>Tamamlanan {u.tamamlanan.toLocaleString('tr-TR')}</span>
                                                <span style={{ color: 'var(--accent-warning)' }}>Devam eden {u.devamEden.toLocaleString('tr-TR')}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ======== DİKİMHANE PERFORMANSI ======== */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <h3 className="card-title"><Factory size={18} /> Dikimhane Performansı</h3>
                    <span className="text-sm text-muted">{reports.dikimhaneRapor.length} dikimhane</span>
                </div>

                {reports.dikimhaneRapor.length === 0 ? (
                    <div className="text-sm text-muted" style={{ padding: '24px', textAlign: 'center' }}>Henüz dikimhane verisi yok</div>
                ) : (
                    <>
                        <div className="desktop-only">
                            <div className="table-container" style={{ border: 'none' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Dikimhane</th>
                                            <th style={{ textAlign: 'center' }}>Aktif</th>
                                            <th style={{ textAlign: 'center' }}>Tamamlanan</th>
                                            <th style={{ textAlign: 'right' }}>Toplam Adet</th>
                                            <th style={{ textAlign: 'right' }}>Günlük Ort.</th>
                                            <th style={{ textAlign: 'right' }}>Kapasite</th>
                                            <th style={{ minWidth: '120px' }}>Verimlilik</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reports.dikimhaneRapor.map(d => (
                                            <tr key={d.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{d.ad}</div>
                                                    {d.yetkili && <div className="text-xs text-muted">{d.yetkili}</div>}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className="badge dikimde" style={{ fontSize: '0.7rem' }}>{d.aktifParti}</span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className="badge tamamlandi" style={{ fontSize: '0.7rem' }}>{d.tamamlananParti}</span>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{d.toplamAdet.toLocaleString('tr-TR')}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600, color: d.gunlukOrtalama > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                                                    {d.gunlukOrtalama > 0 ? `${d.gunlukOrtalama} ad/gün` : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {d.kapasite > 0 ? `${d.kapasite} ad/gün` : '-'}
                                                </td>
                                                <td>
                                                    {d.verimlilik > 0 ? (
                                                        <div className="workload-bar-wrapper">
                                                            <div className="workload-bar">
                                                                <div className={`workload-bar-fill ${d.verimlilik >= 80 ? 'normal' : d.verimlilik >= 50 ? 'uyari' : 'kritik'}`}
                                                                    style={{ width: `${Math.min(d.verimlilik, 100)}%` }}
                                                                />
                                                            </div>
                                                            <span className="workload-bar-label">{d.verimlilik}%</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted">Veri yok</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="mobile-only">
                            <div className="mobile-list" style={{ margin: 0 }}>
                                {reports.dikimhaneRapor.map(d => (
                                    <div key={d.id} className="mobile-list-item">
                                        <div className="mobile-list-item-header">
                                            <span className="mobile-list-item-title">{d.ad}</span>
                                            {d.gunlukOrtalama > 0 && (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                                    {d.gunlukOrtalama} ad/gün
                                                </span>
                                            )}
                                        </div>
                                        <div className="mobile-list-item-meta" style={{ marginBottom: '6px' }}>
                                            <span>{d.toplamAdet.toLocaleString('tr-TR')} adet</span>
                                            <span>Aktif: {d.aktifParti}</span>
                                            <span>Biten: {d.tamamlananParti}</span>
                                        </div>
                                        {d.verimlilik > 0 && (
                                            <div className="workload-bar-wrapper">
                                                <div className="workload-bar">
                                                    <div className={`workload-bar-fill ${d.verimlilik >= 80 ? 'normal' : d.verimlilik >= 50 ? 'uyari' : 'kritik'}`}
                                                        style={{ width: `${Math.min(d.verimlilik, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="workload-bar-label">{d.verimlilik}%</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ======== MALİYET VE KÂRLILIK ======== */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <h3 className="card-title"><TrendingUp size={18} /> Model Maliyet ve Kârlılık</h3>
                    <span className="text-sm text-muted">{karlilik.modeller.length} model</span>
                </div>
                {karlilik.modeller.length === 0 ? (
                    <div className="text-sm text-muted" style={{ padding: '16px', textAlign: 'center' }}>
                        Henüz maliyet kartı olan model yok. Ürünler sayfasında modelin <strong>Maliyet kartı</strong> düğmesiyle kumaş, aksesuar ve satış fiyatını girin.
                    </div>
                ) : (
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Model</th>
                                    <th style={{ textAlign: 'right' }}>Birim Maliyet</th>
                                    <th style={{ textAlign: 'right' }}>Satış</th>
                                    <th style={{ textAlign: 'right' }}>Marj</th>
                                    <th style={{ textAlign: 'right' }}>Üretilen</th>
                                    <th style={{ textAlign: 'right' }}>Gerçekleşen Kâr</th>
                                </tr>
                            </thead>
                            <tbody>
                                {karlilik.modeller.map(m => (
                                    <tr key={m.id}>
                                        <td><div style={{ fontWeight: 600 }}>{m.urunKodu}</div><div className="text-xs text-muted">{m.urunAdi}</div></td>
                                        <td style={{ textAlign: 'right' }}>{paraBicim(m.birimMaliyet)}</td>
                                        <td style={{ textAlign: 'right' }}>{m.satis !== null ? paraBicim(m.satis) : '—'}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: m.marj === null ? 'var(--text-muted)' : m.marj < 0 ? 'var(--color-danger)' : m.marj < m.hedef ? 'var(--color-warning)' : 'var(--color-success)' }}>
                                            {m.marj === null ? '—' : `%${m.marj.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{m.uretilen.toLocaleString('tr-TR')}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{m.kar !== null && m.tamamlananAdet ? paraBicim(m.kar) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {karlilik.atolyeler.length > 0 && (
                    <>
                        <h4 style={{ margin: '20px 0 8px', fontSize: '0.9rem' }}>Atölye bazında fason maliyeti</h4>
                        <div className="table-container" style={{ border: 'none' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Firma</th>
                                        <th style={{ textAlign: 'right' }}>Parti</th>
                                        <th style={{ textAlign: 'right' }}>Adet</th>
                                        <th style={{ textAlign: 'right' }}>Toplam Fason</th>
                                        <th style={{ textAlign: 'right' }}>Adet Başı</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {karlilik.atolyeler.map(a => (
                                        <tr key={a.ad}>
                                            <td><span style={{ fontWeight: 600 }}>{a.ad}</span> <span className={`badge ${firmaRozetSinifi(a.tip)}`} style={{ marginLeft: '6px' }}>{FIRMA_TIP_LABELS[a.tip] || a.tip}</span></td>
                                            <td style={{ textAlign: 'right' }}>{a.parti}</td>
                                            <td style={{ textAlign: 'right' }}>{a.adet.toLocaleString('tr-TR')}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{paraBicim(a.toplam)}</td>
                                            <td style={{ textAlign: 'right' }}>{paraBicim(a.adetBasi)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* ======== CARİ DURUM ======== */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <h3 className="card-title"><Wallet size={18} /> Cari Durum Özeti</h3>
                </div>

                {/* Cari Toplam */}
                <div className="cari-summary-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: '20px' }}>
                    <MetricTile tone="danger" label={<><ArrowUpRight size={14} /> Toplam Borç</>} value={`₺${reports.toplamBorc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`} />
                    <MetricTile tone="success" label={<><ArrowDownRight size={14} /> Toplam Ödenen</>} value={`₺${reports.toplamOdenen.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`} />
                    <MetricTile tone="primary" label="Net Bakiye" value={`₺${reports.toplamBakiye.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`} />
                </div>

                {reports.cariRapor.length === 0 ? (
                    <div className="text-sm text-muted" style={{ padding: '16px', textAlign: 'center' }}>Henüz cari hareket yok</div>
                ) : (
                    <>
                        <div className="desktop-only">
                            <div className="table-container" style={{ border: 'none' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Firma</th>
                                            <th>Tip</th>
                                            <th style={{ textAlign: 'right' }}>Borç</th>
                                            <th style={{ textAlign: 'right' }}>Ödenen</th>
                                            <th style={{ textAlign: 'right' }}>Bakiye</th>
                                            <th style={{ minWidth: '100px' }}>Ödeme Oranı</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reports.cariRapor.map(c => {
                                            const pct = c.borc > 0 ? Math.round((c.odenen / c.borc) * 100) : 0;
                                            return (
                                                <tr key={c.firmaId}>
                                                    <td style={{ fontWeight: 600 }}>{c.firmaAd}</td>
                                                    <td>
                                                        <span className={`badge ${firmaRozetSinifi(c.firmaTip)}`}>
                                                            {FIRMA_TIP_LABELS[c.firmaTip] || c.firmaTip}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: 'var(--accent-danger)' }}>₺{c.borc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right', color: 'var(--accent-success)' }}>₺{c.odenen.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: c.bakiye > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                                                        ₺{c.bakiye.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td>
                                                        <div className="workload-bar-wrapper">
                                                            <div className="workload-bar">
                                                                <div className={`workload-bar-fill ${pct >= 80 ? 'normal' : pct >= 40 ? 'uyari' : 'kritik'}`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                            <span className="workload-bar-label">{pct}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="mobile-only">
                            <div className="mobile-list" style={{ margin: 0 }}>
                                {reports.cariRapor.map(c => {
                                    const pct = c.borc > 0 ? Math.round((c.odenen / c.borc) * 100) : 0;
                                    return (
                                        <div key={c.firmaId} className="mobile-list-item">
                                            <div className="mobile-list-item-header">
                                                <span className="mobile-list-item-title">{c.firmaAd}</span>
                                                <span style={{ fontWeight: 700, color: c.bakiye > 0 ? 'var(--accent-danger)' : 'var(--accent-success)', fontSize: '0.85rem' }}>
                                                    ₺{c.bakiye.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="mobile-list-item-meta">
                                                <span style={{ color: 'var(--accent-danger)' }}>Borç: ₺{c.borc.toLocaleString('tr-TR')}</span>
                                                <span style={{ color: 'var(--accent-success)' }}>Ödenen: ₺{c.odenen.toLocaleString('tr-TR')}</span>
                                            </div>
                                            <div className="workload-bar-wrapper" style={{ marginTop: '6px' }}>
                                                <div className="workload-bar">
                                                    <div className={`workload-bar-fill ${pct >= 80 ? 'normal' : pct >= 40 ? 'uyari' : 'kritik'}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="workload-bar-label">{pct}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
