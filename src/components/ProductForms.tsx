"use client";

import { useState, useRef, useEffect, useLayoutEffect, type FormEvent } from "react";
import { useFormStatus, createPortal } from "react-dom";
import { Plus, FolderPlus, X, Package, Boxes } from "lucide-react";
import { Field, inputClass, inputErrorClass, Select, type SelectOption } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { CurrencyInput } from "@/components/CurrencyInput";
import { type UnitInfo } from "@/lib/units";
import {
  BundleComponentList,
  compsToPayload,
  emptyCompRow,
  type CompRow,
} from "@/components/BundleComponentList";
import { useT } from "@/components/LangProvider";

type Group = { id: string; name: string };
type Action = (formData: FormData) => void | Promise<void>;
type Mode = "plain" | "bundle";

// Pantau status submit form induk; saat selesai → panggil reset.
// Harus komponen sendiri karena useFormStatus wajib berada DI DALAM <form>.
function ResetAfterSave({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const prev = useRef(false);
  const cb = useRef(onDone);

  useEffect(() => {
    cb.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!pending && prev.current) cb.current();
    prev.current = pending;
  }, [pending]);

  return null;
}

// ---------- Tambah Product (validasi custom) ----------
export function AddProductForm({
  groups,
  action,
  productOptions = [],
  unitOf,
}: {
  groups: Group[];
  action: Action;
  productOptions?: SelectOption[]; // calon isi bundle (product biasa saja)
  unitOf?: Record<string, UnitInfo>;
}) {
  const t = useT();
  const [errors, setErrors] = useState<{ name?: string; sku?: string }>({});
  const [mainUnit, setMainUnit] = useState("box");
  const [smallUnit, setSmallUnit] = useState("");
  const [koliUnit, setKoliUnit] = useState("koli");
  // Bundle = product yang isinya product lain (mis. box mix 3 rasa). Fieldnya
  // beda: tidak punya HPP (dihitung dari isinya) & tidak punya satuan kecil/koli.
  const [mode, setMode] = useState<Mode>("plain");
  const [comps, setComps] = useState<CompRow[]>([emptyCompRow()]);
  const isBundle = mode === "bundle";
  // Ganti key = form di-mount ulang → semua isian bersih, termasuk komponen
  // yang menyimpan state sendiri (CurrencyInput, Select) yang tidak ikut
  // form.reset() bawaan browser.
  const [formKey, setFormKey] = useState(0);

  // Setelah tersimpan: kosongkan form di tempat. Server action-nya sengaja tidak
  // redirect, jadi halaman tidak melompat ke atas — user bisa langsung
  // mengetik product berikutnya.
  const resetForm = () => {
    setMainUnit("box");
    setSmallUnit("");
    setKoliUnit("koli");
    setComps([emptyCompRow()]);
    setErrors({});
    setFormKey((k) => k + 1);
  };

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const sku = String(fd.get("sku") ?? "").trim();
    const errs: { name?: string; sku?: string } = {};
    if (!name) errs.name = t("Nama product wajib diisi.", "Product name is required.");
    if (!sku) errs.sku = t("SKU internal wajib diisi.", "Internal SKU is required.");
    if (Object.keys(errs).length) {
      e.preventDefault();
      setErrors(errs);
    } else {
      setErrors({});
    }
  }

  const clear = (k: "name" | "sku") =>
    setErrors((s) => ({ ...s, [k]: undefined }));

  return (
    <form
      key={formKey}
      action={action}
      onSubmit={validate}
      noValidate
      className="grid gap-4 p-5 sm:grid-cols-2"
    >
      <input type="hidden" name="isBundle" value={isBundle ? "true" : "false"} />
      {isBundle && (
        <input type="hidden" name="components" value={JSON.stringify(compsToPayload(comps, unitOf))} />
      )}

      {/* pilih jenis dulu: field yang tampil menyesuaikan */}
      <div className="sm:col-span-2">
        <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
          {([
            { key: "plain", label: t("Product biasa", "Regular product"), icon: <Package size={14} /> },
            { key: "bundle", label: t("Bundle (isi campur)", "Bundle (mixed contents)"), icon: <Boxes size={14} /> },
          ] as const).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === m.key
                  ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
        {isBundle && (
          <p className="mt-2 text-xs text-slate-500">
            {t(
              "Bundle tidak punya stok & HPP sendiri: stok yang berkurang adalah isinya, modalnya = jumlah HPP isinya. Isi satuan jual saja (mis. box), lalu daftar isinya di bawah.",
              "A bundle has no stock or COGS of its own: the stock that decreases is its contents, and its cost is the sum of their COGS. Just fill in the selling unit (e.g. box), then list its contents below."
            )}
          </p>
        )}
      </div>

      <Field label={t("Nama product", "Product name")} error={errors.name}>
        <input
          name="name"
          onInput={() => errors.name && clear("name")}
          placeholder={t("mis: Flimty Fiber Blackcurrant", "e.g. Flimty Fiber Blackcurrant")}
          className={`${inputClass} ${errors.name ? inputErrorClass : ""}`}
        />
      </Field>
      <Field
        label={t("SKU internal", "Internal SKU")}
        hint={t("Kode unik product versi kamu sendiri, bukan SKU marketplace.", "Your own unique product code, not the marketplace SKU.")}
        error={errors.sku}
      >
        <input
          name="sku"
          onInput={() => errors.sku && clear("sku")}
          placeholder={t("mis: FLM-FIBER-BC", "e.g. FLM-FIBER-BC")}
          className={`${inputClass} ${errors.sku ? inputErrorClass : ""}`}
        />
      </Field>
      {!isBundle && (
        <Field
          label={t(
            `HPP / Modal per ${mainUnit.trim() || "satuan utama"} (Rp)`,
            `COGS per ${mainUnit.trim() || "main unit"} (Rp)`
          )}
          hint={t(
            `Modal untuk 1 ${mainUnit.trim() || "satuan utama"}, satuan yang biasa kamu beli. Bukan per ${smallUnit.trim() || "satuan kecil"}, bukan per koli.`,
            `Cost for 1 ${mainUnit.trim() || "main unit"}, the unit you usually buy in. Not per ${smallUnit.trim() || "small unit"}, not per carton.`
          )}
        >
          <CurrencyInput name="hpp" placeholder="0" />
        </Field>
      )}
      <Field
        label={isBundle ? t("Satuan jual", "Selling unit") : t("Satuan utama", "Main unit")}
        hint={
          isBundle
            ? t("Satuan saat bundle ini dijual (mis. box). Isi per box diatur di daftar isi.", "The unit this bundle is sold in (e.g. box). Contents per box are set in the list below.")
            : t("Satuan yang biasa dipakai (mis. box, botol, pcs).", "The unit you normally use (e.g. box, bottle, pcs).")
        }
      >
        <input
          name="mainUnit"
          value={mainUnit}
          onChange={(e) => setMainUnit(e.target.value)}
          placeholder={t("mis: box", "e.g. box")}
          className={inputClass}
        />
      </Field>
      {/* satuan kecil / isi / koli tidak berlaku untuk bundle: isinya diatur
          lewat daftar isi, bukan lewat konversi satuan */}
      {!isBundle && (
        <>
          <Field
            label={t("Satuan kecil (opsional)", "Small unit (optional)")}
            hint={t("Kalau kadang dijual eceran lebih kecil (mis. sachet). Kosongkan kalau tidak ada.", "If sometimes sold in a smaller unit (e.g. sachet). Leave blank if there isn't one.")}
          >
            <input
              name="smallUnit"
              value={smallUnit}
              onChange={(e) => setSmallUnit(e.target.value)}
              placeholder={t("mis: sachet", "e.g. sachet")}
              className={inputClass}
            />
          </Field>
          <Field
            label={t(
              `Isi (1 ${mainUnit.trim() || "utama"} = ? ${smallUnit.trim() || "kecil"})`,
              `Contains (1 ${mainUnit.trim() || "main"} = ? ${smallUnit.trim() || "small"})`
            )}
            hint={t("Contoh: 1 box = 12 sachet, isi 12. Kosong/0 kalau tanpa satuan kecil.", "Example: 1 box = 12 sachets, enter 12. Leave blank/0 if there's no small unit.")}
          >
            <input name="isi" type="number" min="0" placeholder={t("mis: 12", "e.g. 12")} className={inputClass} />
          </Field>
          <Field
            label={t("Satuan koli (opsional)", "Carton unit (optional)")}
            hint={t("Satuan terbesar saat barang masuk (mis. koli = dus isi beberapa box). Kosongkan kalau tidak ada.", "The largest unit for incoming stock (e.g. carton = a box containing several boxes). Leave blank if there isn't one.")}
          >
            <input
              name="koliUnit"
              value={koliUnit}
              onChange={(e) => setKoliUnit(e.target.value)}
              placeholder={t("mis: koli", "e.g. carton")}
              className={inputClass}
            />
          </Field>
          <Field
            label={t(
              `Isi koli (1 ${koliUnit.trim() || "koli"} = ? ${mainUnit.trim() || "box"})`,
              `Carton contents (1 ${koliUnit.trim() || "carton"} = ? ${mainUnit.trim() || "box"})`
            )}
            hint={t("Contoh: 1 koli = 6 box, isi 6. Butuh satuan kecil/isi dulu (koli dihitung dari box).", "Example: 1 carton = 6 boxes, enter 6. Requires the small unit/contents to be set first (carton is calculated from box).")}
          >
            <input name="isiKoli" type="number" min="0" placeholder={t("mis: 6", "e.g. 6")} className={inputClass} />
          </Field>
        </>
      )}
      <Field label={t("Harga retail (Rp)", "Retail price (Rp)")} hint={t("Default harga jual WA/offline. Bisa diubah saat mencatat penjualan.", "Default selling price for WA/offline sales. Can be changed when recording a sale.")}>
        <CurrencyInput name="priceRetail" placeholder="0" />
      </Field>
      <Field label={t("Harga grosir (Rp)", "Wholesale price (Rp)")} hint={t("Default harga jual ke reseller. Bisa diubah saat mencatat penjualan.", "Default selling price to resellers. Can be changed when recording a sale.")}>
        <CurrencyInput name="priceGrosir" placeholder="0" />
      </Field>
      <Field label={t("Grup pembukuan", "Bookkeeping group")}>
        <Select
          name="groupId"
          placeholder={t("Tanpa grup", "No group")}
          options={[
            { value: "", label: t("Tanpa grup", "No group") },
            ...groups.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
      </Field>
      {isBundle && (
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-slate-700">{t("Isi bundle", "Bundle contents")}</p>
          <BundleComponentList
            rows={comps}
            onChange={setComps}
            productOptions={productOptions}
            unitOf={unitOf}
          />
          <p className="mt-2 text-xs text-slate-400">
            {t(
              "Contoh box mix 3 rasa: tiap rasa 4 sachet. Jumlah ditulis dalam satuan product isinya.",
              "Example, a box mixing 3 flavors: 4 sachets of each flavor. Quantities are written in each content product's own unit."
            )}
          </p>
        </div>
      )}

      <ResetAfterSave onDone={resetForm} />

      <div className="sm:col-span-2">
        <SubmitButton
          variant="primary"
          icon={<Plus size={16} />}
          pendingText={t("Menyimpan…", "Saving…")}
          notify={isBundle ? t("Bundle ditambahkan", "Bundle added") : t("Product ditambahkan", "Product added")}
        >
          {isBundle ? t("Simpan Bundle", "Save bundle") : t("Simpan Product", "Save product")}
        </SubmitButton>
      </div>
    </form>
  );
}

// chip grup dengan tombol hapus + konfirmasi kecil
const POPOVER_W = 224; // w-56

function GroupChip({ group, deleteAction }: { group: Group; deleteAction: Action }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function toggle() {
    setOpen((o) => {
      if (o) setPos(null);
      return !o;
    });
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Popover di-portal ke body + position:fixed: daftar chip punya
  // overflow-y-auto, jadi popover absolute kepotong dan konfirmasinya tidak
  // kelihatan sama sekali.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const w = popRef.current?.offsetWidth ?? POPOVER_W;
      const h = popRef.current?.offsetHeight ?? 120;
      const M = 8;
      const spaceBelow = window.innerHeight - r.bottom;
      const up = spaceBelow < h + M && r.top > spaceBelow;
      const top = up
        ? Math.max(M, r.top - h - 4)
        : Math.min(r.bottom + 4, Math.max(M, window.innerHeight - h - M));
      const left = Math.max(M, Math.min(r.left, window.innerWidth - w - M));
      setPos({ top, left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex max-w-full">
      <span className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-3 pr-1 text-xs font-medium text-indigo-700">
        <span className="truncate">{group.name}</span>
        <button
          type="button"
          onClick={toggle}
          aria-label={t(`Hapus grup ${group.name}`, `Delete group ${group.name}`)}
          className="shrink-0 rounded-full p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-red-600"
        >
          <X size={12} />
        </button>
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            className="animate-pop fixed z-[300] w-56 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg"
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? "visible" : "hidden",
            }}
          >
            <p className="text-xs leading-relaxed text-slate-600 [overflow-wrap:anywhere]">
              {t("Hapus grup", "Delete group")} <span className="font-semibold text-slate-800">{group.name}</span>?{" "}
              {t("Product-nya jadi", "Its products become")}{" "}
              <span className="font-medium">{t("tanpa grup", "ungrouped")}</span> ({t("tidak ikut terhapus", "they are not deleted")}).
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                {t("Batal", "Cancel")}
              </button>
              <form action={deleteAction} onSubmit={() => setOpen(false)}>
                <input type="hidden" name="id" value={group.id} />
                <SubmitButton variant="danger" className="px-2.5 py-1 text-xs" pendingText="…">
                  {t("Hapus", "Delete")}
                </SubmitButton>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// ---------- Tambah Grup (validasi custom) ----------
export function AddGroupForm({
  groups,
  action,
  deleteAction,
}: {
  groups: Group[];
  action: Action;
  deleteAction: Action;
}) {
  const t = useT();
  const [error, setError] = useState<string | undefined>();

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      e.preventDefault();
      setError(t("Nama grup wajib diisi.", "Group name is required."));
    } else if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      e.preventDefault();
      setError(t("Grup dengan nama ini sudah ada.", "A group with this name already exists."));
    } else {
      setError(undefined);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <form action={action} onSubmit={validate} noValidate className="space-y-4">
        <Field label={t("Nama grup", "Group name")} error={error}>
          <input
            name="name"
            onInput={() => error && setError(undefined)}
            placeholder={t("mis: Flimty", "e.g. Flimty")}
            className={`${inputClass} ${error ? inputErrorClass : ""}`}
          />
        </Field>
        <SubmitButton variant="outline" icon={<FolderPlus size={16} />} pendingText={t("Menyimpan…", "Saving…")}>
          {t("Tambah Grup", "Add group")}
        </SubmitButton>
      </form>
      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto pt-1">
        {groups.length ? (
          groups.map((g) => <GroupChip key={g.id} group={g} deleteAction={deleteAction} />)
        ) : (
          <span className="text-xs text-slate-400">{t("Belum ada grup", "No groups yet")}</span>
        )}
      </div>
    </div>
  );
}
