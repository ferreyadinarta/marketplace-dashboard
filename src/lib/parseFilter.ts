import type { DashboardFilter } from "./queries";

// ubah query string (?from=..&to=..&marketplace=..&storeId=..) → DashboardFilter
export function parseFilter(sp: Record<string, string | string[] | undefined>): DashboardFilter {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const from = get("from");
  const to = get("to");
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(`${to}T23:59:59`) : undefined,
    marketplace: get("marketplace") || undefined,
    storeId: get("storeId") || undefined,
  };
}
