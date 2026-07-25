import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getPembukuanByGroup } from "@/lib/queries";
import { parseFilter, resolvePeriod } from "@/lib/parseFilter";
import { prisma } from "@/lib/prisma";
import { tanggal, MARKETPLACE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

const CURRENCY = '"Rp" #,##0';
const CURRENCY_NEG = '"Rp" #,##0;[Red]"Rp" -#,##0';
const PERCENT = "0.0%";
const INT = "#,##0";

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
const SUBTOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
const thin: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
};

function safeSheetName(name: string, fallback = "Grup") {
  return name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || fallback;
}

// Export pembukuan ke Excel (.xlsx). Sheet Ringkasan + satu sheet per grup.
export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const period = resolvePeriod(sp);
  const filter = parseFilter({ ...sp, from: period.from, to: period.to });
  const groups = await getPembukuanByGroup(filter);

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

  // ---------- Sheet per grup ----------
  for (const g of groups) {
    const ws = wb.addWorksheet(safeSheetName(g.groupName), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: "Product", key: "name", width: 34 },
      { header: "SKU", key: "sku", width: 18 },
      { header: "Terjual", key: "terjual", width: 10, style: { numFmt: INT } },
      { header: "Omzet", key: "omzet", width: 16, style: { numFmt: CURRENCY } },
      { header: "Fee", key: "fee", width: 14, style: { numFmt: CURRENCY } },
      { header: "Modal (Total)", key: "modal", width: 16, style: { numFmt: CURRENCY } },
      { header: "HPP/unit", key: "hpp", width: 14, style: { numFmt: CURRENCY } },
      { header: "Profit Bersih", key: "profit", width: 16, style: { numFmt: CURRENCY_NEG } },
      { header: "Margin", key: "margin", width: 10, style: { numFmt: PERCENT } },
    ];

    const head = ws.getRow(1);
    head.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = HEADER_FILL;
      c.alignment = { vertical: "middle" };
    });

    for (const r of g.rows) {
      const modal = r.hpp * r.terjual;
      const margin = r.omzet ? r.profit / r.omzet : 0;
      const row = ws.addRow({
        name: r.name,
        sku: r.sku,
        terjual: r.terjual,
        omzet: r.omzet,
        fee: r.fee,
        modal,
        hpp: r.hpp,
        profit: r.profit,
        margin,
      });
      row.eachCell((c) => (c.border = thin));
    }

    const subModal = g.subtotal.omzet - g.subtotal.fee - g.subtotal.profit;
    const subMargin = g.subtotal.omzet ? g.subtotal.profit / g.subtotal.omzet : 0;
    const sub = ws.addRow({
      name: `SUBTOTAL ${g.groupName}`,
      sku: "",
      terjual: g.subtotal.terjual,
      omzet: g.subtotal.omzet,
      fee: g.subtotal.fee,
      modal: subModal,
      hpp: "",
      profit: g.subtotal.profit,
      margin: subMargin,
    });
    sub.eachCell((c) => {
      c.font = { bold: true };
      c.fill = SUBTOTAL_FILL;
      c.border = { top: { style: "thin", color: { argb: "FF94A3B8" } } };
    });
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
