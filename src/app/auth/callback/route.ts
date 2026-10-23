import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback: exchanges the code from confirmation / recovery
 * emails for a session, then continues to `next` (default /app;
 * password recovery passes /reset-password).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(
    `${origin}/signin?error=${encodeURIComponent("That link didn’t work — it may have expired. Try again.")}`,
  );
}
