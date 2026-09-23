import { prisma } from "./prisma";

// Cek progres setup untuk memandu user (tanpa perlu tutorial).
export async function getSetupStatus() {
  const [storeCount, productCount, noHppCount, noStockCount, unmappedCount] = await Promise.all([
    prisma.store.count(),
    prisma.product.count({ where: { isBundle: false } }),
    // bundle tidak punya HPP/stok sendiri → tidak dihitung
    prisma.product.count({ where: { isBundle: false, hpp: { lte: 0 } } }),
    prisma.product.count({ where: { isBundle: false, opnames: { none: {} }, restocks: { none: {} } } }),
    prisma.productMapping.count({ where: { productId: null } }),
  ]);

  // Urutan = urutan yang benar-benar dibutuhkan. Grup pembukuan opsional
  // (ada di form tambah product), jadi bukan langkah wajib.
  const steps = [
    {
      key: "toko",
      cta: "Buka halaman Toko",
      done: storeCount > 0,
      title: "Tambah toko",
      desc: "Hubungkan Shopee atau daftarkan toko secara manual.",
      href: "/master/toko",
    },
    {
      key: "product",
      cta: "Tambah product",
      done: productCount > 0,
      title: "Tambah product",
      desc: "Daftarkan barang yang kamu jual.",
      href: "/master/product?tambah=1",
    },
    {
      key: "hpp",
      cta: "Isi HPP sekarang",
      done: productCount > 0 && noHppCount === 0,
      title: "Isi HPP (modal)",
      desc:
        noHppCount > 0 && productCount > 0
          ? `${noHppCount} product belum ada HPP — tanpa ini profit tidak bisa dihitung.`
          : "Modal tiap product, supaya profit terhitung benar.",
      href: "/master/product?harga=1#isi-harga",
    },
    {
      key: "stok",
      cta: "Mulai hitung stok",
      done: productCount > 0 && noStockCount === 0,
      title: "Hitung stok awal",
      desc:
        noStockCount > 0 && productCount > 0
          ? `${noStockCount} product belum punya stok awal.`
          : "Hitung stok fisik di gudang sekali, sisanya otomatis.",
      href: "/stok/hitung",
    },
    // Mapping SKU sengaja bukan langkah setup — SKU baru bisa muncul kapan
    // saja, jadi sudah ditangani "Perlu dicek" di dashboard.
  ];

  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    complete: doneCount === steps.length,
    unmappedCount,
    storeCount,
    productCount,
  };
}
