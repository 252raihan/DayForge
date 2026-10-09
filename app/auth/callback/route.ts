import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth / email-link callback.
//
// Google sign-in and the password-reset email both come back here with a `code`
// in the query string. Exchanging it for a session is what actually signs the
// user in - the exchange has to happen server-side so the cookies are set on
// our own domain.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Only ever redirect to a path on this site. Without this check, a crafted
  // `next` value would let an attacker bounce users to an external site after
  // login (an open redirect).
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[DayForge] auth callback failed:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That link is invalid or has expired.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
