"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

/**
 * Browser-side Supabase client. Uses the public anon key — Row Level
 * Security applies. Env comes from NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY; never hard-code values here.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
