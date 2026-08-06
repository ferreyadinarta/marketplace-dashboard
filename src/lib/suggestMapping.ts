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

// Jumlah satuan DASAR yang disebut langsung (mis. "10 sachet" → 10).
function directBaseUnits(s: string): number | null {
  const m = s.match(/(\d{1,3})\s*(?:x\s*)?(?:sachet|saset|sct|pcs|stick|stik)\b/i);
  return m ? Number(m[1]) : null;
}

// Berapa BUNGKUS yang dijual dalam satu unit varian: "2 BOX" → 2, "1 POUCH" → 1.
// Dibaca dari bagian VARIAN saja — angka di judul listing ("1 box isi 12 sachet")
// menjelaskan isi per box, bukan berapa box yang dikirim.
export function parsePackMultiplier(name: string): number | null {
  const v = variantOf(name);
  const m = v.match(/(\d{1,3})\s*(?:x\s*)?(?:box|pouch|pack|paket|dus|karton|botol|btl|kaleng|jar|tub)\b/i);
  return m ? Number(m[1]) : null;
}

// Isi satu bungkus menurut judul listing: "1 box isi 12 sachet" → 12.
export function parsePerPack(name: string): number | null {
  const direct = directBaseUnits(name);
  if (direct != null) return direct;
  const isi = name.match(/\bisi\s*(\d{1,3})\b/i);
  return isi ? Number(isi[1]) : null;
}

// Tebak berapa SATUAN DASAR (mis. sachet) untuk 1 unit yang dijual.
//
// Kuncinya varian "2 BOX" HARUS dikali isi per box, kalau tidak stok cuma
// berkurang 1 box padahal yang dikirim 2:
//   "…1 box isi 12 sachet… - Milk Choco,2 BOX" → 2 × 12 = 24
//   "…1 box isi 16 sachet… - Blackcurrant,3 BOX" → 3 × 16 = 48
//   "Hotto Purto - 10 sachet" → 10 (varian sudah menyebut satuan dasar)
//
// `packSize` = isi per bungkus dari MASTER PRODUCT (kalau product-nya sudah
// diketahui). Itu lebih dipercaya daripada tebakan dari judul listing.
export function parseBaseQty(name: string, packSize?: number): number {
  const clamp = (n: number) => (Number.isFinite(n) && n >= 1 && n <= 5_000 ? Math.floor(n) : 1);

  // varian menyebut satuan dasar langsung → itu jawabannya
  const fromVariant = directBaseUnits(variantOf(name));
  if (fromVariant != null) return clamp(fromVariant);

  const mult = parsePackMultiplier(name);
  const per = packSize && packSize > 0 ? packSize : parsePerPack(name);

  if (mult != null && per != null) return clamp(mult * per);
  if (per != null) return clamp(per); // tak ada varian → anggap 1 bungkus
  if (mult != null) return clamp(mult); // isi per bungkus tidak diketahui
  return 1;
}

// packSize = isi 1 bungkus dalam satuan dasar (mis. 1 box = 12 sachet).
// Dipakai untuk mengalikan varian "2 BOX" dengan angka yang benar.
// isBundle = product gabungan (mis. box mix 3 rasa): isinya dijabarkan lewat
// ProductComponent, jadi "isi" di mapping dihitung per BOX, bukan per sachet.
export type ProductLite = {
  id: string;
  name: string;
  sku: string;
  packSize?: number;
  isBundle?: boolean;
};

// Isi per unit yang benar untuk sebuah product:
//  - bundle → berapa BOX/bundle yang dikirim ("2 BOX" → 2); isi box diurus BOM
//  - biasa  → berapa satuan dasar ("2 BOX" × 12 sachet → 24)
export function baseQtyFor(marketplaceName: string, p: ProductLite): number {
  if (p.isBundle) return Math.max(1, parsePackMultiplier(marketplaceName) ?? 1);
  return parseBaseQty(marketplaceName, p.packSize);
}
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
        // isi per bungkus diambil dari master product kalau ada — lebih akurat
        baseQty: baseQtyFor(marketplaceName, p),
      };
    }
  }
  return best;
}
