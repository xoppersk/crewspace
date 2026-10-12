export function LegalFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--rule-strong)",
        marginTop: 8,
      }}
    >
      <div
        style={{
          padding: "18px 40px 24px",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 20px",
          justifyContent: "space-between",
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        <span>© 2026 [Company]</span>
        <nav
          aria-label="Legal"
          style={{ display: "flex", gap: 18, flexWrap: "wrap" }}
        >
          <a href="#" style={{ color: "var(--muted)" }}>Privacy</a>
          <a href="#" style={{ color: "var(--muted)" }}>Terms</a>
          <a href="#" style={{ color: "var(--muted)" }}>Security</a>
          <a href="#" style={{ color: "var(--muted)" }}>Status</a>
          <a href="#" style={{ color: "var(--muted)" }}>Help</a>
        </nav>
      </div>
    </footer>
  );
}
