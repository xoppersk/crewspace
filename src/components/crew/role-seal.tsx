import { cn } from "@/lib/utils";

/**
 * RoleSeal — the rectangular uppercase seal from the Signature UI
 * ("Maya Jordan · Member 042"). Ink background, white text, no radius:
 * it reads as a stamped register mark, not a pill.
 */
export function RoleSeal({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("role-seal", className)}>{children}</span>;
}
