import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/redirect-path";

/**
 * Legacy alias — the canonical route is /sign-in.
 * Preserves ?next= so requireUser()'s /login?next=... redirects keep working.
 */
export default async function LoginCompatPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNextPath(next, "/sign-in");
  redirect(target === "/sign-in" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(target)}`);
}
