import { Plus, Store as StoreIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { tanggal, MARKETPLACE_LABEL } from "@/lib/format";
import { createStore, updateStoreCredentials, deleteStore } from "./actions";
import { Card, CardHeader, PageHeader, Button, Field, inputClass, Select, Checkbox, Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const mpColor: Record<string, "amber" | "slate" | "green"> = {
  SHOPEE: "amber",
  TIKTOK: "slate",
  TOKOPEDIA: "green",
};

export default async function MasterTokoPage() {
  const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Toko"
        description="Daftarkan tiap toko dan isi kredensial API-nya. Kredensial dipakai untuk menarik order otomatis."
      />

      <Card>
        <CardHeader title="Tambah Toko" />
        <form action={createStore} className="flex flex-wrap items-end gap-4 p-5">
          <Field label="Nama toko">
            <input name="name" placeholder="mis. Toko Utama Shopee" required className={inputClass} />
          </Field>
          <Field label="Marketplace">
            <Select
              name="marketplace"
              defaultValue="SHOPEE"
              className="min-w-44"
              options={[
                { value: "SHOPEE", label: "Shopee" },
                { value: "TIKTOK", label: "TikTok Shop" },
                { value: "TOKOPEDIA", label: "Tokopedia" },
              ]}
            />
          </Field>
          <Button variant="primary">
            <Plus size={16} /> Tambah Toko
          </Button>
        </form>
      </Card>

      {stores.length === 0 ? (
        <Card>
          <EmptyState
            icon={<StoreIcon size={40} />}
            title="Belum ada toko"
            description="Tambahkan toko pertama kakak lewat form di atas."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {stores.map((s) => {
            const connected = !!s.apiKey && !!s.apiSecret && !!s.shopIdApi;
            return (
              <Card key={s.id} className="p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <StoreIcon size={18} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-900">{s.name}</h2>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge color={mpColor[s.marketplace] ?? "slate"}>
                          {MARKETPLACE_LABEL[s.marketplace] ?? s.marketplace}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {s.lastSyncAt ? `Sync: ${tanggal(s.lastSyncAt)}` : "Belum pernah sync"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {connected ? (
                      <Badge color="green">
                        <CheckCircle2 size={13} /> Terhubung
                      </Badge>
                    ) : (
                      <Badge color="amber">
                        <AlertCircle size={13} /> Belum terhubung
                      </Badge>
                    )}
                    <form action={deleteStore}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-xs font-medium text-red-500 hover:underline">Hapus</button>
                    </form>
                  </div>
                </div>
                <form action={updateStoreCredentials} className="grid gap-3 sm:grid-cols-3">
                  <input type="hidden" name="id" value={s.id} />
                  <Field label="API Key">
                    <input name="apiKey" defaultValue={s.apiKey ?? ""} placeholder="dari developer marketplace" className={inputClass} />
                  </Field>
                  <Field label="API Secret">
                    <input name="apiSecret" defaultValue={s.apiSecret ?? ""} placeholder="rahasia, jangan dibagikan" className={inputClass} />
                  </Field>
                  <Field label="Shop ID" hint="ID toko di sisi marketplace, biasanya angka.">
                    <input name="shopIdApi" defaultValue={s.shopIdApi ?? ""} placeholder="mis. 1029384756" className={inputClass} />
                  </Field>
                  <div className="flex items-center">
                    <Checkbox name="isActive" defaultChecked={s.isActive} label="Toko aktif (ikut sync)" />
                  </div>
                  <div className="sm:col-span-2 sm:flex sm:justify-end">
                    <Button variant="outline">Simpan Kredensial</Button>
                  </div>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
