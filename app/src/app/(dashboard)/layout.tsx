import { AppNav } from "@/components/layout/app-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-5 sm:py-7 lg:px-8">
        {children}
      </main>
    </>
  );
}
