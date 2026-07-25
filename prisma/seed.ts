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

  // grup pembukuan — dikelompokkan per brand
  const flimty = await prisma.bookkeepingGroup.create({
    data: { name: "Flimty" },
  });
  const hotto = await prisma.bookkeepingGroup.create({
    data: { name: "Hotto" },
  });
  const spencers = await prisma.bookkeepingGroup.create({
    data: { name: "Spencers Lab" },
  });

  // product + HPP (contoh, angka bisa disesuaikan)
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Flimty Fiber Blackcurrant",
        sku: "FLM-FIBER-BC",
        hpp: 95000,
        groupId: flimty.id,
      },
    }),
    prisma.product.create({
      data: {
        name: "Flimty Fiber Mango",
        sku: "FLM-FIBER-MG",
        hpp: 95000,
        groupId: flimty.id,
      },
    }),
    prisma.product.create({
      data: {
        name: "Hotto Purto Multigrain",
        sku: "HTT-PURTO",
        hpp: 155000,
        groupId: hotto.id,
      },
    }),
    prisma.product.create({
      data: {
        name: "Hotto Malt Choco",
        sku: "HTT-MALT",
        hpp: 150000,
        groupId: hotto.id,
      },
    }),
    prisma.product.create({
      data: {
        name: "Spencers Lab Gluta Drink",
        sku: "SPL-GLUTA",
        hpp: 120000,
        groupId: spencers.id,
      },
    }),
  ]);

  // toko per marketplace — nama toko konsisten antar platform
  const stores = await Promise.all([
    prisma.store.create({
      data: {
        name: "Luxe Supplement Store — Shopee",
        marketplace: "SHOPEE",
        isActive: true,
      },
    }),
    prisma.store.create({
      data: {
        name: "Luxe Supplement Store — TikTok",
        marketplace: "TIKTOK",
        isActive: true,
      },
    }),
    prisma.store.create({
      data: {
        name: "Luxe Supplement Store — Tokopedia",
        marketplace: "TOKOPEDIA",
        isActive: true,
      },
    }),
  ]);

  // fee rate per marketplace (kira-kira, buat contoh)
  const feeRate: Record<string, number> = {
    SHOPEE: 0.08,
    TIKTOK: 0.06,
    TOKOPEDIA: 0.07,
  };

  // generate order 90 hari terakhir — relatif ke tanggal nyata sekarang,
  // supaya filter "bulan ini" / "N hari terakhir" selalu ada datanya.
  const now = new Date();
  now.setHours(0, 0, 0, 0);
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

  // Mapping SKU marketplace → product internal.
  // Di dunia nyata baris ini terisi otomatis saat order sync; di seed kita
  // buat manual biar halaman Mapping SKU ada isinya untuk demo.
  const mpPrefix: Record<string, string> = {
    SHOPEE: "SHP",
    TIKTOK: "TT",
    TOKOPEDIA: "TKP",
  };
  let mappingCount = 0;
  for (const store of stores) {
    const pfx = mpPrefix[store.marketplace];
    for (const p of products) {
      await prisma.productMapping.create({
        data: {
          storeId: store.id,
          marketplaceSku: `${pfx}-${p.sku}`,
          marketplaceProductName: p.name,
          productId: p.id,
        },
      });
      mappingCount++;
    }
  }

  // 2 SKU sengaja belum dipetakan → contoh product baru yang perlu di-mapping.
  await prisma.productMapping.create({
    data: {
      storeId: stores[0].id,
      marketplaceSku: "SHP-BUNDLE-PROMO",
      marketplaceProductName: "Paket Bundle Flimty + Hotto (baru)",
      productId: null,
    },
  });
  await prisma.productMapping.create({
    data: {
      storeId: stores[1].id,
      marketplaceSku: "TT-VARIAN-2026",
      marketplaceProductName: "Hotto Malt Varian Baru",
      productId: null,
    },
  });
  mappingCount += 2;

  console.log(
    `Seed selesai: ${stores.length} toko, ${products.length} product, ${orderCount} order, ${mappingCount} mapping SKU.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
