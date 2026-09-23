"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Copy, Sparkles, Boxes } from "lucide-react";
import { Select, type SelectOption, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { CurrencyInput } from "@/components/CurrencyInput";
import { DeleteProductButton } from "@/components/ProductControls";
import { BundleEditor } from "@/components/BundleEditor";
import { rupiah } from "@/lib/format";
import { tiersOf, splitBase, type UnitInfo } from "@/lib/units";
import { Collapse } from "@/components/Collapse";
import { useT } from "@/components/LangProvider";

type Action = (formData: FormData) => void | Promise<void>;

// ---------- Kartu Product (Master Product) — expandable editor ----------
export function ProductRow({
  id,
  name,
  sku,
  hpp,
  priceRetail,
  priceGrosir,
  unit,
  packUnit,
  packSize,
  koliUnit,
  koliSize,
  groupId,
  groupName,
  groupOptions,
  isBundle,
  components,
  productOptions,
  unitOf,
  updateAction,
  bundleAction,
  deleteAction,
  duplicateAction,
}: {
  id: string;
  name: string;
  sku: string;
  hpp: number;
  priceRetail: number;
  priceGrosir: number;
  unit: string;
  packUnit: string;
  packSize: number;
  koliUnit: string;
  koliSize: number;
  groupId: string;
  groupName?: string;
  groupOptions: SelectOption[];
  isBundle: boolean;
  components: { componentId: string; qty: number }[];
  productOptions: SelectOption[]; // product lain (calon isi bundle)
  unitOf?: Record<string, UnitInfo>; // satuan tiap product (untuk isi bundle)
  updateAction: Action;
  bundleAction: Action;
  deleteAction: Action;
  duplicateAction: Action;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // tampilan "box-first": satuan utama = pack kalau ada, kecil = base
  const [mainUnit, setMainUnit] = useState(packSize > 0 ? packUnit : unit);
  const [smallUnit, setSmallUnit] = useState(packSize > 0 ? unit : "");
  // default "koli" (satuan terbesar hampir selalu koli), tetap bisa diganti user.
  // Kalau isi koli tidak diisi, teks ini diabaikan → aman.
  const [koliU, setKoliU] = useState(koliUnit || "koli");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">{name}</p>
            {isBundle && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                <Boxes size={11} /> Bundle
              </span>
            )}
          </div>
          <p className="font-mono text-xs text-slate-500">{sku}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
              open ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Pencil size={14} /> {open ? t("Tutup", "Close") : t("Edit", "Edit")}
          </button>
          <form action={duplicateAction}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              title={t("Duplikat product", "Duplicate product")}
              aria-label={t(`Duplikat ${name}`, `Duplicate ${name}`)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Copy size={15} />
            </button>
          </form>
          <DeleteProductButton id={id} name={name} action={deleteAction} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
        {!isBundle && (
          <span className={hpp === 0 ? "text-amber-600" : ""}>
            {t("HPP", "COGS")} <b className={hpp === 0 ? "text-amber-700" : "text-slate-700"}>{hpp === 0 ? t("belum diisi", "not set") : rupiah(hpp)}</b>
          </span>
        )}
        <span>{t("Retail", "Retail")} <b className="text-slate-700">{rupiah(priceRetail)}</b></span>
        <span>{t("Grosir", "Wholesale")} <b className="text-slate-700">{rupiah(priceGrosir)}</b></span>
        <span>{t("Satuan", "Unit")} <b className="text-slate-700">{mainUnit}</b></span>
        {!isBundle && packSize > 0 && (
          <span>
            1 {packUnit} = <b className="text-slate-700">{packSize} {unit}</b>
          </span>
        )}
        {!isBundle && koliSize > 0 && (
          <span>
            1 {koliUnit} = <b className="text-slate-700">{koliSize} {packUnit}</b>
          </span>
        )}
        {groupName && <span>{t("Grup", "Group")} <b className="text-slate-700">{groupName}</b></span>}
      </div>

      <Collapse open={open}>
        <form
          action={updateAction}
          className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <input type="hidden" name="id" value={id} />
          <Field label={t("Nama product", "Product name")}>
            <input
              name="name"
              defaultValue={name}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          <Field
            label={t("SKU internal", "Internal SKU")}
            hint={t("Kode unik product. Kalau bentrok dengan SKU lain, perubahan SKU diabaikan.", "The product's unique code. If it clashes with another SKU, the change is ignored.")}
          >
            <input
              name="sku"
              defaultValue={sku}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          {isBundle ? (
            // bundle: modal = jumlah HPP isinya, jadi field-nya tidak ditampilkan
            <input type="hidden" name="hpp" value={0} />
          ) : (
            <Field
              label={t(
                `HPP / Modal per ${mainUnit.trim() || "satuan utama"} (Rp)`,
                `COGS per ${mainUnit.trim() || "main unit"} (Rp)`
              )}
              hint={t(
                `Modal untuk 1 ${mainUnit.trim() || "satuan utama"} (bukan per ${smallUnit.trim() || "satuan kecil"}). Dipakai menghitung profit, bukan harga jual.`,
                `Cost for 1 ${mainUnit.trim() || "main unit"} (not per ${smallUnit.trim() || "small unit"}). Used to calculate profit, not the selling price.`
              )}
            >
              <CurrencyInput name="hpp" defaultValue={hpp} />
            </Field>
          )}
          <Field
            label={t("Harga retail (Rp)", "Retail price (Rp)")}
            hint={t("Harga jual eceran ke pembeli langsung. Jadi default saat mencatat penjualan WA/offline.", "Retail price to direct buyers. Becomes the default when recording a WA/offline sale.")}
          >
            <CurrencyInput name="priceRetail" defaultValue={priceRetail} />
          </Field>
          <Field
            label={t("Harga grosir (Rp)", "Wholesale price (Rp)")}
            hint={t("Harga jual ke reseller/toko (lebih murah). Jadi default saat mencatat penjualan grosir.", "Selling price to resellers/stores (cheaper). Becomes the default when recording a wholesale sale.")}
          >
            <CurrencyInput name="priceGrosir" defaultValue={priceGrosir} />
          </Field>
          <Field
            label={isBundle ? t("Satuan jual", "Selling unit") : t("Satuan utama", "Main unit")}
            hint={
              isBundle
                ? t("Satuan saat bundle ini dijual (mis. box). Isinya diatur di daftar isi bundle di bawah.", "The unit this bundle is sold in (e.g. box). Its contents are set in the bundle contents list below.")
                : t("Satuan yang biasa dipakai (mis. box, botol, pcs).", "The unit you normally use (e.g. box, bottle, pcs).")
            }
          >
            <input
              name="mainUnit"
              value={mainUnit}
              onChange={(e) => setMainUnit(e.target.value)}
              placeholder="box"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </Field>
          {!isBundle && (
            <Field
              label={t("Satuan kecil (opsional)", "Small unit (optional)")}
              hint={t("Kalau kadang dijual eceran lebih kecil (mis. sachet). Kosongkan kalau tidak ada.", "If sometimes sold in a smaller unit (e.g. sachet). Leave blank if there isn't one.")}
            >
              <input
                name="smallUnit"
                value={smallUnit}
                onChange={(e) => setSmallUnit(e.target.value)}
                placeholder={t("mis: sachet", "e.g. sachet")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </Field>
          )}
          {/* isi/koli tidak berlaku untuk bundle — isinya dari daftar isi di bawah */}
          {!isBundle && (
            <>
              <Field
                label={t(
                  `Isi (1 ${mainUnit.trim() || "utama"} = ? ${smallUnit.trim() || "kecil"})`,
                  `Contains (1 ${mainUnit.trim() || "main"} = ? ${smallUnit.trim() || "small"})`
                )}
                hint={t("Contoh: 1 box = 12 sachet, isi 12. Kosong/0 kalau tanpa satuan kecil.", "Example: 1 box = 12 sachets, enter 12. Leave blank/0 if there's no small unit.")}
              >
                <input
                  name="isi"
                  type="number"
                  min="0"
                  defaultValue={packSize || ""}
                  placeholder="12"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </Field>
              <Field
                label={t("Satuan koli (opsional)", "Carton unit (optional)")}
                hint={t("Satuan terbesar saat barang masuk (mis. koli = dus isi beberapa box). Kosongkan kalau tidak ada.", "The largest unit for incoming stock (e.g. carton = a box containing several boxes). Leave blank if there isn't one.")}
              >
                <input
                  name="koliUnit"
                  value={koliU}
                  onChange={(e) => setKoliU(e.target.value)}
                  placeholder={t("mis: koli", "e.g. carton")}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </Field>
              <Field
                label={t(
                  `Isi koli (1 ${koliU.trim() || "koli"} = ? ${mainUnit.trim() || "box"})`,
                  `Carton contents (1 ${koliU.trim() || "carton"} = ? ${mainUnit.trim() || "box"})`
                )}
                hint={t("Contoh: 1 koli = 6 box, isi 6. Butuh satuan kecil/isi dulu (koli dihitung dari box).", "Example: 1 carton = 6 boxes, enter 6. Requires the small unit/contents to be set first (carton is calculated from box).")}
              >
                <input
                  name="isiKoli"
                  type="number"
                  min="0"
                  defaultValue={koliSize || ""}
                  placeholder="6"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </Field>
            </>
          )}
          <Field label={t("Grup pembukuan", "Bookkeeping group")}>
            <Select name="groupId" defaultValue={groupId} placeholder={t("Tanpa grup", "No group")} options={groupOptions} />
          </Field>
          <div className="flex items-end">
            <SubmitButton variant="primary" pendingText={t("Menyimpan…", "Saving…")} notify={t("Product tersimpan", "Product saved")}>
              {t("Simpan", "Save")}
            </SubmitButton>
          </div>
        </form>

        {/* Bundle (isi gabungan): form terpisah karena aksinya beda.
            Dipakai untuk listing "mix" — 1 box berisi beberapa product sekaligus. */}
        <BundleEditor
          productId={id}
          initialIsBundle={isBundle}
          initialComponents={components}
          productOptions={productOptions}
          unitOf={unitOf}
          action={bundleAction}
        />
      </Collapse>
    </div>
  );
}

// ---------- Baris Mapping SKU ----------
// Satu product DASAR bisa punya banyak varian marketplace ("1 box" vs "10 sachet"),
// jadi selain product-nya, baris ini juga menyimpan ISI per unit yang dijual.
//
// Yang DISIMPAN selalu satuan dasar (sachet). Tapi mengetik "24" untuk varian
// 2 BOX gampang salah, jadi input-nya sama seperti Stok Opname: angka + toggle
// satuan (koli › box › sachet) mengikuti satuan product yang dipilih.
export type MappingUnitInfo = UnitInfo;

export function MappingRow({
  mappingId,
  initialProductId,
  initialBaseQty,
  unitInfo,
  suggestion,
  options,
  action,
}: {
  mappingId: string;
  initialProductId: string;
  initialBaseQty: number;
  unitInfo?: Record<string, MappingUnitInfo>; // per productId — ikut dropdown, bukan cuma yang tersimpan
  suggestion?: { productId: string; productName: string; baseQty: number } | null;
  options: SelectOption[];
  action: Action;
}) {
  const t = useT();
  const [value, setValue] = useState(initialProductId);
  const tiers = tiersOf(unitInfo?.[value]);

  const init = splitBase(Math.max(1, initialBaseQty || 1), tiers);
  const [qty, setQty] = useState(String(init.qty));
  const [tier, setTier] = useState(init.tier);

  const factor = tiers.find((tr) => tr.key === tier)?.factor ?? 1;
  const baseQty = Math.max(1, Math.floor(Number(qty) || 0)) * factor;
  const baseUnit = tiers[tiers.length - 1].label;
  const dirty = value !== initialProductId || baseQty !== (initialBaseQty || 1);

  // ganti product → satuannya bisa beda; pertahankan jumlah dalam satuan dasar
  const chooseProduct = (next: string) => {
    const nextTiers = tiersOf(unitInfo?.[next]);
    const s = splitBase(baseQty, nextTiers);
    setValue(next);
    setQty(String(s.qty));
    setTier(s.tier);
  };

  // Pakai saran = langsung tersimpan. Baris ini isinya cuma product + isi, dan
  // saran sudah mengisi keduanya, jadi menyuruh user klik Simpan lagi cuma
  // menambah 1 klik × ribuan baris.
  const formRef = useRef<HTMLFormElement>(null);
  const wantSubmit = useRef(false);

  const applySuggestion = () => {
    if (!suggestion) return;
    const nextTiers = tiersOf(unitInfo?.[suggestion.productId]);
    const s = splitBase(Math.max(1, suggestion.baseQty), nextTiers);
    setValue(suggestion.productId);
    setQty(String(s.qty));
    setTier(s.tier);
    wantSubmit.current = true; // dikirim setelah state kepasang (efek di bawah)
  };

  useEffect(() => {
    if (!wantSubmit.current) return;
    wantSubmit.current = false;
    formRef.current?.requestSubmit();
  }, [value, qty, tier]);

  return (
    <form ref={formRef} action={action} className="w-full space-y-1.5">
      <input type="hidden" name="mappingId" value={mappingId} />
      {/* yang dikirim ke server tetap satuan dasar */}
      <input type="hidden" name="baseQtyPerUnit" value={baseQty} />

      {/* saran otomatis — DI ATAS input-nya supaya jelas milik baris ini,
          dan hanya muncul selama belum dipetakan */}
      {suggestion && !value && (
        <button
          type="button"
          onClick={applySuggestion}
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-left text-xs text-indigo-700 hover:bg-indigo-100"
        >
          <Sparkles size={12} className="shrink-0" />
          <span className="truncate">
            {t("Saran", "Suggestion")}: <b>{suggestion.productName}</b> · {t("isi", "contains")} {suggestion.baseQty}
          </span>
          <span className="shrink-0 font-semibold underline">{t("Pakai & simpan", "Use & save")}</span>
        </button>
      )}

      <div className="flex w-full flex-wrap items-center gap-2">
        {/* di layar sempit dropdown ambil satu baris penuh; kalau tidak, kolom isi + tombol menggencetnya sampai 0px */}
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <Select
            name="productId"
            value={value}
            onValueChange={chooseProduct}
            placeholder={t("Belum dipetakan", "Not mapped yet")}
            className="w-full"
            options={options}
            searchable
          />
        </div>

        {/* Isi baru berarti kalau product-nya sudah dipilih — sebelum itu
            satuannya belum diketahui, jadi kolomnya disembunyikan biar bersih. */}
        {value && (
          <div className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
            {t("isi", "contains")}
            <input
              aria-label={t("Isi per unit yang dijual", "Quantity per unit sold")}
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              title={t(
                `Berapa banyak untuk 1 unit yang dijual di marketplace (disimpan sebagai ${baseUnit})`,
                `How many for 1 unit sold on the marketplace (stored as ${baseUnit})`
              )}
              className="h-9 w-14 rounded-lg border border-slate-300 px-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {tiers.length > 1 ? (
              <div className="flex h-9 overflow-hidden rounded-lg border border-slate-300 text-[11px]">
                {tiers.map((tr) => (
                  <button
                    key={tr.key}
                    type="button"
                    onClick={() => setTier(tr.key)}
                    className={
                      tier === tr.key
                        ? "bg-indigo-600 px-2 font-medium text-white"
                        : "px-2 text-slate-600 hover:bg-slate-50"
                    }
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="whitespace-nowrap text-slate-400">{baseUnit}</span>
            )}
          </div>
        )}
        <SubmitButton
          variant={dirty ? "primary" : "ghost"}
          disabled={!dirty}
          className={`w-20 shrink-0 justify-center px-2 py-2 text-xs ${dirty ? "ring-2 ring-indigo-200" : "text-slate-400"}`}
          pendingText="…"
        >
          {dirty ? t("Simpan", "Save") : t("Tersimpan", "Saved")}
        </SubmitButton>
      </div>

      {/* total dalam satuan dasar — cuma perlu ditampilkan kalau bukan 1:1 */}
      {value && factor > 1 && (
        <p className="text-[11px] text-slate-400">
          = {baseQty} {baseUnit} {t("per 1 unit terjual", "per unit sold")}
        </p>
      )}

    </form>
  );
}
