/**
 * Full-width ink strip shown when the live connection drops (X-06,
 * SysReconnect.html): arc glyph in panel-allow blue, "Reconnecting…"
 * in white, the paused-at line in --control, Retry now on the right.
 * Data is timestamped; access-changing actions pause while it shows.
 */
export function ReconnectBanner({ pausedAt }: { pausedAt: string }) {
  return (
    <div className="banner" role="status">
      <span className="sys-retry-ic">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" />
        </svg>
        <span>
          <b style={{ fontWeight: 600 }}>Reconnecting…</b>{" "}
          <span className="sys-paused">
            Live updates paused at {pausedAt}. Trying again in 8 s.
          </span>
        </span>
      </span>
      <a href="#" className="banner-retry">
        Retry now
      </a>
    </div>
  );
}
