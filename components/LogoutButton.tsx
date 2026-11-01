"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LogOutIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

// Logs the user out, then sends them to /login.
// signOut() clears the session on the server and removes the local auth cookies.
export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();

    // replace (not push) so the back button does not return to a protected page,
    // and refresh so server components drop the old session.
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="secondary"
      onClick={handleLogout}
      disabled={pending}
      loading={pending}
      loadingLabel="Logging out..."
    >
      {!pending ? <LogOutIcon className="h-4 w-4" /> : null}
      <span className="hidden sm:inline">Log out</span>
    </Button>
  );
}
