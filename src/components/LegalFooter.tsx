import { IconShieldCheck } from "./icons";

/**
 * One-line legal footer for the public/auth screens, as drawn in
 * SignIn/SignUp/InviteAccept: shield mark + "© 2026 [Company]" on the
 * left, legal links on the right, over a --frame rule. The [Company]
 * placeholder is what the approved screens draw (open question —
 * see batches/foundation.md).
 */
export function LegalFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--frame)",
      }}
    >
      <div
        style={{
          padding: "20px 40px 26px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px 20px",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        <span
          style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
        >
          <span className="shieldmark s22" aria-hidden="true">
            <IconShieldCheck />
          </span>
          © 2026 [Company]
        </span>
        <nav
          aria-label="Legal"
          style={{ display: "flex", gap: 20, flexWrap: "wrap" }}
        >
          <a href="#" style={{ color: "var(--muted)", textDecoration: "none" }}>Privacy</a>
          <a href="#" style={{ color: "var(--muted)", textDecoration: "none" }}>Terms</a>
          <a href="#" style={{ color: "var(--muted)", textDecoration: "none" }}>Security</a>
          <a href="#" style={{ color: "var(--muted)", textDecoration: "none" }}>Status</a>
          <a href="#" style={{ color: "var(--muted)", textDecoration: "none" }}>Help</a>
        </nav>
      </div>
    </footer>
  );
}
