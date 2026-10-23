"use client";

import { useRouter } from "next/navigation";
import { MemberDrawer } from "@/components/MemberDrawer";
import type { WorkspaceData } from "@/lib/api";
import type { Member } from "@/lib/types";

/**
 * P-03 wrapper: MemberDrawer needs an onClose callback; closing returns to
 * the same Directory URL without ?open (filters, status and state kept).
 */
export function DirectoryDrawer({
  member,
  data,
  canDeactivate = false,
  returnQuery,
  lastActiveText,
}: {
  member: Member;
  data: WorkspaceData;
  canDeactivate?: boolean;
  /** Query string for the page without ?open, "" when there is none. */
  returnQuery: string;
  lastActiveText?: string;
}) {
  const router = useRouter();
  const onClose = () => {
    router.push(returnQuery ? `/app/people?${returnQuery}` : "/app/people", {
      scroll: false,
    });
  };
  return (
    <MemberDrawer
      member={member}
      data={data}
      canDeactivate={canDeactivate}
      onClose={onClose}
      lastActiveText={lastActiveText}
    />
  );
}
