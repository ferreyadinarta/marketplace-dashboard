import { prisma } from "./prisma";
import type { T } from "./i18n";

// Cek progres setup untuk memandu user (tanpa perlu tutorial).
export async function getSetupStatus(t: T) {
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
      cta: t("Buka halaman Toko", "Open Stores page"),
      done: storeCount > 0,
      title: t("Tambah toko", "Add store"),
      desc: t("Hubungkan Shopee atau daftarkan toko secara manual.", "Connect Shopee or add a store manually."),
      href: "/master/toko",
    },
    {
      key: "product",
      cta: t("Tambah product", "Add product"),
      done: productCount > 0,
      title: t("Tambah product", "Add product"),
      desc: t("Daftarkan barang yang kamu jual.", "List the items you sell."),
      href: "/master/product?tambah=1",
    },
    {
      key: "hpp",
      cta: t("Isi HPP sekarang", "Enter COGS now"),
      done: productCount > 0 && noHppCount === 0,
      title: t("Isi HPP (modal)", "Enter COGS"),
      desc:
        noHppCount > 0 && productCount > 0
          ? t(
              `${noHppCount} product belum ada HPP. Tanpa ini profit tidak bisa dihitung.`,
              `${noHppCount} ${noHppCount === 1 ? "product is" : "products are"} missing COGS. Without it, profit can't be calculated.`
            )
          : t("Modal tiap product, supaya profit terhitung benar.", "Cost per product, so profit is calculated correctly."),
      href: "/master/product?harga=1#isi-harga",
    },
    {
      key: "stok",
      cta: t("Mulai hitung stok", "Start stock count"),
      done: productCount > 0 && noStockCount === 0,
      title: t("Hitung stok awal", "Count opening stock"),
      desc:
        noStockCount > 0 && productCount > 0
          ? t(
              `${noStockCount} product belum punya stok awal.`,
              `${noStockCount} ${noStockCount === 1 ? "product is" : "products are"} missing opening stock.`
            )
          : t(
              "Hitung stok fisik di gudang sekali, sisanya otomatis.",
              "Count physical stock in the warehouse once, the rest is automatic."
            ),
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
