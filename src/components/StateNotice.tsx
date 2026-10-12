import type { ReactNode } from "react";
import { ButtonLink } from "./Button";

/**
 * Every blocked, empty or expired state: mono stamp, one-sentence headline,
 * a "what is safe and who decides" paragraph, optional facts, one seal
 * action and one way out.
 */
export function StateNotice({
  stamp,
  headline,
  children,
  facts,
  action,
  wayOut,
  alert = false,
}: {
  stamp: string;
  headline: string;
  children: ReactNode;
  facts?: ReactNode[];
  action: { label: string; href: string };
  wayOut: { label: string; href: string };
  alert?: boolean;
}) {
  return (
    <div className="notice" role={alert ? "alert" : undefined}>
      <span className="stamp">{stamp}</span>
      <h1 className="public-title" style={{ fontSize: 30 }}>
        {headline}
      </h1>
      <div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}>
        {children}
      </div>
      {facts ? (
        <div className="facts">
          {facts.map((f, i) => (
            <span key={i}>{f}</span>
          ))}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
          marginTop: 4,
        }}
      >
        <ButtonLink variant="pri" size="h44" href={action.href}>
          {action.label}
        </ButtonLink>
        <a href={wayOut.href} style={{ fontSize: 14 }}>
          {wayOut.label}
        </a>
      </div>
    </div>
  );
}
