import { ButtonLink } from "@/components/Button";
import { LegalFooter } from "@/components/LegalFooter";
import { PublicHeader } from "@/components/Shell";

export default function NotFound() {
  return (
    <div className="pub">
      <PublicHeader />
      <div className="notice-wrap">
        <div className="notice">
          <span className="stamp">Register · Not found</span>
          <h1 className="public-title" style={{ fontSize: 30 }}>
            This page isn’t in the register.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--ink-2)",
            }}
          >
            The address may have changed, or the record may not exist.
            Nothing was changed by looking for it.
          </p>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <ButtonLink variant="pri" size="h44" href="/app">
              Go to the register
            </ButtonLink>
            <a href="/">Back to the public page</a>
          </div>
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}
