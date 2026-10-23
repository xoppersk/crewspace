import type { Metadata } from "next";
import { getOrg } from "@/lib/api";
import { loadActiveWorkspaceData } from "@/lib/data/server";
import { AppShell, FocusedShell } from "@/components/Shell";
import { WizardSteps } from "@/components/WizardSteps";
import { InviteRows } from "./InviteRows";

export const metadata: Metadata = {
  title: "Crewspace — Set up: invite your people",
};

/**
 * F-05 — Onboarding, step 2 of 3: invite your people (Onboarding.html).
 * Roles are limited to Member or Guest here; the dark side panel says
 * why. Rows start blank; Send creates real invitation rows through
 * the importInvitations server action. Counts in "So far" are the
 * workspace's real numbers.
 */
export default async function OnboardingInvitePage() {
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="overview">{null}</AppShell>;
  }
  const org = getOrg(data);
  const inviteRoles = data.org.roles
    .filter((r) => r.id === "member" || r.id === "guest")
    .map((r) => ({ id: r.id, name: r.name }));
  const inviteTeams = data.teams
    .filter((t) => !t.unlisted)
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <FocusedShell flowName="Setting up" cancelLabel="Finish later" cancelHref="/app">
      <div className="fob">
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
            gap: 20,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 className="fo-title">Who should be in the register first?</h1>
            <p className="lead">
              Start with the few people who’ll help you run it. Everyone else
              can come later, one at a time or from a CSV. Invitations go out
              only when you press send.
            </p>
          </div>

          <InviteRows roles={inviteRoles} teams={inviteTeams} />
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
          <section
            className="fdark"
            aria-labelledby="rl"
            style={{
              padding: 20,
              gap: 10,
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--panel-muted)",
            }}
          >
            <h2
              id="rl"
              style={{
                margin: "0 0 2px",
                font: "700 16px/1.3 var(--font-sans)",
                color: "#fff",
              }}
            >
              Why only Member and Guest?
            </h2>
            <span>
              You’re the owner. Everyone you invite here starts as a
              Member — who can use the workspace but can’t change
              anyone’s access — or as a Guest on a single team.
            </span>
            <span>
              In the next step you’ll make the roles that give out access, like
              a Product admin, and see exactly what each one allows before
              anyone gets it.
            </span>
          </section>
          <section
            className="sheet"
            aria-labelledby="so"
            style={{ padding: "18px 18px 8px" }}
          >
            <h2
              id="so"
              className="panel"
              style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 15 }}
            >
              So far
            </h2>
            <div className="frw">
              <span>Members</span>
              <span className="mono">{data.members.length}</span>
            </div>
            <div className="frw">
              <span>Roles</span>
              <span className="mono">{data.org.roles.length}</span>
            </div>
            <div className="frw">
              <span>Audit entries</span>
              <span className="mono">{data.auditEntries.length}</span>
            </div>
          </section>
        </aside>
      </div>
    </FocusedShell>
  );
}
