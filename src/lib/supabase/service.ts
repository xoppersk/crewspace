import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

/**
 * Service-role client — SERVER ONLY. Bypasses RLS.
 * ==========================================================================
 * Use only for privileged flows RLS cannot express (e.g. auth.admin
 * operations). Never import from a client component — the `server-only`
 * import above makes that a build error. Throws a clear error when the
 * key isn't configured instead of failing cryptically at call time.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.includes("REPLACE_ME")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — this action needs a server secret.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
