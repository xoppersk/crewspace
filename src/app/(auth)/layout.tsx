import type { ReactNode } from "react";

/**
 * Auth routes (sign-in, sign-up, password reset, invite accept) read runtime
 * data — `searchParams` (?next= redirects, invite tokens), the session cookie —
 * so they render at request time instead of prerendering. `instant = false`
 * opts the whole (auth) group out of Next 16's instant-navigation validation,
 * mirroring the authenticated (app) group. (See (app)/layout.tsx.)
 */
export const instant = false;

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return children;
}
