"use client";

import { usePresence } from "@/components/presence/presence-provider";
import { MemberAvatar } from "@/components/directory/member-avatar";

/**
 * WhosOnlineStrip — horizontal strip of currently-online org members from
 * the realtime presence channel. Rendered in the member dashboard view.
 */
export function WhosOnlineStrip() {
  const { online, onlineCount } = usePresence();
  const members = [...online.values()].slice(0, 12);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground tabular-nums">
        {onlineCount} online now
      </p>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody else is online right now.</p>
      ) : (
        <ul className="flex gap-3 overflow-x-auto pb-1">
          {members.map((m) => (
            <li key={m.userId} className="flex w-16 shrink-0 flex-col items-center gap-1">
              <MemberAvatar
                name={m.fullName}
                avatarUrl={m.avatarUrl}
                userId={m.userId}
                showPresence
              />
              <span className="w-full truncate text-center text-[11px] text-muted-foreground">
                {m.fullName.split(" ")[0]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
