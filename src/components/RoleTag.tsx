import Link from "next/link";
import type { Role } from "@/lib/types";

/**
 * A role name in a 24px outlined tag. Links to the role only where the
 * designs draw it as a link (drawer Access, record pages); inside rows it
 * is a plain span so it never nests inside the row's own link.
 */
export function RoleTag({
  role,
  dashed = false,
  quiet = false,
  href,
  link = true,
}: {
  role: Role;
  dashed?: boolean;
  /** Quieter text treatment (500, --ink-2) the designs give invited tags. */
  quiet?: boolean;
  href?: string;
  link?: boolean;
}) {
  const className = [
    "ro",
    role.id === "member" || role.id === "guest" ? "plain" : "",
    dashed ? "dashed" : "",
    quiet ? "quiet" : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (!link) {
    return <span className={className}>{role.name}</span>;
  }
  const target = href ?? `/app/roles/${role.id}`;
  return (
    <Link href={target} className={className}>
      {role.name}
    </Link>
  );
}
