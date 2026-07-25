import { prisma } from "./prisma";

// Cek progres setup untuk memandu user (tanpa perlu tutorial).
export async function getSetupStatus() {
  const [storeCount, productCount, productWithHpp, groupCount, unmappedCount] =
    await Promise.all([
      prisma.store.count(),
      prisma.product.count(),
      prisma.product.count({ where: { hpp: { gt: 0 } } }),
      prisma.bookkeepingGroup.count(),
      prisma.productMapping.count({ where: { productId: null } }),
    ]);

  // Langkah yang tampil ke user hanya yang halamannya ada di menu.
  // Setup toko & API marketplace ditangani manual (halaman Master Toko disembunyikan).
  const steps = [
    {
      key: "grup",
      done: groupCount > 0,
      title: "Buat grup pembukuan",
      desc: "Kelompokkan product per brand (ex: Flimty, Hotto) untuk tabel pembukuan.",
      href: "/master/product",
    },
    {
      key: "product",
      done: productCount > 0 && productWithHpp > 0,
      title: "Isi product & HPP",
      desc: "Masukkan product dan modal (HPP) tiap product untuk hitung profit.",
      href: "/master/product",
    },
    {
      key: "mapping",
      done: unmappedCount === 0 && productCount > 0,
      title: "Petakan SKU marketplace",
      desc: "Samakan SKU dari tiap marketplace ke product internal.",
      href: "/master/mapping",
    },
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
