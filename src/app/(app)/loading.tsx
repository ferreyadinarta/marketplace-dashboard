// Skeleton cadangan untuk halaman di grup (app) yang belum punya loading.tsx
// sendiri. SENGAJA tanpa judul: skeleton grup ini kena SEMUA rute anak, jadi
// judul apa pun yang ditulis di sini bakal salah di sebagian halaman
// (dulu semua halaman memuat dengan judul "Dashboard"). Halaman yang butuh
// skeleton mirip isinya bikin loading.tsx sendiri di foldernya.
import { Card } from "@/components/ui";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Bar className="h-7 w-56" />
        <Bar className="h-3 w-80 max-w-full" />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Bar className="h-3 w-24" />
              <Bar className="h-10 w-40" />
            </div>
          ))}
          <Bar className="ml-auto h-10 w-32" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <Bar className="h-5 w-48 max-w-full" />
          <Bar className="mt-2 h-3 w-64 max-w-full" />
        </div>
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="flex items-center justify-between gap-4">
              <Bar className="h-4 w-36 sm:w-48" />
              <Bar className="hidden h-4 w-24 sm:block" />
              <Bar className="h-4 w-20 sm:w-24" />
              <Bar className="h-4 w-16 sm:w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
