import Sidebar from "@/components/Sidebar";
import { Toaster } from "@/components/Toaster";
import { APP_ENV } from "@/lib/config";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Sidebar env={APP_ENV} />
      <div className="lg:pl-64">
        {/* pt: tinggi header mobile + safe-area notch; pb: + safe-area home indicator.
            pl/pr: safe-area landscape. Desktop kembali normal. */}
        <main className="mx-auto max-w-[1400px] px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pl-[calc(env(safe-area-inset-left)+1rem)] pr-[calc(env(safe-area-inset-right)+1rem)] pt-[calc(env(safe-area-inset-top)+5rem)] sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>
      <Toaster />
    </>
  );
}
