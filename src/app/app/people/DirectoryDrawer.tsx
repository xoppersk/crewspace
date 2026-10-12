"use client";

import { useRouter } from "next/navigation";
import { MemberDrawer } from "@/components/MemberDrawer";
import type { Member } from "@/lib/types";

/**
 * P-03 wrapper: MemberDrawer needs an onClose callback; closing returns to
 * the same Directory URL without ?open (filters, status and state kept).
 */
export function DirectoryDrawer({
  member,
  returnQuery,
  lastActiveText,
  offline = false,
}: {
  member: Member;
  /** Query string for the page without ?open, "" when there is none. */
  returnQuery: string;
  lastActiveText?: string;
  /** X-06: access-changing actions pause while the connection is down. */
  offline?: boolean;
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
      onClose={onClose}
      lastActiveText={lastActiveText}
      offline={offline}
    />
  );
}
