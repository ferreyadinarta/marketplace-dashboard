"use client";

import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useT } from "@/components/LangProvider";

type Action = (formData: FormData) => void | Promise<void>;

// Tombol pemicu + dialog konfirmasi untuk aksi hapus yang berbahaya.
export function ConfirmModalButton({
  action,
  id,
  trigger,
  triggerClassName = "",
  title,
  message,
  confirmText,
}: {
  action: Action;
  id: string;
  trigger: ReactNode;
  triggerClassName?: string;
  title: string;
  message: ReactNode;
  confirmText?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {trigger}
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        action={action}
        id={id}
        title={title}
        message={message}
        confirmText={confirmText ?? t("Hapus", "Delete")}
        confirmIcon={<Trash2 size={15} />}
      />
    </>
  );
}
