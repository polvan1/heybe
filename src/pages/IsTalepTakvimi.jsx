import { useApp } from '../context/AppContext';
import { DURUM_LABELS } from '../data/db';
import { AlertTriangle, Clock, Calendar, CheckCircle, BarChart3, TrendingUp } from 'lucide-react';

/**
 * İş Talep Takvimi — SADECE DİKİMHANELER
 *
 * Sistem, tamamlanan atamalardan ürün bazlı günlük kapasiteyi ÖĞRENIR:
 *   1. Firma X, Ürün Y için geçmişte yapılan işlere bakılır
 *   2. Her tamamlanan atamadan: çıkan adet / geçen gün = günlük üretim
 *   3. Ortalaması alınır → o firma + ürün için tahmini günlük kapasite
 *   4. Veri yoksa firma.gunlukKapasite (genel) kullanılır
 *
 * Kalan gün hesabı: eldeki toplam iş / tahmini günlük kapasite
 * Kritik tarih: bugün + kalan gün
 */

// Tamamlanan atamalardan ürün bazlı günlük kapasite hesapla
function calculateLearnedCapacities(firmalar, partiler) {
    // { firmaId: { urunId: { totalPieces, totalDays, count } } }
    const history = {};

    partiler.forEach(parti => {
        const urunId = parti.urunId || 'unknown';
        const firmaId = parti.dikimhaneId;

        // YENİ SİSTEM: parti üzerindeki dikimBaslamaTarihi ve dikimBitisTarihi
        if (parti.dikimBaslamaTarihi && parti.dikimBitisTarihi && firmaId) {
            const cikanAdet = parti.dikimdenCikanAdet || parti.toplamAdet;
            
            if (cikanAdet > 0) {
                const start = new Date(parti.dikimBaslamaTarihi);
                const end = new Date(parti.dikimBitisTarihi);
                const diffMs = end - start;
                const diffDays = Math.max(diffMs / (1000 * 60 * 60 * 24), 0.5); // En az yarım gün

                if (!history[firmaId]) history[firmaId] = {};
                if (!history[firmaId][urunId]) {
                    history[firmaId][urunId] = { totalPieces: 0, totalDays: 0, count: 0, records: [] };
                }

                const dailyRate = cikanAdet / diffDays;

                history[firmaId][urunId].totalPieces += cikanAdet;
                history[firmaId][urunId].totalDays += diffDays;
                history[firmaId][urunId].count += 1;
                history[firmaId][urunId].records.push({
                    partiNo: parti.partiNo,
                    urunAdi: parti.urunAdi,
                    adet: cikanAdet,
                    gun: Math.round(diffDays * 10) / 10,
                    gunlukUretim: Math.round(dailyRate),
                });
                return; // Yeni sistemde veri bulunduysa eski sisteme bakmaya gerek yok
            }
        }

        // ESKİ SİSTEM: firmaAtamalari dizisi (Geçmiş verilerin kaybolmaması için destek)
        if (!parti.firmaAtamalari) return;

        parti.firmaAtamalari.forEach(atama => {
            if (!atama.tamamlandi || !atama.tamamlanmaTarihi || !atama.tarih) return;
            // Sadece dikim adımındaki atamaları say
            if (atama.adim !== 'dikimde') return;

            const eqFirmaId = atama.firmaId;
            const cikanAdet = atama.cikanAdet || 0;

            if (cikanAdet <= 0 || !eqFirmaId) return;

            const start = new Date(atama.tarih);
            const end = new Date(atama.tamamlanmaTarihi);
            const diffMs = end - start;
            const diffDays = Math.max(diffMs / (1000 * 60 * 60 * 24), 0.5); // En az yarım gün

            if (!history[eqFirmaId]) history[eqFirmaId] = {};
            if (!history[eqFirmaId][urunId]) {
                history[eqFirmaId][urunId] = { totalPieces: 0, totalDays: 0, count: 0, records: [] };
            }

            const dailyRate = cikanAdet / diffDays;

            history[eqFirmaId][urunId].totalPieces += cikanAdet;
            history[eqFirmaId][urunId].totalDays += diffDays;
            history[eqFirmaId][urunId].count += 1;
            history[eqFirmaId][urunId].records.push({
                partiNo: parti.partiNo,
                urunAdi: parti.urunAdi,
                adet: cikanAdet,
                gun: Math.round(diffDays * 10) / 10,
                gunlukUretim: Math.round(dailyRate),
            });
        });
    });

    return history;
}

// Belirli bir firma + ürün için tahmini günlük kapasite
function getEstimatedDailyCapacity(firmaId, urunId, history, firmaGunlukKapasite) {
    if (history[firmaId] && history[firmaId][urunId]) {
        const h = history[firmaId][urunId];
        // Toplam üretim / toplam gün = ağırlıklı ortalama
        return {
            kapasite: Math.round(h.totalPieces / h.totalDays),
            kaynak: 'ogrenilmis', // Öğrenilmiş veri
            veriSayisi: h.count,
        };
    }
    // Genel firma kapasitesine düş
    if (firmaGunlukKapasite && firmaGunlukKapasite > 0) {
        return {
            kapasite: firmaGunlukKapasite,
            kaynak: 'varsayilan', // Varsayılan (firma genel)
            veriSayisi: 0,
        };
    }
    return { kapasite: 0, kaynak: 'yok', veriSayisi: 0 };
}

function calculateDikimhaneWorkload(firma, partiler, history) {
    // Sadece dikimde olan ve bu firmaya atanmış partileri al
    const aktifPartiler = partiler.filter(p =>
        p.dikimhaneId === firma.id &&
        p.durum === 'dikimde' &&
        p.durum !== 'tamamlandi'
    );

    // Ürün bazlı iş yükü grupla
    const urunGruplari = {};

    aktifPartiler.forEach(p => {
        const urunId = p.urunId || 'unknown';
        const kalanAdet = p.kalanAdet || p.toplamAdet || 0;

        if (kalanAdet <= 0) return;

        if (!urunGruplari[urunId]) {
            urunGruplari[urunId] = {
                urunId,
                urunKodu: p.urunKodu,
                urunAdi: p.urunAdi,
                toplamAdet: 0,
                partiler: [],
            };
        }

        urunGruplari[urunId].toplamAdet += kalanAdet;
        urunGruplari[urunId].partiler.push({
            partiNo: p.partiNo,
            kalanAdet,
        });
    });

    // Her ürün grubu için kalan gün hesapla
    let toplamIs = 0;
    let agirlikliKalanGun = 0;
    const urunDetaylari = [];

    Object.values(urunGruplari).forEach(grup => {
        const cap = getEstimatedDailyCapacity(firma.id, grup.urunId, history, firma.gunlukKapasite);
        const kalanGun = cap.kapasite > 0 ? grup.toplamAdet / cap.kapasite : (grup.toplamAdet > 0 ? 999 : 0);

        toplamIs += grup.toplamAdet;
        agirlikliKalanGun = Math.max(agirlikliKalanGun, kalanGun); // En uzun sürecek ürüne göre

        urunDetaylari.push({
            ...grup,
            gunlukKapasite: cap.kapasite,
            kaynak: cap.kaynak,
            veriSayisi: cap.veriSayisi,
            kalanGun: Math.round(kalanGun * 10) / 10,
        });
    });

    // Kritik tarih hesapla
    const bugun = new Date();
    const kritikTarih = new Date(bugun);
    kritikTarih.setDate(kritikTarih.getDate() + Math.ceil(agirlikliKalanGun));

    // Doluluk: genel kapasite üzerinden
    const genelKapasite = firma.gunlukKapasite || 0;
    const doluluk = genelKapasite > 0 ? Math.min((toplamIs / genelKapasite) * 100, 100) : 0;

    // Durum belirle
    let durum = 'normal';
    if (agirlikliKalanGun <= 2 && toplamIs > 0) durum = 'kritik';
    else if (agirlikliKalanGun <= 5 && toplamIs > 0) durum = 'uyari';

    // Firma için öğrenilmiş veri sayısı
    const ogrenilmisVeri = history[firma.id]
        ? Object.values(history[firma.id]).reduce((t, h) => t + h.count, 0)
        : 0;

    return {
        firma,
        toplamIs,
        kalanGun: Math.round(agirlikliKalanGun * 10) / 10,
        doluluk,
        kritikTarih,
        durum,
        urunDetaylari,
        ogrenilmisVeri,
        aktifPartiSayisi: aktifPartiler.length,
    };
}

function formatDate(date) {
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

export default function IsTalepTakvimi() {
    const { firmalar, partiler } = useApp();

    // Sadece dikimhaneler (atölyeler)
    const dikimhaneler = firmalar.filter(f => f.tip === 'atolye');

    // Geçmiş veriden kapasite öğren
    const history = calculateLearnedCapacities(firmalar, partiler);

    // Her dikimhane için iş yükü hesapla
    const workloads = dikimhaneler
        .map(f => calculateDikimhaneWorkload(f, partiler, history))
        .sort((a, b) => {
            const priority = { kritik: 0, uyari: 1, normal: 2 };
            if (priority[a.durum] !== priority[b.durum]) {
                return priority[a.durum] - priority[b.durum];
            }
            return b.toplamIs - a.toplamIs; // Daha çok iş olan önce
        });

    const kritikSayisi = workloads.filter(w => w.durum === 'kritik').length;
    const uyariSayisi = workloads.filter(w => w.durum === 'uyari').length;
    const toplamOgrenilmis = workloads.reduce((t, w) => t + w.ogrenilmisVeri, 0);

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">İş Talep Takvimi</h1>
                <span className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <BarChart3 size={14} /> Sadece Dikimhaneler
                </span>
            </div>

            {/* AI Badge */}
            <div style={{
                padding: '12px 16px',
                background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(99,102,241,0.06))',
                border: '1px solid rgba(37,99,235,0.15)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
            }}>
                <TrendingUp size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <div>
                    <strong style={{ color: 'var(--accent-primary)' }}>Akıllı Kapasite:</strong>{' '}
                    {toplamOgrenilmis > 0
                        ? `${toplamOgrenilmis} tamamlanmış iş verisinden ürün bazlı kapasite öğrenildi. Sistem her tamamlanan işle daha doğru tahmin yapar.`
                        : 'Henüz tamamlanan iş verisi yok. İşler tamamlandıkça sistem ürün bazlı kapasite öğrenecek. Şimdilik firmaların genel günlük kapasite değeri kullanılıyor.'
                    }
                </div>
            </div>

            {/* Summary Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
                <div className="stat-card red">
                    <div className="stat-icon"><AlertTriangle size={22} /></div>
                    <div className="stat-value">{kritikSayisi}</div>
                    <div className="stat-label">Kritik (≤2 Gün)</div>
                </div>
                <div className="stat-card orange">
                    <div className="stat-icon"><Clock size={22} /></div>
                    <div className="stat-value">{uyariSayisi}</div>
                    <div className="stat-label">Uyarı (≤5 Gün)</div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-icon"><BarChart3 size={22} /></div>
                    <div className="stat-value">{dikimhaneler.length}</div>
                    <div className="stat-label">Dikimhane</div>
                </div>
            </div>

            {dikimhaneler.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Calendar size={48} /></div>
                    <div className="empty-state-title">Dikimhane yok</div>
                    <div className="empty-state-text">Firmalar sayfasından "Atölye" tipinde firma ekleyin</div>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="desktop-only">
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Dikimhane</th>
                                        <th style={{ textAlign: 'right' }}>Eldeki İş</th>
                                        <th style={{ textAlign: 'center' }}>Aktif Parti</th>
                                        <th style={{ minWidth: '180px' }}>Doluluk</th>
                                        <th style={{ textAlign: 'right' }}>Kalan Gün</th>
                                        <th>Kritik Tarih</th>
                                        <th style={{ textAlign: 'center' }}>Kapasite Verisi</th>
                                        <th style={{ textAlign: 'center' }}>Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workloads.map(w => (
                                        <tr key={w.firma.id} className={w.durum === 'kritik' ? 'row-kritik' : w.durum === 'uyari' ? 'row-uyari' : ''}>
                                            <td style={{ fontWeight: 600 }}>
                                                {w.firma.ad}
                                                {w.firma.yetkiliKisi && <div className="text-xs text-muted">{w.firma.yetkiliKisi}</div>}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                {w.toplamIs > 0 ? `${w.toplamIs.toLocaleString('tr-TR')} adet` : <span className="text-muted">İş yok</span>}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{w.aktifPartiSayisi}</td>
                                            <td>
                                                <div className="workload-bar-wrapper">
                                                    <div className="workload-bar">
                                                        <div className={`workload-bar-fill ${w.durum}`} style={{ width: `${Math.min(w.doluluk, 100)}%` }} />
                                                    </div>
                                                    <span className="workload-bar-label">{Math.round(w.doluluk)}%</span>
                                                </div>
                                            </td>
                                            <td style={{
                                                textAlign: 'right', fontWeight: 700,
                                                color: w.durum === 'kritik' ? 'var(--accent-danger)' : w.durum === 'uyari' ? 'var(--accent-warning)' : 'var(--accent-success)'
                                            }}>
                                                {w.toplamIs === 0 ? '-' : `${w.kalanGun} gün`}
                                            </td>
                                            <td>
                                                {w.toplamIs === 0 ? (
                                                    <span className="text-muted">-</span>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Calendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                        <span style={{
                                                            fontWeight: 600,
                                                            color: w.durum === 'kritik' ? 'var(--accent-danger)' : w.durum === 'uyari' ? 'var(--accent-warning)' : 'var(--text-primary)'
                                                        }}>
                                                            {formatDate(w.kritikTarih)}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {w.ogrenilmisVeri > 0 ? (
                                                    <span className="badge dikimde" style={{ fontSize: '0.65rem' }}>
                                                        <TrendingUp size={10} /> {w.ogrenilmisVeri} veri
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted">Varsayılan</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {w.toplamIs === 0 ? (
                                                    <span className="workload-badge normal"><CheckCircle size={12} /> BOŞ</span>
                                                ) : w.durum === 'kritik' ? (
                                                    <span className="workload-badge kritik"><AlertTriangle size={12} /> ACİL</span>
                                                ) : w.durum === 'uyari' ? (
                                                    <span className="workload-badge uyari"><Clock size={12} /> YAKIN</span>
                                                ) : (
                                                    <span className="workload-badge normal"><CheckCircle size={12} /> NORMAL</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Ürün bazlı detay */}
                        {workloads.filter(w => w.urunDetaylari.length > 0).map(w => (
                            <details key={w.firma.id} className="workload-detail" style={{ marginTop: '12px' }}>
                                <summary className="workload-detail-summary">
                                    <span style={{ fontWeight: 600 }}>{w.firma.ad}</span>
                                    <span className="text-sm text-muted"> — Ürün Bazlı Kapasite Detayı</span>
                                </summary>
                                <div className="workload-detail-content">
                                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Ürün</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Kalan Adet</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Günlük Kapasite</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Kalan Gün</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Kaynak</th>
                                                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid var(--border-color)', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Partiler</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {w.urunDetaylari.map((u, i) => (
                                                <tr key={i}>
                                                    <td style={{ padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>
                                                        {u.urunKodu} — {u.urunAdi}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>
                                                        {u.toplamAdet.toLocaleString('tr-TR')}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid var(--border-color)' }}>
                                                        {u.gunlukKapasite > 0 ? `${u.gunlukKapasite} adet/gün` : '-'}
                                                    </td>
                                                    <td style={{
                                                        padding: '8px 12px', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid var(--border-color)',
                                                        color: u.kalanGun <= 2 ? 'var(--accent-danger)' : u.kalanGun <= 5 ? 'var(--accent-warning)' : 'var(--accent-success)'
                                                    }}>
                                                        {u.kalanGun} gün
                                                    </td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
                                                        {u.kaynak === 'ogrenilmis' ? (
                                                            <span style={{ color: 'var(--accent-primary)', fontSize: '0.7rem', fontWeight: 600 }}>
                                                                📊 {u.veriSayisi} iş verisi
                                                            </span>
                                                        ) : u.kaynak === 'varsayilan' ? (
                                                            <span className="text-xs text-muted">Genel kapasite</span>
                                                        ) : (
                                                            <span className="text-xs text-muted">Veri yok</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                            {u.partiler.map((p, j) => (
                                                                <span key={j} className="badge devam" style={{ fontSize: '0.6rem' }}>
                                                                    {p.partiNo} ({p.kalanAdet})
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        ))}

                        {/* Öğrenme geçmişi */}
                        {Object.keys(history).length > 0 && (
                            <details className="workload-detail" style={{ marginTop: '16px' }}>
                                <summary className="workload-detail-summary">
                                    <TrendingUp size={14} style={{ color: 'var(--accent-primary)' }} />
                                    <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Öğrenilmiş Kapasite Verileri</span>
                                    <span className="text-sm text-muted"> — Tamamlanmış işlerden hesaplanan ürün bazlı kapasiteler</span>
                                </summary>
                                <div className="workload-detail-content">
                                    {dikimhaneler.filter(f => history[f.id]).map(f => (
                                        <div key={f.id} style={{ marginBottom: '16px' }}>
                                            <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.85rem' }}>{f.ad}</div>
                                            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Ürün</th>
                                                        <th style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Toplam Üretim</th>
                                                        <th style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Toplam Gün</th>
                                                        <th style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Günlük Ort.</th>
                                                        <th style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Veri Sayısı</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(history[f.id]).map(([urunId, h]) => {
                                                        const avgDaily = Math.round(h.totalPieces / h.totalDays);
                                                        return (
                                                            <tr key={urunId}>
                                                                <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-color)' }}>
                                                                    {h.records[0]?.urunAdi || urunId}
                                                                </td>
                                                                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>
                                                                    {h.totalPieces.toLocaleString('tr-TR')} adet
                                                                </td>
                                                                <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid var(--border-color)' }}>
                                                                    {Math.round(h.totalDays * 10) / 10} gün
                                                                </td>
                                                                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)' }}>
                                                                    {avgDaily} adet/gün
                                                                </td>
                                                                <td style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
                                                                    {h.count}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>

                    {/* Mobile Cards */}
                    <div className="mobile-only">
                        <div className="mobile-list">
                            {workloads.map(w => (
                                <div key={w.firma.id} className={`mobile-list-item workload-card-${w.durum}`}>
                                    {/* Header */}
                                    <div className="mobile-list-item-header">
                                        <div>
                                            <span className="mobile-list-item-title">{w.firma.ad}</span>
                                            {w.firma.yetkiliKisi && <div className="text-xs text-muted">{w.firma.yetkiliKisi}</div>}
                                        </div>
                                        <div>
                                            {w.toplamIs === 0 ? (
                                                <span className="workload-badge normal"><CheckCircle size={12} /> BOŞ</span>
                                            ) : w.durum === 'kritik' ? (
                                                <span className="workload-badge kritik"><AlertTriangle size={12} /> ACİL</span>
                                            ) : w.durum === 'uyari' ? (
                                                <span className="workload-badge uyari"><Clock size={12} /> YAKIN</span>
                                            ) : (
                                                <span className="workload-badge normal"><CheckCircle size={12} /> NORMAL</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Meta */}
                                    <div className="mobile-list-item-meta" style={{ marginBottom: '8px' }}>
                                        <span>{w.toplamIs.toLocaleString('tr-TR')} adet iş</span>
                                        <span>{w.aktifPartiSayisi} parti</span>
                                        {w.ogrenilmisVeri > 0 && (
                                            <span style={{ color: 'var(--accent-primary)' }}>📊 {w.ogrenilmisVeri} veri</span>
                                        )}
                                    </div>

                                    {/* Bar */}
                                    <div className="workload-bar-wrapper" style={{ marginBottom: '10px' }}>
                                        <div className="workload-bar">
                                            <div className={`workload-bar-fill ${w.durum}`} style={{ width: `${Math.min(w.doluluk, 100)}%` }} />
                                        </div>
                                        <span className="workload-bar-label">{Math.round(w.doluluk)}%</span>
                                    </div>

                                    {/* Kalan gün ve Kritik tarih */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <div className="text-xs text-muted">Kalan Gün</div>
                                            <div style={{
                                                fontSize: '1.1rem', fontWeight: 700,
                                                color: w.durum === 'kritik' ? 'var(--accent-danger)' : w.durum === 'uyari' ? 'var(--accent-warning)' : 'var(--accent-success)'
                                            }}>
                                                {w.toplamIs === 0 ? 'İş yok' : `${w.kalanGun} gün`}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted">Kritik Tarih</div>
                                            <div style={{
                                                fontSize: '0.9rem', fontWeight: 600,
                                                color: w.durum === 'kritik' ? 'var(--accent-danger)' : w.durum === 'uyari' ? 'var(--accent-warning)' : 'var(--text-primary)'
                                            }}>
                                                {w.toplamIs === 0 ? '-' : formatDate(w.kritikTarih)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ürün detayları */}
                                    {w.urunDetaylari.length > 0 && (
                                        <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                                            {w.urunDetaylari.map((u, i) => (
                                                <div key={i} style={{ marginBottom: '6px', fontSize: '0.8rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 600 }}>{u.urunKodu}</span>
                                                        <span style={{ fontSize: '0.75rem', color: u.kalanGun <= 2 ? 'var(--accent-danger)' : u.kalanGun <= 5 ? 'var(--accent-warning)' : 'var(--text-muted)' }}>
                                                            {u.toplamAdet} adet → {u.kalanGun} gün
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-muted">
                                                        {u.kaynak === 'ogrenilmis' ? `📊 Öğrenilmiş: ${u.gunlukKapasite} adet/gün` : `Varsayılan: ${u.gunlukKapasite} adet/gün`}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
