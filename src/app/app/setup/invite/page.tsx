import type { Metadata } from "next";
import { getMember, getOrg } from "@/lib/api";
import { FocusedShell } from "@/components/Shell";
import { WizardSteps } from "@/components/WizardSteps";
import { InviteRows } from "./InviteRows";

export const metadata: Metadata = {
  title: "Crewspace — Set up: invite your people",
};

/**
 * F-05 — Onboarding, step 2 of 3: invite your people.
 * Roles are limited to Member or Guest here; the side panel says why.
 * The invitation rows themselves are live client state (InviteRows).
 */
export default function OnboardingInvitePage() {
  const org = getOrg();
  const initialEmails = ["017", "014", "011"].map((id) => getMember(id)!.email);

  return (
    <FocusedShell flowName="Setting up" cancelLabel="Finish later" cancelHref="/app">
      <WizardSteps
        steps={[
          {
            n: "1",
            name: "Create organization",
            summary: `${org.name} · ${org.domain}`,
            state: "done",
          },
          { n: "2", name: "Invite your people", summary: "", state: "current" },
          { n: "3", name: "Check roles", summary: "", state: "todo" },
        ]}
      />

      <main
        style={{
          flex: "999 1 620px",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 className="title">Who should be in the register first?</h1>
          <p className="lead">
            Start with the few people who’ll help you run it. Everyone else
            can come later, one at a time or from a CSV. Invitations go out
            only when you press send.
          </p>
        </div>

        <InviteRows initialEmails={initialEmails} />
      </main>

      <aside
        style={{
          flex: "1 1 280px",
          maxWidth: 320,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <section className="sheet panel-box" aria-labelledby="rl">
          <h2 id="rl" className="panel">
            Why only Member and Guest?
          </h2>
          <span
            style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}
          >
            A new register has three roles. You’re the owner; everyone else
            starts as a Member, who can use the workspace but can’t change
            anyone’s access.
          </span>
          <span
            style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}
          >
            In the next step you’ll make the roles that give out access, like
            a Product admin, and see exactly what each one allows before
            anyone gets it.
          </span>
        </section>
        <section className="sheet panel-box" aria-labelledby="so">
          <h2 id="so" className="panel">
            So far
          </h2>
          <div>
            <div className="ll" style={{ borderTop: 0, paddingTop: 0 }}>
              <span>Members</span>
              <i />
              <span className="mono">1</span>
            </div>
            <div className="ll">
              <span>Roles</span>
              <i />
              <span>3 built-in</span>
            </div>
            <div className="ll">
              <span>Audit entries</span>
              <i />
              <span className="mono">2</span>
            </div>
          </div>
        </section>
      </aside>
    </FocusedShell>
  );
}
