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
        <main className="mx-auto max-w-[1400px] px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>
      <Toaster />
    </>
  );
}
