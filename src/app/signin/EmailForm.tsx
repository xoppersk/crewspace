"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * The designed email form has no confirmation state, so submitting it
 * must not reload the page — it simply stays as drawn.
 */
export function EmailForm({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <form
      className={className}
      style={style}
      onSubmit={(e) => e.preventDefault()}
    >
      {children}
    </form>
  );
}
