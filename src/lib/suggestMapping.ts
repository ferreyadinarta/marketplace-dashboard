// Bantu memetakan SKU marketplace → product DASAR di Master Product.
//
// Judul listing marketplace penuh kata jualan ("BIG PROMO! ... BPOM ORIGINAL"),
// dan satu product dasar bisa punya banyak varian ("1 box 16 sachet", "10 sachet").
// Di sini: tebak berapa satuan dasar per unit + tebak product mana yang cocok.
// Hasilnya hanya SARAN — user tetap yang memutuskan di halaman Mapping SKU.

// Kata jualan/kemasan yang tidak membantu mencocokkan nama product.
const NOISE = new Set([
  "promo", "big", "free", "gratis", "bonus", "gosend", "bisa", "instant", "sameday",
  "original", "ori", "asli", "bpom", "resmi", "official", "store", "termurah", "murah",
  "terlaris", "best", "seller", "new", "baru", "paket", "bundle", "dan", "untuk", "dll",
  "diet", "detox", "slimming", "pelangsing", "langsing", "sehat", "herbal",
  "box", "sachet", "sachets", "pouch", "pcs", "pack", "isi", "gr", "gram", "ml", "kg",
  "susu", "minuman", "drink", "meal", "replacement", "pengganti", "sarapan", "superfood",
  "keychain", "shaker", "gold", "silver", "varian", "rasa", "flavor",
]);

// Normalisasi → daftar token yang berarti (huruf/angka saja, buang kata jualan).
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length >= 3 && !NOISE.has(t) && !/^\d+$/.test(t));
}

// Bagian VARIAN = potongan setelah " - " terakhir (import menambahkannya dari
// model_name Shopee). Di situ biasanya ukuran/rasa yang sebenarnya.
export function variantOf(name: string): string {
  const i = name.lastIndexOf(" - ");
  return i >= 0 ? name.slice(i + 3) : name;
}

// Tebak berapa SATUAN DASAR (sachet) untuk 1 unit yang dijual.
// "Blackcurrant,1 BOX 16 sachet" → 16 · "10 sachet" → 10 · "1 POUCH Purto" → 1.
// Dibaca dari bagian varian dulu supaya angka di judul listing tidak salah ambil.
export function parseBaseQty(name: string): number {
  const tryParse = (s: string): number | null => {
    const m = s.match(/(\d{1,3})\s*(?:x\s*)?(?:sachet|saset|sct|pcs|stick|stik)\b/i);
    if (m) return Number(m[1]);
    const isi = s.match(/\bisi\s*(\d{1,3})\b/i);
    if (isi) return Number(isi[1]);
    return null;
  };
  const fromVariant = tryParse(variantOf(name));
  const n = fromVariant ?? tryParse(name);
  if (n == null || !Number.isFinite(n) || n < 1 || n > 500) return 1;
  return Math.floor(n);
}

export type ProductLite = { id: string; name: string; sku: string };
export type Suggestion = { productId: string; productName: string; score: number; baseQty: number };

// Cari product dasar yang paling cocok untuk sebuah nama listing marketplace.
// Skor = berapa banyak token nama product yang muncul di nama listing.
// Balikin null kalau tidak cukup yakin — lebih baik kosong daripada salah petakan.
export function suggestProduct(
  marketplaceName: string,
  products: ProductLite[],
  minScore = 0.6
): Suggestion | null {
  const hay = new Set(tokenize(marketplaceName));
  if (hay.size === 0) return null;

  let best: Suggestion | null = null;
  for (const p of products) {
    const tokens = tokenize(p.name);
    if (tokens.length === 0) continue;
    const hits = tokens.filter((t) => hay.has(t)).length;
    const score = hits / tokens.length;
    if (score < minScore) continue;
    // seri → menangkan yang tokennya lebih spesifik (lebih banyak)
    if (!best || score > best.score || (score === best.score && tokens.length > 0 && score === 1)) {
      best = {
        productId: p.id,
        productName: p.name,
        score,
        baseQty: parseBaseQty(marketplaceName),
      };
    }
  }
  return best;
}
