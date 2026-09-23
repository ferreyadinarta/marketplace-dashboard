import { getStockLevels } from "@/lib/stock";
import { StockCounter } from "@/components/StockCounter";
import { getT } from "@/lib/i18n-server";
import { saveOpname } from "../actions";

export const dynamic = "force-dynamic";

// sama dengan halaman Stok: perlu dihitung kalau belum pernah / > 30 hari
const OPNAME_DUE_DAYS = 30;

export default async function HitungStokPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getT();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const startId = one(sp.id) ?? "";
  const all = one(sp.semua) === "1";

  const levels = await getStockLevels();
  const now = Date.now();

  const items = levels.map((l) => {
    const days = l.anchorAt ? Math.floor((now - l.anchorAt.getTime()) / 86_400_000) : null;
    const due = !l.hasOpname || days === null || days > OPNAME_DUE_DAYS;
    return {
      productId: l.productId,
      name: l.name,
      sku: l.sku,
      unit: l.unit,
      packUnit: l.packUnit,
      packSize: l.packSize,
      koliUnit: l.koliUnit,
      koliSize: l.koliSize,
      current: l.current,
      known: l.status !== "UNSET",
      due,
      lastLabel:
        !l.hasOpname || days === null
          ? t("Belum pernah dihitung", "Not counted yet")
          : days <= 0
            ? t("Dihitung hari ini", "Counted today")
            : t(`Terakhir dihitung ${days} hari lalu`, `Last counted ${days} day${days === 1 ? "" : "s"} ago`),
    };
  });

  // Default: yang perlu dihitung dulu. Dibuka dari satu product (?id=) atau
  // semua sudah beres → tampilkan semua supaya product itu pasti ada.
  const dueItems = items.filter((i) => i.due);
  const showAll = all || !!startId || dueItems.length === 0;
  const list = showAll ? items : dueItems;
  const startIndex = Math.max(0, list.findIndex((i) => i.productId === startId));

  return (
    <StockCounter
      items={list}
      startIndex={startIndex}
      showingAll={showAll}
      dueCount={dueItems.length}
      totalCount={items.length}
      action={saveOpname}
    />
  );
}
