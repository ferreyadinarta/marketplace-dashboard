import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getPembukuanByGroup, getOrdersDetail, NO_GROUP } from "@/lib/queries";
import { parseFilter, resolvePeriod } from "@/lib/parseFilter";
import { prisma } from "@/lib/prisma";
import { tanggal, jakartaParts, TZ, marketplaceLabel } from "@/lib/format";
import { intlLocale } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";

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

// Nama grup "Tanpa Grup" / "SKU belum dipetakan" datang hardcoded bahasa
// Indonesia dari lib/queries.ts (file itu bukan punya kita) → dipetakan ke
// label terjemahan di sini. getPembukuanByGroup kasih groupId, getOrdersDetail
// cuma kasih groupName string, jadi dicocokkan juga by literal string itu.
function tGroupLabel(groupId: string, groupName: string, t: (id: string, en: string) => string) {
  if (groupId === NO_GROUP) return t("Tanpa Grup", "No group");
  if (groupId === "__unmapped__") return t("SKU belum dipetakan", "Unmapped SKU");
  return groupName;
}

// Export pembukuan ke Excel (.xlsx). Sheet Ringkasan + satu sheet per grup.
export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { t, lang } = await getT();
  // defaultAll=true supaya SAMA dengan halaman Pembukuan: tanpa from/to berarti
  // "semua data". Sebelumnya export diam-diam jatuh ke bulan berjalan, jadi isi
  // & nama filenya beda dengan yang dilihat user di layar.
  const period = resolvePeriod(sp, true);
  const filter = parseFilter({ ...sp, from: period.from, to: period.to });
  const groups = await getPembukuanByGroup(filter);
  const detailRows = await getOrdersDetail(filter);

  const semua = t("Semua", "All");
  // label filter untuk sheet ringkasan
  const mpLabel = sp.marketplace ? marketplaceLabel(sp.marketplace, lang) : semua;
  const tokoLabel = sp.storeId
    ? (await prisma.store.findUnique({ where: { id: sp.storeId } }))?.name ?? sp.storeId
    : semua;
  const grupLabel = sp.groupId
    ? tGroupLabel(sp.groupId, (await prisma.bookkeepingGroup.findUnique({ where: { id: sp.groupId } }))?.name ?? sp.groupId, t)
    : semua;
  const periodeLabel = period.isAll
    ? t("Semua data", "All data")
    : `${tanggal(period.from!, lang)} – ${tanggal(period.to!, lang)}`;

  const wb = new ExcelJS.Workbook();
  wb.creator = t("Pembukuan Marketplace", "Marketplace Bookkeeping");

  // ---------- Sheet Ringkasan ----------
  const sum = wb.addWorksheet(t("Ringkasan", "Summary"), { views: [{ showGridLines: false }] });
  sum.getColumn(1).width = 22;
  sum.getColumn(2).width = 16;
  sum.getColumn(3).width = 16;
  sum.getColumn(4).width = 16;
  sum.getColumn(5).width = 16;
  sum.getColumn(6).width = 16;
  sum.getColumn(7).width = 12;

  const title = sum.addRow([t("Pembukuan Marketplace", "Marketplace Bookkeeping")]);
  title.getCell(1).font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  sum.addRow([t("Ringkasan laporan penjualan & profit", "Summary of sales & profit report")]).getCell(1).font = {
    color: { argb: "FF64748B" },
  };
  sum.addRow([]);
  const meta: [string, string][] = [
    [t("Periode", "Period"), periodeLabel],
    [t("Marketplace", "Marketplace"), mpLabel],
    [t("Toko", "Store"), tokoLabel],
    [t("Grup / Brand", "Group / Brand"), grupLabel],
    [t("Dibuat", "Created"), tanggal(new Date(), lang)],
  ];
  for (const [k, v] of meta) {
    const r = sum.addRow([k, v]);
    r.getCell(1).font = { bold: true, color: { argb: "FF475569" } };
  }
  sum.addRow([]);

  const aggByGroup = new Map<string, { qty: number; admin: number; ship: number; tax: number }>();
  for (const r of detailRows) {
    const a = aggByGroup.get(r.groupName) ?? { qty: 0, admin: 0, ship: 0, tax: 0 };
    a.qty += r.qtyMain;
    a.admin += r.feeAdmin;
    a.ship += r.feeShipping;
    a.tax += r.feeTax;
    aggByGroup.set(r.groupName, a);
  }

  // tabel ringkasan per grup
  const headerRow = sum.addRow([
    t("Grup", "Group"),
    t("Terjual (box)", "Sold (box)"),
    t("Omzet", "Revenue"),
    "Admin",
    t("Ongkir", "Shipping"),
    t("Pajak", "Tax"),
    t("Modal", "COGS"),
    "Profit",
    t("Margin", "Margin"),
  ]);
  headerRow.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEADER_FILL;
    c.alignment = { vertical: "middle" };
  });

  const SUM_FMT = [INT, CURRENCY, CURRENCY, CURRENCY, CURRENCY, CURRENCY, CURRENCY_NEG, PERCENT];
  const grand = { terjual: 0, omzet: 0, admin: 0, ship: 0, tax: 0, modal: 0, profit: 0 };
  for (const g of groups) {
    const modal = g.subtotal.omzet - g.subtotal.fee - g.subtotal.profit;
    const margin = g.subtotal.omzet ? g.subtotal.profit / g.subtotal.omzet : 0;
    const a = aggByGroup.get(g.groupName) ?? { qty: 0, admin: g.subtotal.fee, ship: 0, tax: 0 };
    const row = sum.addRow([
      tGroupLabel(g.groupId, g.groupName, t),
      Math.round(a.qty),
      g.subtotal.omzet,
      a.admin,
      a.ship,
      a.tax,
      modal,
      g.subtotal.profit,
      margin,
    ]);
    SUM_FMT.forEach((f, i) => (row.getCell(i + 2).numFmt = f));
    grand.terjual += a.qty;
    grand.omzet += g.subtotal.omzet;
    grand.admin += a.admin;
    grand.ship += a.ship;
    grand.tax += a.tax;
    grand.modal += modal;
    grand.profit += g.subtotal.profit;
  }
  const grandMargin = grand.omzet ? grand.profit / grand.omzet : 0;
  const totalRow = sum.addRow([
    t("TOTAL", "TOTAL"),
    Math.round(grand.terjual),
    grand.omzet,
    grand.admin,
    grand.ship,
    grand.tax,
    grand.modal,
    grand.profit,
    grandMargin,
  ]);
  totalRow.eachCell((c) => {
    c.font = { bold: true };
    c.fill = SUBTOTAL_FILL;
    c.border = { top: { style: "thin", color: { argb: "FF94A3B8" } } };
  });
  SUM_FMT.forEach((f, i) => (totalRow.getCell(i + 2).numFmt = f));

  // ---------- Ringkasan PER TAHUN (data multi-tahun jadi mudah dibandingkan) ----------
  const yearAgg = new Map<number, { qty: number; total: number; modal: number }>();
  for (const r of detailRows) {
    const y = jakartaParts(r.bookDate).year;
    const a = yearAgg.get(y) ?? { qty: 0, total: 0, modal: 0 };
    a.qty += r.qtyMain;
    a.total += r.total;
    a.modal += r.modal;
    yearAgg.set(y, a);
  }

  if (yearAgg.size > 1) {
    sum.addRow([]);
    sum.addRow([t("Per Tahun", "By Year")]).getCell(1).font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
    const yHead = sum.addRow([
      t("Tahun", "Year"),
      t("Terjual (box)", "Sold (box)"),
      t("Omzet", "Revenue"),
      "",
      t("Modal", "COGS"),
      t("Laba", "Profit"),
      t("Margin", "Margin"),
    ]);
    yHead.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = HEADER_FILL;
      c.alignment = { vertical: "middle" };
    });
    for (const y of [...yearAgg.keys()].sort((a, b) => b - a)) {
      const a = yearAgg.get(y)!;
      const laba = a.total - a.modal;
      const row = sum.addRow([y, Math.round(a.qty), a.total, "", a.modal, laba, a.total ? laba / a.total : 0]);
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
    new Intl.DateTimeFormat(intlLocale(lang), { timeZone: TZ, month: "long", year: "numeric" }).format(d).toUpperCase();
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
    "No",
    t("Tgl uang masuk", "Date received"),
    t("Pembeli", "Buyer"),
    "Marketplace",
    "Order (SKU)",
    "Qty",
    t("Harga", "Price"),
    "Admin",
    t("Ongkir", "Shipping"),
    t("Pajak", "Tax"),
    t("Total", "Total"),
  ];
  const LEDGER_WIDTHS = [6, 13, 16, 13, 20, 16, 14, 13, 12, 12, 16];
  const COLS = LEDGER_HEADERS.length;
  const GAP = 4;
  const BLOCK = COLS + GAP; // lebar 1 tabel bulan + jarak

  // Render tabel-tabel bulan (disusun ke kanan) untuk SATU sheet.
  const renderMonths = (ws: ExcelJS.Worksheet, rows: typeof detailRows) => {
    // kelompokkan per bulan (urut kronologis) — rows sudah urut tanggal asc
    const byMonth = new Map<string, typeof detailRows>();
    for (const r of rows) {
      const k = monthKeyOf(r.bookDate);
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
      title.value = `${t("SELLING", "SELLING")} ${monthLabel(monthRows[0].bookDate)}`;
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
        const dLabel = tanggal(row.bookDate, lang);
        const showDate = dLabel !== curDate ? dLabel : "";
        curDate = dLabel;
        // Konsinyasi: tampilkan nama toko titipan, bukan "Konsinyasi".
        const channel =
          row.marketplace === "KONSINYASI" ? row.storeName : marketplaceLabel(row.marketplace, lang);
        const vals = [
          no,
          showDate,
          row.buyerName,
          channel,
          row.sku,
          row.qtyLabel,
          row.price,
          row.feeAdmin,
          row.feeShipping,
          row.feeTax,
          row.total,
        ];
        vals.forEach((v, i) => {
          const cell = ws.getCell(r, c0 + i);
          cell.value = v as string | number;
          cell.border = thin;
        });
        for (let i = 6; i <= 9; i++) ws.getCell(r, c0 + i).numFmt = CURRENCY; // harga, admin, ongkir, pajak
        ws.getCell(r, c0 + 10).numFmt = CURRENCY_NEG; // total
        monthTotal += row.total;
        monthModal += row.modal;
        r += 1;
      }

      // baris TOTAL (net penjualan) & LABA (profit setelah modal)
      const summary: [string, number][] = [
        [t("TOTAL", "TOTAL"), monthTotal],
        [t("LABA", "PROFIT"), monthTotal - monthModal],
      ];
      for (const [label, value] of summary) {
        const labelCell = ws.getCell(r, c0 + COLS - 2);
        labelCell.value = label;
        labelCell.font = { bold: true };
        labelCell.fill = SUMMARY_FILL;
        const valueCell = ws.getCell(r, c0 + COLS - 1);
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
    // rowsByGroup dikunci dengan g.groupName MENTAH (sama seperti yang dipakai
    // getOrdersDetail) supaya lookup-nya tetap benar; label terjemahan cuma
    // dipakai untuk nama sheet yang tampil ke user.
    const rows = rowsByGroup.get(g.groupName) ?? [];
    const label = tGroupLabel(g.groupId, g.groupName, t);
    if (rows.length === 0) {
      const ws = wb.addWorksheet(uniqueName(safeSheetName(label)));
      ws.getCell(1, 1).value = t(
        "Belum ada penjualan (selesai) untuk filter ini.",
        "No (completed) sales for this filter yet."
      );
      continue;
    }

    const byYear = new Map<number, typeof detailRows>();
    for (const r of rows) {
      const y = jakartaParts(r.bookDate).year;
      const arr = byYear.get(y) ?? [];
      arr.push(r);
      byYear.set(y, arr);
    }

    for (const year of [...byYear.keys()].sort((a, b) => b - a)) {
      const ws = wb.addWorksheet(uniqueName(sheetNameForYear(label, year)));
      renderMonths(ws, byYear.get(year)!);
    }
  }

  if (groups.length === 0) {
    sum.addRow([]);
    sum.addRow([t("Tidak ada data untuk filter ini.", "No data for this filter.")]).getCell(1).font = {
      color: { argb: "FF94A3B8" },
    };
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
