import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./types";

/**
 * v2 protected paths: everything under /app/** requires a session,
 * and /dev/** (the dev component showcase) stays behind auth too.
 * Every other path — the public pages (marketing, the auth screens,
 * the invite landing, which invitees usually reach signed out, and
 * the auth callback/reset flow) and any unknown path alike — falls
 * through untouched, so unknown paths reach Next's not-found page
 * with a real 404 instead of being redirected to /signin.
 */
const PROTECTED_PATHS = ["/app", "/dev"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the Supabase auth session on every request (this is what
 * keeps the user signed in — the session cookie is refreshed
 * server-side) and redirects unauthenticated protected-path
 * (/app/**, /dev/**) requests to /signin. Called from the root
 * `middleware.ts`.
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

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
