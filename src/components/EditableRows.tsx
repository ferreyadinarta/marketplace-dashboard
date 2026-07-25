"use client";

import { useState } from "react";
import { Select, type SelectOption } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { DeleteProductButton } from "@/components/ProductControls";

type Action = (formData: FormData) => void | Promise<void>;

// ---------- Baris Product (Master Product) ----------
export function ProductRow({
  id,
  name,
  hpp,
  groupId,
  groupOptions,
  updateAction,
  deleteAction,
}: {
  id: string;
  name: string;
  hpp: number;
  groupId: string;
  groupOptions: SelectOption[];
  updateAction: Action;
  deleteAction: Action;
}) {
  const [hppVal, setHppVal] = useState(String(hpp));
  const [group, setGroup] = useState(groupId);
  const dirty = hppVal !== String(hpp) || group !== groupId;

  return (
    <div className="flex flex-nowrap items-end gap-2 whitespace-nowrap">
      <form action={updateAction} className="flex flex-nowrap items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <span className="flex flex-col">
          <span className="mb-1 text-[11px] font-medium text-slate-400">HPP (Rp)</span>
          <input
            name="hpp"
            type="number"
            min="0"
            value={hppVal}
            onChange={(e) => setHppVal(e.target.value)}
            className="h-9 w-32 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </span>
        <span className="flex flex-col">
          <span className="mb-1 text-[11px] font-medium text-slate-400">Grup</span>
          <Select
            name="groupId"
            value={group}
            onValueChange={setGroup}
            placeholder="— Tanpa grup —"
            className="h-9 min-w-40 py-0"
            options={groupOptions}
          />
        </span>
        <SubmitButton
          variant={dirty ? "primary" : "outline"}
          disabled={!dirty}
          className={`h-9 py-0 ${dirty ? "ring-2 ring-indigo-200" : ""}`}
          pendingText="…"
        >
          {dirty ? "Simpan" : "Tersimpan"}
        </SubmitButton>
      </form>
      <DeleteProductButton id={id} name={name} action={deleteAction} />
    </div>
  );
}

// ---------- Baris Mapping SKU ----------
export function MappingRow({
  mappingId,
  initialProductId,
  options,
  action,
}: {
  mappingId: string;
  initialProductId: string;
  options: SelectOption[];
  action: Action;
}) {
  const [value, setValue] = useState(initialProductId);
  const dirty = value !== initialProductId;

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="mappingId" value={mappingId} />
      <Select
        name="productId"
        value={value}
        onValueChange={setValue}
        placeholder="— Belum dipetakan —"
        className="min-w-52"
        options={options}
      />
      <SubmitButton
        variant={dirty ? "primary" : "outline"}
        disabled={!dirty}
        className={`shrink-0 px-3 py-2 text-xs ${dirty ? "ring-2 ring-indigo-200" : ""}`}
        pendingText="…"
      >
        {dirty ? "Simpan" : "Tersimpan"}
      </SubmitButton>
    </form>
  );
}
