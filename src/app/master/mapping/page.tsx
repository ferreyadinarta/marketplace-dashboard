import { Link2, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MARKETPLACE_LABEL } from "@/lib/format";
import { assignMapping } from "./actions";
import { Card, CardHeader, PageHeader, Badge, EmptyState } from "@/components/ui";
import { MappingRow } from "@/components/EditableRows";

export const dynamic = "force-dynamic";

export default async function MappingPage() {
  const [mappings, products] = await Promise.all([
    prisma.productMapping.findMany({
      include: { store: true, product: true },
      orderBy: [{ productId: "asc" }, { marketplaceSku: "asc" }],
    }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
  ]);

  const unmapped = mappings.filter((m) => !m.productId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapping SKU"
        description="Satu product bisa punya SKU berbeda di tiap marketplace. Hubungkan tiap SKU ke product internal supaya penjualannya masuk pembukuan."
      />

      {unmapped.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="shrink-0 text-amber-500" />
          <span>
            <strong>{unmapped.length} SKU belum dipetakan.</strong> Penjualannya belum dihitung sampai dipetakan.
          </span>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          title={`SKU Marketplace (${mappings.length})`}
          subtitle="Baris kuning = belum dipetakan."
        />
        {mappings.length === 0 ? (
          <EmptyState
            icon={<Link2 size={40} />}
            title="Belum ada SKU"
            description="Daftar SKU terisi otomatis saat order pertama masuk dari sync marketplace."
          />
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
                        options={[
                          { value: "", label: "— Belum dipetakan —" },
                          ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
