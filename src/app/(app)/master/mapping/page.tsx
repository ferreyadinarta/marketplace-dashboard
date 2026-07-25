import { Link2, AlertTriangle, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MARKETPLACE_LABEL } from "@/lib/format";
import { assignMapping } from "./actions";
import { Card, CardHeader, PageHeader, Badge, EmptyState } from "@/components/ui";
import { MappingRow } from "@/components/EditableRows";
import { MappingFilters } from "@/components/MappingFilters";
import { Pagination, PaginationControls } from "@/components/Pagination";

export const dynamic = "force-dynamic";

const PER_PAGE = 15;

export default async function MappingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q);
  const status = one(sp.status); // "" | "unmapped" | "mapped"
  const marketplace = one(sp.marketplace);
  const storeId = one(sp.storeId);
  const page = Math.max(1, parseInt(one(sp.page) || "1", 10) || 1);

  const where: Prisma.ProductMappingWhereInput = {};
  if (status === "unmapped") where.productId = null;
  if (status === "mapped") where.productId = { not: null };
  if (storeId) where.storeId = storeId;
  if (marketplace) where.store = { marketplace };
  if (q) {
    where.OR = [
      { marketplaceSku: { contains: q, mode: "insensitive" } },
      { marketplaceProductName: { contains: q, mode: "insensitive" } },
    ];
  }

  const [mappings, total, totalUnmapped, products, stores] = await Promise.all([
    prisma.productMapping.findMany({
      where,
      include: { store: true, product: true },
      orderBy: [{ productId: "asc" }, { marketplaceSku: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.productMapping.count({ where }),
    prisma.productMapping.count({ where: { productId: null } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const fromRow = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const toRow = Math.min(page * PER_PAGE, total);
  const anyFilter = !!(q || status || marketplace || storeId);

  const pageHref = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (status) s.set("status", status);
    if (marketplace) s.set("marketplace", marketplace);
    if (storeId) s.set("storeId", storeId);
    if (p > 1) s.set("page", String(p));
    const qs = s.toString();
    return `/master/mapping${qs ? `?${qs}` : ""}`;
  };

  const productOptions = [
    { value: "", label: "— Belum dipetakan —" },
    ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapping SKU"
        description="Satu product bisa punya SKU berbeda di tiap marketplace. Hubungkan tiap SKU ke product internal supaya penjualannya masuk pembukuan."
      />

      {totalUnmapped > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="shrink-0 text-amber-500" />
          <span>
            <strong>{totalUnmapped} SKU belum dipetakan.</strong> Penjualannya belum dihitung sampai dipetakan.
          </span>
        </div>
      )}

      <Card className="p-5">
        <MappingFilters stores={stores} />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={`SKU Marketplace (${total})`}
          subtitle="Baris kuning = belum dipetakan."
          action={<PaginationControls page={page} totalPages={totalPages} hrefFor={pageHref} />}
        />
        {mappings.length === 0 ? (
          anyFilter ? (
            <EmptyState
              icon={<Search size={40} />}
              title="Tidak ada SKU yang cocok"
              description="Coba ubah atau reset filter di atas."
            />
          ) : (
            <EmptyState
              icon={<Link2 size={40} />}
              title="Belum ada SKU"
              description="Daftar SKU terisi otomatis saat order pertama masuk dari sync marketplace."
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Toko</th>
                  <th className="px-5 py-3 font-medium">SKU Marketplace</th>
                  <th className="px-5 py-3 font-medium">Nama di Marketplace</th>
                  <th className="px-5 py-3 font-medium">Product Internal</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr
                    key={m.id}
                    className={`border-b border-slate-50 last:border-0 ${
                      !m.productId ? "bg-amber-50/50" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-5 py-3">
                      <Badge color="slate">{MARKETPLACE_LABEL[m.store.marketplace]}</Badge>
                      <p className="mt-1 text-xs text-slate-400">{m.store.name}</p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{m.marketplaceSku}</td>
                    <td className="px-5 py-3 text-slate-600">{m.marketplaceProductName}</td>
                    <td className="px-5 py-3">
                      <MappingRow
                        mappingId={m.id}
                        initialProductId={m.productId ?? ""}
                        action={assignMapping}
                        options={productOptions}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          from={fromRow}
          to={toRow}
          hrefFor={pageHref}
          unit="SKU"
        />
      </Card>
    </div>
  );
}
