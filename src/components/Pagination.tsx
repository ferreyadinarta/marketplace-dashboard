import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Hanya kontrol (prev / halaman / next) — untuk ditaruh di header (action slot).
export function PaginationControls({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const btn = "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm font-medium";
  const on = `${btn} border-slate-300 text-slate-700 hover:bg-slate-50`;
  const off = `${btn} border-slate-200 text-slate-300`;
  return (
    <div className="flex items-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={on} aria-label="Sebelumnya">
          <ChevronLeft size={15} />
        </Link>
      ) : (
        <span className={off}>
          <ChevronLeft size={15} />
        </span>
      )}
      <span className="whitespace-nowrap px-2 text-sm text-slate-500">
        Hal. {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={on} aria-label="Berikutnya">
          <ChevronRight size={15} />
        </Link>
      ) : (
        <span className={off}>
          <ChevronRight size={15} />
        </span>
      )}
    </div>
  );
}

// Pagination server component. hrefFor(p) membuat URL untuk halaman p.
// compact=true → tanpa teks "Menampilkan…", slim & rata kanan (untuk bagian atas).
export function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
  hrefFor,
  unit = "item",
  place = "bottom",
  compact = false,
}: {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  hrefFor: (page: number) => string;
  unit?: string;
  place?: "top" | "bottom";
  compact?: boolean;
}) {
  if (total === 0) return null;
  const border = place === "top" ? "border-b" : "border-t";

  const btn = "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-medium";
  const btnOn = `${btn} border-slate-300 text-slate-700 hover:bg-slate-50`;
  const btnOff = `${btn} border-slate-200 text-slate-300`;

  const controls = (
    <div className="flex items-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={btnOn}>
          <ChevronLeft size={15} /> Sebelumnya
        </Link>
      ) : (
        <span className={btnOff}>
          <ChevronLeft size={15} /> Sebelumnya
        </span>
      )}
      <span className="px-3 text-slate-500">
        Halaman {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={btnOn}>
          Berikutnya <ChevronRight size={15} />
        </Link>
      ) : (
        <span className={btnOff}>
          Berikutnya <ChevronRight size={15} />
        </span>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className={`flex justify-end ${border} border-slate-100 px-5 py-2 text-sm`}>{controls}</div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-between gap-3 ${border} border-slate-100 px-5 py-3 text-sm sm:flex-row`}>
      <span className="text-slate-500">
        Menampilkan {from}–{to} dari {total} {unit}
      </span>
      {controls}
    </div>
  );
}
