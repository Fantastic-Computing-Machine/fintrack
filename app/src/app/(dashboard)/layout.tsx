import { AppNav } from "@/components/layout/app-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppNav />
      <main className="min-h-screen pb-24 pt-7 lg:ml-64 lg:pb-10 lg:pt-10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10">
        {children}
        </div>
      </main>
    </>
  );
}
