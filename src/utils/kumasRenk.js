// "Buzi Ribana Lacivert" → { kumas: 'Buzi Ribana', renk: 'Lacivert' }
// Kumaşçı fişlerinde "Cinsi" çoğunlukla kumaş türü + renk olarak tek hücreye yazılır.
// Sondaki renk kelimeleri (ve "açık", "koyu", "melanj", "mavisi" gibi renk ekleri) renge ayrılır.
const RENK_KELIMELERI = new Set([
    'siyah', 'beyaz', 'lacivert', 'gri', 'antrasit', 'füme', 'kırmızı', 'bordo', 'mavi', 'indigo', 'saks',
    'turkuaz', 'yeşil', 'haki', 'bej', 'krem', 'ekru', 'vizon', 'kahve', 'kahverengi', 'taba', 'camel',
    'pembe', 'pudra', 'mor', 'lila', 'eflatun', 'sarı', 'hardal', 'turuncu', 'somon', 'fuşya', 'mint',
    'petrol', 'kiremit', 'kemik', 'natürel', 'taş', 'zümrüt', 'mercan', 'leylak', 'vişne', 'mürdüm',
    'kum', 'toprak', 'zeytin', 'çağla', 'ördek', 'buz', 'bebe', 'gül', 'nar', 'altın', 'gümüş',
    'koyu', 'açık', 'melanj', 'mavisi', 'yeşili', 'grisi', 'beji', 'pembesi', 'moru', 'kurusu', 'rengi', 'tonu',
]);

export function renkAyir(metin) {
    const kelimeler = String(metin ?? '').trim().split(/\s+/).filter(Boolean);
    let i = kelimeler.length;
    // En az bir kelime kumaş adı olarak kalır
    while (i > 1 && RENK_KELIMELERI.has(kelimeler[i - 1].toLocaleLowerCase('tr'))) i--;
    // "Açık", "Koyu" gibi ekler tek başına renk değildir
    const renkKelimeleri = kelimeler.slice(i);
    const gercekRenk = renkKelimeleri.some(k => !['koyu', 'açık', 'melanj', 'rengi', 'tonu'].includes(k.toLocaleLowerCase('tr')));
    if (!gercekRenk) return { kumas: kelimeler.join(' '), renk: '' };
    return { kumas: kelimeler.slice(0, i).join(' '), renk: renkKelimeleri.join(' ') };
}
