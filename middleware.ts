import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Runs on every matched request: refreshes the Supabase session, then enforces
// the signed-in / signed-out redirect rules (see lib/supabase/middleware.ts).
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except static assets and images. Keeping these out of
  // middleware avoids pointless auth round-trips on files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
