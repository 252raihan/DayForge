import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client.
// Use this in Server Components, Server Actions, and Route Handlers.
// It reads/writes the auth session through Next.js cookies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Server Components cannot write cookies, so the try/catch is
        // expected to fail there. Session refresh happens in middleware.
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: safe to ignore.
          }
        },
      },
    },
  );
}
