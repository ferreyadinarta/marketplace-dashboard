import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n-server";

// Hanya kontrol (prev / halaman / next) — untuk ditaruh di header (action slot).
export async function PaginationControls({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const { t } = await getT();
  const btn = "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm font-medium";
  const on = `${btn} border-slate-300 text-slate-700 hover:bg-slate-50`;
  const off = `${btn} border-slate-200 text-slate-300`;
  return (
    <div className="flex items-center gap-1">
      {page > 1 ? (
        <Link scroll={false} href={hrefFor(page - 1)} className={on} aria-label={t("Sebelumnya", "Previous")}>
          <ChevronLeft size={15} />
        </Link>
      ) : (
        <span className={off}>
          <ChevronLeft size={15} />
        </span>
      )}
      <span className="whitespace-nowrap px-2 text-sm text-slate-500">
        {t(`Hal. ${page} / ${totalPages}`, `Page ${page} / ${totalPages}`)}
      </span>
      {page < totalPages ? (
        <Link scroll={false} href={hrefFor(page + 1)} className={on} aria-label={t("Berikutnya", "Next")}>
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
export async function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
  hrefFor,
  unit,
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
  const { t } = await getT();
  const resolvedUnit = unit ?? t("item", "item");
  const border = place === "top" ? "border-b" : "border-t";

  const btn = "inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 font-medium sm:px-3";
  const btnOn = `${btn} border-slate-300 text-slate-700 hover:bg-slate-50`;
  const btnOff = `${btn} border-slate-200 text-slate-300`;

  const controls = (
    <div className="flex items-center gap-1">
      {page > 1 ? (
        <Link scroll={false} href={hrefFor(page - 1)} className={btnOn} aria-label={t("Halaman sebelumnya", "Previous page")}>
          <ChevronLeft size={15} /> <span className="hidden sm:inline">{t("Sebelumnya", "Previous")}</span>
        </Link>
      ) : (
        <span className={btnOff}>
          <ChevronLeft size={15} /> <span className="hidden sm:inline">{t("Sebelumnya", "Previous")}</span>
        </span>
      )}
      <span className="whitespace-nowrap px-2 text-slate-500 sm:px-3">
        {t(`Halaman ${page} / ${totalPages}`, `Page ${page} / ${totalPages}`)}
      </span>
      {page < totalPages ? (
        <Link scroll={false} href={hrefFor(page + 1)} className={btnOn} aria-label={t("Halaman berikutnya", "Next page")}>
          <span className="hidden sm:inline">{t("Berikutnya", "Next")}</span> <ChevronRight size={15} />
        </Link>
      ) : (
        <span className={btnOff}>
          <span className="hidden sm:inline">{t("Berikutnya", "Next")}</span> <ChevronRight size={15} />
        </span>
      )}
    </div>
  );

  if (compact) {
    if (totalPages <= 1) return null;
    return (
      <div className={`flex justify-end ${border} border-slate-100 px-5 py-2 text-sm`}>{controls}</div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 ${border} border-slate-100 px-5 py-3 text-sm`}>
      <span className="text-slate-500">
        {t(`${from}–${to} dari ${total} ${resolvedUnit}`, `${from}–${to} of ${total} ${resolvedUnit}`)}
      </span>
      {/* satu halaman saja → tombol navigasi cuma jadi hiasan mati */}
      {totalPages > 1 && controls}
    </div>
  );
}
