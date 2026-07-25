import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { getPembukuanByGroup } from "@/lib/queries";
import { parseFilter } from "@/lib/parseFilter";

export const dynamic = "force-dynamic";

// Export pembukuan ke Excel (.xlsx). Satu sheet per grup pembukuan.
// Mengikuti filter yang sama dengan halaman (from/to/marketplace/storeId).
export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const filter = parseFilter(sp);
  const groups = await getPembukuanByGroup(filter);

  const wb = XLSX.utils.book_new();

  for (const g of groups) {
    const rows = g.rows.map((r) => ({
      Product: r.name,
      SKU: r.sku,
      Terjual: r.terjual,
      Omzet: r.omzet,
      "Fee Marketplace": r.fee,
      "HPP/unit": r.hpp,
      "Profit Bersih": r.profit,
    }));
    rows.push({
      Product: `SUBTOTAL ${g.groupName}`,
      SKU: "",
      Terjual: g.subtotal.terjual,
      Omzet: g.subtotal.omzet,
      "Fee Marketplace": g.subtotal.fee,
      "HPP/unit": 0,
      "Profit Bersih": g.subtotal.profit,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    // nama sheet Excel maks 31 char, tanpa karakter terlarang
    const safe = g.groupName.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Grup";
    XLSX.utils.book_append_sheet(wb, ws, safe);
  }

  if (groups.length === 0) {
    const ws = XLSX.utils.json_to_sheet([{ Info: "Tidak ada data" }]);
    XLSX.utils.book_append_sheet(wb, ws, "Kosong");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const stamp = filter.from || filter.to ? "-terfilter" : "";

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pembukuan${stamp}.xlsx"`,
    },
  });
}
