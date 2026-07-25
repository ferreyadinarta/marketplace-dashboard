import type { DashboardFilter } from "./queries";
import { currentMonthRange } from "./format";

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// ubah query string (?from=..&to=..&marketplace=..&storeId=..) → DashboardFilter
export function parseFilter(sp: Record<string, string | string[] | undefined>): DashboardFilter {
  const from = one(sp.from);
  const to = one(sp.to);
  return {
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T23:59:59`) : undefined,
    marketplace: one(sp.marketplace) || undefined,
    storeId: one(sp.storeId) || undefined,
    groupId: one(sp.groupId) || undefined,
  };
}

// Tentukan periode aktif dari query.
// - ?all=1        → semua data (tanpa batas tanggal), tanpa pembanding.
// - from/to ada   → pakai itu.
// - keduanya kosong → default: bulan berjalan.
export function resolvePeriod(
  sp: Record<string, string | string[] | undefined>,
  defaultAll = false
): {
  isAll: boolean;
  from?: string;
  to?: string;
} {
  if (one(sp.all) === "1") return { isAll: true };
  const from = one(sp.from);
  const to = one(sp.to);
  if (!from && !to && defaultAll) return { isAll: true };
  const def = currentMonthRange();
  return { isAll: false, from: from || def.from, to: to || def.to };
}
