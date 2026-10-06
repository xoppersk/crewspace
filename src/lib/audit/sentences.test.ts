import { describe, expect, it } from "vitest";

import {
  formatAuditSentence,
  hasSentenceFormatter,
  type SentenceInput,
} from "./sentences";

function sentence(action: string, overrides: Partial<SentenceInput> = {}): string {
  return formatAuditSentence("Maya Chen", { action, ...overrides });
}

describe("formatAuditSentence", () => {
  it("org.created names the organization", () => {
    expect(sentence("org.created", { targetLabel: "Hale & Fern Studio" })).toBe(
      "Maya Chen created the organization Hale & Fern Studio",
    );
  });

  it("org.updated lists changed fields", () => {
    expect(
      sentence("org.updated", {
        diff: { name: { from: "Old", to: "New" }, slug: { from: "a", to: "b" } },
      }),
    ).toBe("Maya Chen updated the organization (name, slug)");
  });

  it("org.updated degrades without a diff", () => {
    expect(sentence("org.updated")).toBe("Maya Chen updated the organization");
  });

  it("org.ownership_transferred names the new owner", () => {
    expect(sentence("org.ownership_transferred", { targetLabel: "Luis Gomez" })).toBe(
      "Maya Chen transferred ownership to Luis Gomez",
    );
  });

  it("membership.created (invitation accept) reads as a join", () => {
    expect(
      sentence("membership.created", {
        diff: { role: "Member" },
        metadata: { via: "invitation" },
      }),
    ).toBe("Maya Chen joined the organization as Member");
  });

  it("membership.created (manual add) names the target", () => {
    expect(
      sentence("membership.created", {
        targetLabel: "Luis Gomez",
        diff: { role: "Member" },
        metadata: { via: "manual" },
      }),
    ).toBe("Maya Chen added Luis Gomez to the organization as Member");
  });

  it("membership.role_changed shows before and after", () => {
    expect(
      sentence("membership.role_changed", {
        targetLabel: "Luis Gomez",
        diff: { role: { from: "Member", to: "Manager" } },
      }),
    ).toBe("Maya Chen changed Luis Gomez's role from Member to Manager");
  });

  it("membership.deactivated", () => {
    expect(sentence("membership.deactivated", { targetLabel: "Luis Gomez" })).toBe(
      "Maya Chen deactivated Luis Gomez",
    );
  });

  it("membership.reactivated", () => {
    expect(sentence("membership.reactivated", { targetLabel: "Luis Gomez" })).toBe(
      "Maya Chen reactivated Luis Gomez",
    );
  });

  it("membership.removed", () => {
    expect(sentence("membership.removed", { targetLabel: "Luis Gomez" })).toBe(
      "Maya Chen removed Luis Gomez from the organization",
    );
  });

  it("membership.removed (self-leave) reads as leaving", () => {
    expect(
      sentence("membership.removed", {
        targetLabel: "Maya Chen",
        metadata: { via: "self-leave" },
      }),
    ).toBe("Maya Chen left the organization");
  });

  it("team.created", () => {
    expect(sentence("team.created", { targetLabel: "Design" })).toBe(
      "Maya Chen created the team Design",
    );
  });

  it("team.updated lists changed fields", () => {
    expect(
      sentence("team.updated", {
        targetLabel: "Design",
        diff: { description: { from: "a", to: "b" } },
      }),
    ).toBe("Maya Chen updated the team Design (description)");
  });

  it("team.archived / team.unarchived", () => {
    expect(sentence("team.archived", { targetLabel: "Design" })).toBe(
      "Maya Chen archived the team Design",
    );
    expect(sentence("team.unarchived", { targetLabel: "Design" })).toBe(
      "Maya Chen unarchived the team Design",
    );
  });

  it("team.member_added names the team", () => {
    expect(
      sentence("team.member_added", {
        targetLabel: "Luis Gomez",
        diff: { team: "Design" },
      }),
    ).toBe("Maya Chen added Luis Gomez to the Design team");
  });

  it("team.member_removed names the team", () => {
    expect(
      sentence("team.member_removed", {
        targetLabel: "Luis Gomez",
        diff: { team: "Design" },
      }),
    ).toBe("Maya Chen removed Luis Gomez from the Design team");
  });

  it("team.lead_changed shows the handoff", () => {
    expect(
      sentence("team.lead_changed", {
        diff: { team: "Design", lead: { from: "Maya Chen", to: "Luis Gomez" } },
      }),
    ).toBe("Maya Chen changed the team lead for the Design team from Maya Chen to Luis Gomez");
  });

  it("role.created / role.updated / role.deleted", () => {
    expect(sentence("role.created", { targetLabel: "Support Lead" })).toBe(
      "Maya Chen created the role Support Lead",
    );
    expect(sentence("role.updated", { targetLabel: "Support Lead" })).toBe(
      "Maya Chen updated the role Support Lead",
    );
    expect(sentence("role.deleted", { targetLabel: "Support Lead" })).toBe(
      "Maya Chen deleted the role Support Lead",
    );
  });

  it("role.permissions_changed summarizes added/removed", () => {
    expect(
      sentence("role.permissions_changed", {
        targetLabel: "Support Lead",
        diff: { added: ["members:invite", "teams:create"], removed: ["roles:delete"] },
      }),
    ).toBe("Maya Chen updated permissions for the Support Lead role (+2 added, −1 removed)");
  });

  it("invitation.sent names the invitee and role", () => {
    expect(
      sentence("invitation.sent", {
        targetLabel: "luis@example.com",
        diff: { role: "Manager" },
      }),
    ).toBe("Maya Chen invited luis@example.com as Manager");
  });

  it("invitation.bulk_sent counts invitations", () => {
    expect(sentence("invitation.bulk_sent", { diff: { count: 18 } })).toBe(
      "Maya Chen sent 18 invitations",
    );
    expect(sentence("invitation.bulk_sent", { diff: { sent: 16, failed: 2 } })).toBe(
      "Maya Chen sent 16 invitations, 2 failed",
    );
  });

  it("invitation.resent", () => {
    expect(sentence("invitation.resent", { targetLabel: "luis@example.com" })).toBe(
      "Maya Chen resent the invitation to luis@example.com",
    );
  });

  it("invitation.revoked", () => {
    expect(sentence("invitation.revoked", { targetLabel: "luis@example.com" })).toBe(
      "Maya Chen revoked the invitation to luis@example.com",
    );
  });

  it("invitation.revoked (declined by invitee) reads as a decline", () => {
    expect(
      sentence("invitation.revoked", {
        targetLabel: "luis@example.com",
        metadata: { via: "declined" },
      }),
    ).toBe("Maya Chen declined the invitation");
  });

  it("invitation.accepted uses the invitee email as the subject", () => {
    expect(
      formatAuditSentence("Luis Gomez", {
        action: "invitation.accepted",
        targetLabel: "luis@example.com",
      }),
    ).toBe("luis@example.com accepted the invitation");
  });

  it("settings.updated lists changed settings", () => {
    expect(
      sentence("settings.updated", {
        diff: { invite_policy: { from: "admins", to: "managers" } },
      }),
    ).toBe("Maya Chen updated organization settings (invite policy)");
  });

  it("audit.exported reports the row count", () => {
    expect(sentence("audit.exported", { diff: { rows: 250, format: "CSV" } })).toBe(
      "Maya Chen exported the audit log (250 rows as CSV)",
    );
  });

  it("unknown actions degrade to a generic sentence, never blank", () => {
    expect(sentence("something.new")).toBe("Maya Chen performed something.new");
  });

  it("missing actor name falls back to 'Someone'", () => {
    expect(formatAuditSentence(null, { action: "team.created", targetLabel: "Design" })).toBe(
      "Someone created the team Design",
    );
    expect(formatAuditSentence("  ", { action: "team.created", targetLabel: "Design" })).toBe(
      "Someone created the team Design",
    );
  });

  it("hasSentenceFormatter agrees with the fallback", () => {
    expect(hasSentenceFormatter("team.created")).toBe(true);
    expect(hasSentenceFormatter("something.new")).toBe(false);
  });
});
