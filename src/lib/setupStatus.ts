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

  // Langkah setup sekali-jalan sebelum pembukuan berfungsi.
  const steps = [
    {
      key: "toko",
      done: storeCount > 0,
      title: "Tambah toko",
      desc: "Daftarkan toko & marketplace tempat kakak jualan.",
      href: "/master/toko",
    },
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
    // Catatan: mapping SKU TIDAK dimasukkan sebagai langkah setup — itu tugas
    // berulang (SKU baru bisa muncul kapan saja), sudah ditangani banner
    // "X SKU belum dipetakan" di dashboard. Menaruhnya di sini = redundan.
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
