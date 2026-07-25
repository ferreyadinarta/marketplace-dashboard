import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// data contoh — dummy, biar dashboard langsung ada isinya untuk demo
async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.productMapping.deleteMany();
  await prisma.product.deleteMany();
  await prisma.bookkeepingGroup.deleteMany();
  await prisma.store.deleteMany();

  // grup pembukuan
  const skincare = await prisma.bookkeepingGroup.create({ data: { name: "Skincare" } });
  const fashion = await prisma.bookkeepingGroup.create({ data: { name: "Fashion" } });
  const aksesoris = await prisma.bookkeepingGroup.create({ data: { name: "Aksesoris" } });

  // product + HPP
  const products = await Promise.all([
    prisma.product.create({ data: { name: "Serum Vitamin C 20ml", sku: "SC-SERUM-VITC", hpp: 25000, groupId: skincare.id } }),
    prisma.product.create({ data: { name: "Sunscreen SPF50 30ml", sku: "SC-SUNSCREEN", hpp: 32000, groupId: skincare.id } }),
    prisma.product.create({ data: { name: "Kaos Polos Cotton Combed", sku: "FS-KAOS-COMBED", hpp: 35000, groupId: fashion.id } }),
    prisma.product.create({ data: { name: "Hoodie Oversize", sku: "FS-HOODIE-OS", hpp: 78000, groupId: fashion.id } }),
    prisma.product.create({ data: { name: "Tali Kacamata Rantai", sku: "AK-TALI-KCM", hpp: 8000, groupId: aksesoris.id } }),
  ]);

  // toko per marketplace
  const stores = await Promise.all([
    prisma.store.create({ data: { name: "Toko Utama Shopee", marketplace: "SHOPEE", isActive: true } }),
    prisma.store.create({ data: { name: "Toko Utama TikTok", marketplace: "TIKTOK", isActive: true } }),
    prisma.store.create({ data: { name: "Toko Utama Tokopedia", marketplace: "TOKOPEDIA", isActive: true } }),
  ]);

  // fee rate per marketplace (kira-kira, buat contoh)
  const feeRate: Record<string, number> = { SHOPEE: 0.08, TIKTOK: 0.06, TOKOPEDIA: 0.07 };

  // generate order 90 hari terakhir
  const now = new Date("2026-07-25T00:00:00Z");
  let orderCount = 0;
  for (let day = 0; day < 90; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);

    for (const store of stores) {
      // 0-4 order per toko per hari (deterministik biar stabil)
      const nOrders = (day * 7 + store.name.length) % 5;
      for (let o = 0; o < nOrders; o++) {
        const product = products[(day + o) % products.length];
        const qty = ((day + o) % 3) + 1;
        const price = product.hpp * 2 + 15000; // markup contoh
        const subtotal = price * qty;
        const fee = Math.round(subtotal * feeRate[store.marketplace]);
        const shipping = ((day + o) % 2) * 5000;
        const net = subtotal - fee + shipping;
        const status = day < 5 ? "SHIPPED" : "COMPLETED";

        await prisma.order.create({
          data: {
            storeId: store.id,
            marketplaceOrderId: `${store.marketplace}-${day}-${o}`,
            orderDate: date,
            status,
            totalAmount: subtotal,
            marketplaceFee: fee,
            shippingSubsidy: shipping,
            netAmount: net,
            items: {
              create: {
                productId: product.id,
                marketplaceSku: product.sku,
                productName: product.name,
                qty,
                price,
                subtotal,
              },
            },
          },
        });
        orderCount++;
      }
    }
  }

  console.log(`Seed selesai: ${stores.length} toko, ${products.length} product, ${orderCount} order.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
