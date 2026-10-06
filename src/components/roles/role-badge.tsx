import { cn } from "@/lib/utils";

/**
 * RoleBadge — small uppercase pill identifying a member's role.
 * Imported by Worker 4's directory/member UI: keep the export name
 * `RoleBadge` and the props `{ roleName, systemKey?, className? }`.
 *
 * Colors (DESIGN-BRIEF §3): Owner indigo solid · Admin indigo outline ·
 * Manager sky · Member neutral · Viewer muted · custom roles violet.
 * The role name is always rendered as text — status is never color-alone.
 */

const SYSTEM_STYLES: Record<string, string> = {
  owner: "bg-indigo-600 text-white",
  admin: "border-indigo-600 text-indigo-700",
  manager: "bg-sky-100 text-sky-800",
  member: "bg-zinc-100 text-zinc-700",
  viewer: "border-zinc-300 bg-zinc-50 text-zinc-500",
};

const CUSTOM_STYLE = "bg-violet-100 text-violet-800";

function styleFor(systemKey: string | null | undefined, roleName: string): string {
  const key = (systemKey ?? roleName).toLowerCase();
  return SYSTEM_STYLES[key] ?? CUSTOM_STYLE;
}

export function RoleBadge({
  roleName,
  systemKey,
  className,
}: {
  roleName: string;
  systemKey?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap",
        styleFor(systemKey, roleName),
        className,
      )}
    >
      {roleName}
    </span>
  );
}
