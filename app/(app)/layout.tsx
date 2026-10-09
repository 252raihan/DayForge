import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { getUser, getProfile } from "@/lib/auth";

// Authenticated app shell for every route in this group.
// Layout: sidebar rail on desktop, top bar always, bottom nav on mobile.
//
// Middleware already blocks signed-out users, but we check again here so this
// layout is safe on its own and we have the user to render.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();

  return (
    <div className="flex min-h-screen bg-app">
      {/* Desktop-only vertical navigation. */}
      <Sidebar variant="sidebar" />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={profile?.name ?? null} email={user.email ?? null} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile-only bottom navigation. */}
      <Sidebar variant="bottom" />
    </div>
  );
}
