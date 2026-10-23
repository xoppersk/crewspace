import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * "Continue with Google" — real OAuth via Supabase Auth. If the Google
 * provider isn't enabled for the project, Supabase returns an error
 * and we surface it on the sign-in page instead of faking a session.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const nextParam = searchParams.get("next") ?? "";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/app";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) {
    return NextResponse.redirect(
      `${origin}/signin?error=${encodeURIComponent(
        error?.message ?? "Google sign-in isn’t available right now.",
      )}`,
    );
  }
  return NextResponse.redirect(data.url);
}
