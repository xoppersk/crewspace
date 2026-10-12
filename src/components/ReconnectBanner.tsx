/**
 * Full-width ink strip shown when the live connection drops (X-06).
 * Data is timestamped; access-changing actions pause while it shows.
 */
export function ReconnectBanner({ pausedAt }: { pausedAt: string }) {
  return (
    <div className="banner" role="status">
      <span>
        <b style={{ fontWeight: 600 }}>Reconnecting…</b>{" "}
        <span>Live updates paused at {pausedAt}. Trying again in 8 s.</span>
      </span>
      <button type="button" className="banner-retry">
        Retry now
      </button>
    </div>
  );
}
