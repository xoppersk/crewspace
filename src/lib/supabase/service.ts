import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

/**
 * Service-role client — SERVER ONLY. Bypasses RLS.
 * ============================================================================
 * Use only for privileged flows RLS cannot express:
 *   * auth.admin.deleteUser (account deletion)
 *   * deleting one's own profiles row (profiles has no DELETE RLS policy —
 *     "account deletion is a privileged server flow")
 *
 * Never import from client components. Throws a clear error when the key
 * isn't configured instead of failing cryptically at call time.
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
