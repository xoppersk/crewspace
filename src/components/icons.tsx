/* Crewspace v2 icons: small inline SVG strokes (1.5px per the final
   screens; the design system specifies 1.5–1.8px). No icon fonts. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

function base(props: P): P {
  return {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    "aria-hidden": true,
    ...props,
  };
}

export function IconGrid(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}

export function IconPerson(props: P) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.6-2.4 2.6-3.5 5-3.5s4.4 1.1 5 3.5" />
    </svg>
  );
}

export function IconTeams(props: P) {
  return (
    <svg {...base(props)}>
      <circle cx="5.5" cy="6" r="2" />
      <circle cx="11" cy="6" r="2" />
      <path d="M1.5 13c.4-1.8 2-2.8 4-2.8s3.6 1 4 2.8M9.5 10.3c.5-.1 1-.1 1.5-.1 2 0 3.6 1 4 2.8" />
    </svg>
  );
}

export function IconShieldCheck(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.4-5.5 6.2C4.9 13.4 2.5 11.2 2.5 8V4z" />
      <path d="m5.6 8 1.7 1.7L10.6 6.4" />
    </svg>
  );
}

export function IconEnvelope(props: P) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="m2.5 4.5 5.5 4 5.5-4" />
    </svg>
  );
}

export function IconDocument(props: P) {
  return (
    <svg {...base(props)}>
      <path d="M4 2h6l3 3v9H4z" />
      <path d="M6.5 7.5h4M6.5 10h4" />
    </svg>
  );
}

export function IconGear(props: P) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </svg>
  );
}

/** Result glyphs for PermissionRow (screens draw these at 12px). */
export function IconCheck(props: P) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden {...props}>
      <path d="m3 8.5 3 3 7-7" />
    </svg>
  );
}

export function IconLock(props: P) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden {...props}>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
