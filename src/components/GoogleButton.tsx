import Link from "next/link";

/** The Google "G" mark, as drawn in the approved screens. */
export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.4 0 4.5-.8 5.9-2.2L12 13.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H1v2.3A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M4 10.8a5.4 5.4 0 0 1 0-3.5V5H1a9 9 0 0 0 0 8.1l3-2.3z"
      />
      <path
        fill="#EA4335"
        d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.4A9 9 0 0 0 1 5l3 2.3c.7-2.1 2.7-3.7 5-3.7z"
      />
    </svg>
  );
}

export function GoogleButton({
  label,
  height = 44,
  href,
}: {
  label: string;
  height?: number;
  /** When set, the control is a link performing the designed navigation. */
  href?: string;
}) {
  const style = { height, width: "100%", fontSize: 14 } as const;
  if (href) {
    return (
      <Link href={href} className="btn" style={style}>
        <GoogleMark />
        {label}
      </Link>
    );
  }
  return (
    <button type="button" className="btn" style={style}>
      <GoogleMark />
      {label}
    </button>
  );
}
