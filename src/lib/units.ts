// Tingkatan satuan sebuah product: koli › box › satuan dasar (mis. sachet).
// Dipakai bersama oleh Mapping SKU & editor bundle supaya angka yang diketik
// user selalu bisa dibaca ulang dalam satuan yang wajar, sementara yang
// DISIMPAN tetap satuan dasar.

export type UnitInfo = {
  unit: string; // satuan dasar (mis. sachet)
  packUnit: string; // mis. box
  packSize: number; // 1 box = berapa satuan dasar
  koliUnit: string;
  koliSize: number; // 1 koli = berapa box
};

export type Tier = { key: string; label: string; factor: number };

// Terbesar → terkecil. Product tanpa satuan kecil cuma punya satu tingkat.
export function tiersOf(u?: UnitInfo): Tier[] {
  if (!u) return [{ key: "base", label: "satuan dasar", factor: 1 }];
  const out: Tier[] = [];
  const hasPack = u.packSize >= 2 && !!u.packUnit;
  const hasKoli = hasPack && u.koliSize >= 2 && !!u.koliUnit;
  if (hasKoli) out.push({ key: "koli", label: u.koliUnit, factor: u.koliSize * u.packSize });
  if (hasPack) out.push({ key: "pack", label: u.packUnit, factor: u.packSize });
  out.push({ key: "base", label: u.unit || "satuan dasar", factor: 1 });
  return out;
}

// Tampilkan nilai tersimpan dengan satuan paling enak dibaca:
// 24 sachet dengan 1 box = 12 → "2 box". Kalau tidak habis dibagi, tetap dasar.
export function splitBase(base: number, tiers: Tier[]): { qty: number; tier: string } {
  for (const t of tiers) {
    if (t.factor > 1 && base % t.factor === 0) return { qty: base / t.factor, tier: t.key };
  }
  return { qty: base, tier: "base" };
}

// Satuan yang dipakai bundle: bundle TIDAK punya konversi isi/koli sendiri
// (isinya dijabarkan lewat komponen), jadi hanya satu tingkat = satuan jualnya.
export function bundleUnitInfo(u: UnitInfo): UnitInfo {
  return {
    unit: u.packSize > 0 ? u.packUnit : u.unit,
    packUnit: "",
    packSize: 0,
    koliUnit: "",
    koliSize: 0,
  };
}
