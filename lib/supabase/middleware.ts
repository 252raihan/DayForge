import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request and keeps the auth
// cookies in sync between the browser and the server.
//
// Why this is needed: Server Components cannot write cookies. If the access
// token expires and nothing refreshes it, the user appears signed out on the
// next navigation. Middleware runs before the route, so it is the right place
// to refresh the token and hand the updated cookies back.
export async function updateSession(request: NextRequest) {
  // Start with a pass-through response that we can attach refreshed cookies to.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          // Write to the request so the current render sees the new cookies,
          // then to the response so the browser stores them.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: use getUser(), not getSession(). getSession() reads the cookie
  // without verifying it, so it cannot be trusted for authorization.
  // getUser() revalidates the token with the Supabase Auth server.
  // Do not add logic between createServerClient and getUser() - it is easy to
  // accidentally break the session refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Routes under (auth) that a signed-out user may visit.
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password");

  // /reset-password requires an active recovery session, so it is excluded
  // here and guarded in the page itself.
  if (!user && !isAuthRoute && !pathname.startsWith("/reset-password")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so login can send them back.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in? Send them away from the login/signup screens.
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Must return supabaseResponse so the refreshed cookies reach the browser.
  return supabaseResponse;
}
