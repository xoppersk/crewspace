import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./types";

/**
 * Paths that do not require a session. Everything else — including /(app)/*
 * and /onboarding — redirects signed-out visitors to /sign-in?next=<original>.
 *
 * /login, /signup, and /forgot-password stay public as legacy aliases: they
 * redirect to their canonical replacements (/sign-in, /sign-up,
 * /reset-password?step=request) so stale links never 404.
 */
const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/sign-up",
  "/reset-password",
  "/auth",
  "/login",
  "/signup",
  "/forgot-password",
] as const;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the Supabase auth session on every request (this is what keeps
 * the user signed in — the session cookie is refreshed server-side) and
 * redirects unauthenticated visitors away from protected routes.
 *
 * Called from the root `middleware.ts`.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Never trust a client-supplied user id — ask the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Signed-in users don't need the auth pages — send them to the smart
  // redirect at / which drops them into their org or /onboarding.
  if (
    user &&
    (pathname === "/sign-in" ||
      pathname === "/sign-up" ||
      pathname === "/login" ||
      pathname === "/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
