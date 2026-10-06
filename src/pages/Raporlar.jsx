import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { DURUM_LABELS, FIRMA_TIP_LABELS } from '../data/db';
import {
    BarChart3, TrendingUp, Package, Layers, Wallet,
    Factory, Award, Calendar, PieChart, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export default function Raporlar() {
    const { partiler, firmalar, urunler, cariHareketler } = useApp();

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

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Raporlar</h1>
                <span className="text-sm text-muted">{new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}
                className="report-grid-2col"
            >
                {/* --- PARTİ DURUM DAĞILIMI --- */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"><PieChart size={18} /> Parti Durum Dağılımı</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {Object.entries(reports.durumDagilimi).map(([durum, sayi]) => {
                            const pct = reports.toplamParti > 0 ? Math.round((sayi / reports.toplamParti) * 100) : 0;
                            return (
                                <div key={durum}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                                        <span style={{ fontWeight: 600 }}>{DURUM_LABELS[durum] || durum}</span>
                                        <span className="text-muted">{sayi} parti ({pct}%)</span>
                                    </div>
                                    <div className="workload-bar">
                                        <div className={`workload-bar-fill ${durum === 'tamamlandi' ? 'normal' : durum === 'dikimde' ? 'uyari' : 'kritik'}`}
                                            style={{ width: `${pct}%` }}
                                        />
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
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '180px', padding: '12px 0' }}>
                        {reports.aylikTrend.map((ay, i) => {
                            const height = reports.maxAylikAdet > 0 ? (ay.toplamAdet / reports.maxAylikAdet) * 100 : 0;
                            return (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                        {ay.toplamAdet > 0 ? ay.toplamAdet.toLocaleString('tr-TR') : ''}
                                    </span>
                                    <div style={{
                                        width: '100%',
                                        maxWidth: '48px',
                                        height: `${Math.max(height, 2)}%`,
                                        background: `linear-gradient(180deg, var(--accent-primary), rgba(37,99,235,0.5))`,
                                        borderRadius: '6px 6px 2px 2px',
                                        transition: 'height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                                        minHeight: '4px',
                                    }} />
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ay.ay}</span>
                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{ay.partiSayisi}p</span>
                                </div>
                            );
                        })}
                    </div>
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
                                                <span style={{ color: 'var(--accent-success)' }}>✓ {u.tamamlanan.toLocaleString('tr-TR')}</span>
                                                <span style={{ color: 'var(--accent-warning)' }}>⏳ {u.devamEden.toLocaleString('tr-TR')}</span>
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

            {/* ======== CARİ DURUM ======== */}
            <div className="card" style={{ marginBottom: '24px' }}>
                <div className="card-header">
                    <h3 className="card-title"><Wallet size={18} /> Cari Durum Özeti</h3>
                </div>

                {/* Cari Toplam */}
                <div className="cari-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ padding: '16px', background: 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid rgba(239,68,68,0.12)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Toplam Borç</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <ArrowUpRight size={18} /> ₺{reports.toplamBorc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div style={{ padding: '16px', background: 'rgba(16,185,129,0.06)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid rgba(16,185,129,0.12)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Toplam Ödenen</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                            <ArrowDownRight size={18} /> ₺{reports.toplamOdenen.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div style={{ padding: '16px', background: 'rgba(37,99,235,0.06)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid rgba(37,99,235,0.12)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Net Bakiye</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                            ₺{reports.toplamBakiye.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
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
                                                        <span className={`badge ${c.firmaTip === 'atolye' ? 'dikimde' : c.firmaTip === 'kesimhane' ? 'kesimde' : c.firmaTip === 'baskici' ? 'baskida' : 'utupakette'}`} style={{ fontSize: '0.65rem' }}>
                                                            {FIRMA_TIP_LABELS[c.firmaTip] || c.firmaTip}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: '#ef4444' }}>₺{c.borc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right', color: '#10b981' }}>₺{c.odenen.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700, color: c.bakiye > 0 ? '#ef4444' : '#10b981' }}>
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
                                                <span style={{ fontWeight: 700, color: c.bakiye > 0 ? '#ef4444' : '#10b981', fontSize: '0.85rem' }}>
                                                    ₺{c.bakiye.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="mobile-list-item-meta">
                                                <span style={{ color: '#ef4444' }}>Borç: ₺{c.borc.toLocaleString('tr-TR')}</span>
                                                <span style={{ color: '#10b981' }}>Ödenen: ₺{c.odenen.toLocaleString('tr-TR')}</span>
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
