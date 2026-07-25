"use client";

import { useState, type FormEvent } from "react";
import { Plus, FolderPlus } from "lucide-react";
import {
  Field,
  inputClass,
  inputErrorClass,
  Select,
  Badge,
} from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

type Group = { id: string; name: string };
type Action = (formData: FormData) => void | Promise<void>;

// ---------- Tambah Product (validasi custom) ----------
export function AddProductForm({
  groups,
  action,
}: {
  groups: Group[];
  action: Action;
}) {
  const [errors, setErrors] = useState<{ name?: string; sku?: string }>({});

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const sku = String(fd.get("sku") ?? "").trim();
    const errs: { name?: string; sku?: string } = {};
    if (!name) errs.name = "Nama product wajib diisi.";
    if (!sku) errs.sku = "SKU internal wajib diisi.";
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
      action={action}
      onSubmit={validate}
      noValidate
      className="grid gap-4 p-5 sm:grid-cols-2"
    >
      <Field label="Nama product" error={errors.name}>
        <input
          name="name"
          onInput={() => errors.name && clear("name")}
          placeholder="ex: Flimty Fiber Blackcurrant"
          className={`${inputClass} ${errors.name ? inputErrorClass : ""}`}
        />
      </Field>
      <Field
        label="SKU internal"
        hint="Kode unik product versi kamu sendiri, bukan SKU marketplace."
        error={errors.sku}
      >
        <input
          name="sku"
          onInput={() => errors.sku && clear("sku")}
          placeholder="ex: FLM-FIBER-BC"
          className={`${inputClass} ${errors.sku ? inputErrorClass : ""}`}
        />
      </Field>
      <Field
        label="HPP / Modal (Rp)"
        hint="Harga Pokok Penjualan: modal untuk 1 unit product."
      >
        <input
          name="hpp"
          type="number"
          min="0"
          placeholder="0"
          className={inputClass}
        />
      </Field>
      <Field label="Grup pembukuan">
        <Select
          name="groupId"
          placeholder="— Tanpa grup —"
          options={[
            { value: "", label: "— Tanpa grup —" },
            ...groups.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton
          variant="primary"
          icon={<Plus size={16} />}
          pendingText="Menyimpan…"
        >
          Simpan Product
        </SubmitButton>
      </div>
    </form>
  );
}

// ---------- Tambah Grup (validasi custom) ----------
export function AddGroupForm({
  groups,
  action,
}: {
  groups: Group[];
  action: Action;
}) {
  const [error, setError] = useState<string | undefined>();

  function validate(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      e.preventDefault();
      setError("Nama grup wajib diisi.");
    } else {
      setError(undefined);
    }
  }

  return (
    <form
      action={action}
      onSubmit={validate}
      noValidate
      className="space-y-4 p-5"
    >
      <Field label="Nama grup" error={error}>
        <input
          name="name"
          onInput={() => error && setError(undefined)}
          placeholder="ex: Flimty"
          className={`${inputClass} ${error ? inputErrorClass : ""}`}
        />
      </Field>
      <SubmitButton
        variant="outline"
        icon={<FolderPlus size={16} />}
        pendingText="Menyimpan…"
      >
        Tambah Grup
      </SubmitButton>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {groups.length ? (
          groups.map((g) => (
            <Badge key={g.id} color="brand">
              {g.name}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-slate-400">Belum ada grup</span>
        )}
      </div>
    </form>
  );
}
