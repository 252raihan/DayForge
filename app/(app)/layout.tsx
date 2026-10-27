import { redirect } from "next/navigation";
import AppLayoutShell from "./AppShell";
import { getUser, getProfile } from "@/lib/auth";

// Server entry for the authenticated group. The auth check has to happen here
// (redirect() is server-only); the interactive shell lives in AppShell.tsx.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();

  return (
    <AppLayoutShell
      name={profile?.name ?? null}
      email={user.email ?? null}
    >
      {children}
    </AppLayoutShell>
  );
}
