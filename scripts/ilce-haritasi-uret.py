# İstanbul ve çevresi ilçe sınırlarını geoBoundaries (OpenStreetMap kaynaklı, ODbL) verisinden
# sadeleştirerek src/data/istanbulIlceler.json dosyasını üretir.
# Kaynak: https://www.geoboundaries.org  (TUR ADM2, gbOpen)  — © OpenStreetMap katkıcıları, ODbL 1.0
# Kullanım: python3 scripts/ilce-haritasi-uret.py geoBoundaries-TUR-ADM2_simplified.geojson
import json, sys, math

KUTU = (27.95, 40.78, 29.95, 41.62)  # İstanbul il alanı (+ Gebze çevresi)
TOLERANS = 0.0009                     # derece (~90 m) — Douglas-Peucker
AD_DUZELT = {'Prince Islands': 'Adalar'}

def dp(nokta, tol):
    if len(nokta) < 4: return nokta
    (x1, y1), (x2, y2) = nokta[0], nokta[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-12
    en, ei = 0, 0
    for i in range(1, len(nokta) - 1):
        x, y = nokta[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / L
        if d > en: en, ei = d, i
    if en <= tol: return [nokta[0], nokta[-1]]
    return dp(nokta[:ei + 1], tol)[:-1] + dp(nokta[ei:], tol)

def halka(h):
    # Kapalı halkada ilk = son nokta; iki parçaya bölüp ayrı sadeleştir
    if len(h) < 4: return None
    uzak = max(range(len(h)), key=lambda i: (h[i][0] - h[0][0]) ** 2 + (h[i][1] - h[0][1]) ** 2)
    s = dp(h[:uzak + 1], TOLERANS)[:-1] + dp(h[uzak:], TOLERANS)
    return [[round(x, 4), round(y, 4)] for x, y in s] if len(s) >= 4 else None

def merkez(halkalar):
    xs = [p[0] for h in halkalar for p in h]; ys = [p[1] for h in halkalar for p in h]
    return [round(sum(ys) / len(ys), 4), round(sum(xs) / len(xs), 4)]  # [lat, lng]

veri = json.load(open(sys.argv[1], encoding='utf-8'))
cikti = []
for f in veri['features']:
    g = f['geometry']
    poligonlar = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    tum = [p for pol in poligonlar for h in pol for p in h]
    cx = sum(p[0] for p in tum) / len(tum); cy = sum(p[1] for p in tum) / len(tum)
    if not (KUTU[0] < cx < KUTU[2] and KUTU[1] < cy < KUTU[3]): continue
    yeni = []
    for pol in poligonlar:
        dis = halka(pol[0])  # sadece dış halka (delikler basemap için gereksiz)
        if dis: yeni.append(dis)
    if not yeni: continue
    ad = AD_DUZELT.get(f['properties']['shapeName'], f['properties']['shapeName'])
    cikti.append({'ad': ad, 'merkez': merkez(yeni), 'poligonlar': yeni})

cikti.sort(key=lambda x: x['ad'])
json.dump({
    'kaynak': 'geoBoundaries (TUR ADM2) — © OpenStreetMap katkıcıları, Open Database License (ODbL) 1.0',
    'ilceler': cikti,
}, open('src/data/istanbulIlceler.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(cikti), 'ilçe yazıldı')
