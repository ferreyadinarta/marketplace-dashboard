import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getPembukuanByGroup, getOrdersDetail } from "@/lib/queries";
import { parseFilter, resolvePeriod } from "@/lib/parseFilter";
import { prisma } from "@/lib/prisma";
import { tanggal, jakartaParts, TZ, MARKETPLACE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

const CURRENCY = '"Rp" #,##0';
const CURRENCY_NEG = '"Rp" #,##0;[Red]"Rp" -#,##0';
const PERCENT = "0.0%";
const INT = "#,##0";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
const SUBTOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
// oranye ala sheet kakak untuk baris TOTAL / LABA
const SUMMARY_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8A87C" } };
const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
};

function safeSheetName(name: string, fallback = "Grup") {
  return name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || fallback;
}

// Nama sheet "<Grup> <Tahun>" — sisakan ruang untuk tahun (batas Excel 31 karakter).
function sheetNameForYear(name: string, year: number, fallback = "Grup") {
  const clean = name.replace(/[\\/?*[\]:]/g, "").trim() || fallback;
  return `${clean.slice(0, 26)} ${year}`;
}

// Export pembukuan ke Excel (.xlsx). Sheet Ringkasan + satu sheet per grup.
export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  // defaultAll=true supaya SAMA dengan halaman Pembukuan: tanpa from/to berarti
  // "semua data". Sebelumnya export diam-diam jatuh ke bulan berjalan, jadi isi
  // & nama filenya beda dengan yang dilihat user di layar.
  const period = resolvePeriod(sp, true);
  const filter = parseFilter({ ...sp, from: period.from, to: period.to });
  const groups = await getPembukuanByGroup(filter);
  const detailRows = await getOrdersDetail(filter);

  // label filter untuk sheet ringkasan
  const mpLabel = sp.marketplace ? MARKETPLACE_LABEL[sp.marketplace] ?? sp.marketplace : "Semua";
  const tokoLabel = sp.storeId
    ? (await prisma.store.findUnique({ where: { id: sp.storeId } }))?.name ?? sp.storeId
    : "Semua";
  const grupLabel = sp.groupId
    ? (await prisma.bookkeepingGroup.findUnique({ where: { id: sp.groupId } }))?.name ?? sp.groupId
    : "Semua";
  const periodeLabel = period.isAll
    ? "Semua data"
    : `${tanggal(period.from!)} – ${tanggal(period.to!)}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pembukuan Marketplace";

  // ---------- Sheet Ringkasan ----------
  const sum = wb.addWorksheet("Ringkasan", { views: [{ showGridLines: false }] });
  sum.getColumn(1).width = 22;
  sum.getColumn(2).width = 16;
  sum.getColumn(3).width = 16;
  sum.getColumn(4).width = 16;
  sum.getColumn(5).width = 16;
  sum.getColumn(6).width = 16;
  sum.getColumn(7).width = 12;

  const title = sum.addRow(["Pembukuan Marketplace"]);
  title.getCell(1).font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  sum.addRow(["Ringkasan laporan penjualan & profit"]).getCell(1).font = {
    color: { argb: "FF64748B" },
  };
  sum.addRow([]);
  const meta: [string, string][] = [
    ["Periode", periodeLabel],
    ["Marketplace", mpLabel],
    ["Toko", tokoLabel],
    ["Grup / Brand", grupLabel],
    ["Dibuat", tanggal(new Date())],
  ];
  for (const [k, v] of meta) {
    const r = sum.addRow([k, v]);
    r.getCell(1).font = { bold: true, color: { argb: "FF475569" } };
  }
  sum.addRow([]);

  // tabel ringkasan per grup
  const headerRow = sum.addRow(["Grup", "Terjual", "Omzet", "Fee", "Modal", "Profit", "Margin"]);
  headerRow.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.alignment = { vertical: "middle" };
  });

  const grand = { terjual: 0, omzet: 0, fee: 0, modal: 0, profit: 0 };
  for (const g of groups) {
    const modal = g.subtotal.omzet - g.subtotal.fee - g.subtotal.profit;
    const margin = g.subtotal.omzet ? g.subtotal.profit / g.subtotal.omzet : 0;
    const row = sum.addRow([
      g.groupName,
      g.subtotal.terjual,
      g.subtotal.omzet,
      g.subtotal.fee,
      modal,
      g.subtotal.profit,
      margin,
    ]);
    row.getCell(2).numFmt = INT;
    row.getCell(3).numFmt = CURRENCY;
    row.getCell(4).numFmt = CURRENCY;
    row.getCell(5).numFmt = CURRENCY;
    row.getCell(6).numFmt = CURRENCY_NEG;
    row.getCell(7).numFmt = PERCENT;
    grand.terjual += g.subtotal.terjual;
    grand.omzet += g.subtotal.omzet;
    grand.fee += g.subtotal.fee;
    grand.modal += modal;
    grand.profit += g.subtotal.profit;
  }
  const grandMargin = grand.omzet ? grand.profit / grand.omzet : 0;
  const totalRow = sum.addRow([
    "TOTAL",
    grand.terjual,
    grand.omzet,
    grand.fee,
    grand.modal,
    grand.profit,
    grandMargin,
  ]);
  totalRow.eachCell((c) => {
    c.font = { bold: true };
    c.fill = SUBTOTAL_FILL;
    c.border = { top: { style: "thin", color: { argb: "FF94A3B8" } } };
  });
  totalRow.getCell(2).numFmt = INT;
  totalRow.getCell(3).numFmt = CURRENCY;
  totalRow.getCell(4).numFmt = CURRENCY;
  totalRow.getCell(5).numFmt = CURRENCY;
  totalRow.getCell(6).numFmt = CURRENCY_NEG;
  totalRow.getCell(7).numFmt = PERCENT;

  // ---------- Ringkasan PER TAHUN (data multi-tahun jadi mudah dibandingkan) ----------
  const yearAgg = new Map<number, { qty: number; total: number; modal: number }>();
  for (const r of detailRows) {
    const y = jakartaParts(r.orderDate).year;
    const a = yearAgg.get(y) ?? { qty: 0, total: 0, modal: 0 };
    a.qty += r.qty;
    a.total += r.total;
    a.modal += r.modal;
    yearAgg.set(y, a);
  }

  if (yearAgg.size > 1) {
    sum.addRow([]);
    sum.addRow(["Per Tahun"]).getCell(1).font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
    const yHead = sum.addRow(["Tahun", "Terjual", "Omzet", "", "Modal", "Laba", "Margin"]);
    yHead.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = HEADER_FILL;
      c.alignment = { vertical: "middle" };
    });
    for (const y of [...yearAgg.keys()].sort((a, b) => b - a)) {
      const a = yearAgg.get(y)!;
      const laba = a.total - a.modal;
      const row = sum.addRow([y, a.qty, a.total, "", a.modal, laba, a.total ? laba / a.total : 0]);
      row.getCell(2).numFmt = INT;
      row.getCell(3).numFmt = CURRENCY;
      row.getCell(5).numFmt = CURRENCY;
      row.getCell(6).numFmt = CURRENCY_NEG;
      row.getCell(7).numFmt = PERCENT;
    }
  }

  // ---------- Satu sheet LEDGER per brand (grup) ----------
  // Format ala kakak: setiap BULAN = tabel sendiri, disusun ke KANAN
  // (bulan berikutnya di sebelah kanan), dipisah 4 kolom kosong.
  // Kolom "Order" = SKU. Baris per tanggal, tanggal ditulis sekali per hari.
  const monthLabel = (d: Date) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: TZ, month: "long", year: "numeric" }).format(d).toUpperCase();
  const monthKeyOf = (d: Date) => {
    const p = jakartaParts(d);
    return `${p.year}-${String(p.month).padStart(2, "0")}`;
  };

  const rowsByGroup = new Map<string, typeof detailRows>();
  for (const r of detailRows) {
    const arr = rowsByGroup.get(r.groupName) ?? [];
    arr.push(r);
    rowsByGroup.set(r.groupName, arr);
  }

  const LEDGER_HEADERS = [
    "No", "Tanggal", "Pembeli", "Marketplace", "Order (SKU)", "Qty", "Harga", "Ongkir/Adm", "Total",
  ];
  const LEDGER_WIDTHS = [6, 13, 16, 13, 20, 7, 14, 14, 16];
  const COLS = 9;
  const GAP = 4;
  const BLOCK = COLS + GAP; // lebar 1 tabel bulan + jarak

  // Render tabel-tabel bulan (disusun ke kanan) untuk SATU sheet.
  const renderMonths = (ws: ExcelJS.Worksheet, rows: typeof detailRows) => {
    // kelompokkan per bulan (urut kronologis) — rows sudah urut tanggal asc
    const byMonth = new Map<string, typeof detailRows>();
    for (const r of rows) {
      const k = monthKeyOf(r.orderDate);
      const arr = byMonth.get(k) ?? [];
      arr.push(r);
      byMonth.set(k, arr);
    }
    const monthKeys = [...byMonth.keys()].sort();

    monthKeys.forEach((mk, mIdx) => {
      const c0 = mIdx * BLOCK + 1; // kolom awal tabel bulan ini (1-based)
      const monthRows = byMonth.get(mk)!;

      // lebar kolom
      for (let i = 0; i < COLS; i++) ws.getColumn(c0 + i).width = LEDGER_WIDTHS[i];

      // baris 1: judul "SELLING <BULAN>" (merge selebar tabel)
      ws.mergeCells(1, c0, 1, c0 + COLS - 1);
      const title = ws.getCell(1, c0);
      title.value = `SELLING ${monthLabel(monthRows[0].orderDate)}`;
      title.font = { bold: true, size: 12, color: { argb: "FF4338CA" } };
      title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
      title.alignment = { vertical: "middle" };

      // baris 2: header kolom
      LEDGER_HEADERS.forEach((h, i) => {
        const cell = ws.getCell(2, c0 + i);
        cell.value = h;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = HEADER_FILL;
        cell.alignment = { vertical: "middle" };
      });

      // baris data mulai baris 3
      let r = 3;
      let no = 0;
      let curDate = "";
      let monthTotal = 0;
      let monthModal = 0;
      for (const row of monthRows) {
        no += 1;
        const dLabel = tanggal(row.orderDate);
        const showDate = dLabel !== curDate ? dLabel : "";
        curDate = dLabel;
        // Konsinyasi: tampilkan nama toko titipan, bukan "Konsinyasi".
        const channel =
          row.marketplace === "KONSINYASI"
            ? row.storeName
            : MARKETPLACE_LABEL[row.marketplace] ?? row.marketplace;
        const vals = [
          no,
          showDate,
          row.buyerName,
          channel,
          row.sku,
          row.unit ? `${row.qty} ${row.unit}` : row.qty,
          row.price,
          row.fee,
          row.total,
        ];
        vals.forEach((v, i) => {
          const cell = ws.getCell(r, c0 + i);
          cell.value = v as string | number;
          cell.border = thin;
        });
        ws.getCell(r, c0 + 5).numFmt = INT; // qty
        ws.getCell(r, c0 + 6).numFmt = CURRENCY; // harga
        ws.getCell(r, c0 + 7).numFmt = CURRENCY; // ongkir/adm
        ws.getCell(r, c0 + 8).numFmt = CURRENCY_NEG; // total
        monthTotal += row.total;
        monthModal += row.modal;
        r += 1;
      }

      // baris TOTAL (net penjualan) & LABA (profit setelah modal)
      const summary: [string, number][] = [
        ["TOTAL", monthTotal],
        ["LABA", monthTotal - monthModal],
      ];
      for (const [label, value] of summary) {
        const labelCell = ws.getCell(r, c0 + 7);
        labelCell.value = label;
        labelCell.font = { bold: true };
        labelCell.fill = SUMMARY_FILL;
        const valueCell = ws.getCell(r, c0 + 8);
        valueCell.value = value;
        valueCell.numFmt = CURRENCY_NEG;
        valueCell.font = { bold: true };
        valueCell.fill = SUMMARY_FILL;
        r += 1;
      }
    });
  };

  // Satu sheet per GRUP per TAHUN, tahun TERBARU lebih dulu. Kalau semua bulan
  // ditaruh di satu sheet, 2 tahun = 24 tabel ke kanan (300+ kolom) dan bulan
  // terbaru paling jauh — susah dicari. Dipecah per tahun: maksimal 12 tabel.
  const usedNames = new Set<string>();
  const uniqueName = (base: string) => {
    let name = base;
    let n = 2;
    while (usedNames.has(name)) name = `${base.slice(0, 28)} (${n++})`;
    usedNames.add(name);
    return name;
  };

  for (const g of groups) {
    const rows = rowsByGroup.get(g.groupName) ?? [];
    if (rows.length === 0) {
      const ws = wb.addWorksheet(uniqueName(safeSheetName(g.groupName)));
      ws.getCell(1, 1).value = "Belum ada penjualan (selesai) untuk filter ini.";
      continue;
    }

    const byYear = new Map<number, typeof detailRows>();
    for (const r of rows) {
      const y = jakartaParts(r.orderDate).year;
      const arr = byYear.get(y) ?? [];
      arr.push(r);
      byYear.set(y, arr);
    }

    for (const year of [...byYear.keys()].sort((a, b) => b - a)) {
      const ws = wb.addWorksheet(uniqueName(sheetNameForYear(g.groupName, year)));
      renderMonths(ws, byYear.get(year)!);
    }
  }

  if (groups.length === 0) {
    sum.addRow([]);
    sum.addRow(["Tidak ada data untuk filter ini."]).getCell(1).font = { color: { argb: "FF94A3B8" } };
  }

  const buf = await wb.xlsx.writeBuffer();

  // Nama file: Pembukuan_<marketplace>_<grup>_<dari>_sd_<sampai>.xlsx
  const mp = sp.marketplace ? `_${sp.marketplace.toLowerCase()}` : "";
  const grp = sp.groupId ? `_${grupLabel.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}` : "";
  const range = period.isAll ? "_semua" : `_${period.from}_sd_${period.to}`;
  const filename = `Pembukuan${mp}${grp}${range}.xlsx`;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
