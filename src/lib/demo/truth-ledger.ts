/**
 * Truth ledger — the consistent fictional dataset from the Crewspace design
 * spec (Flagship UI Designs artifact). Used ONLY where the app has no live
 * data: the marketing landing page, and first-run / empty illustration copy.
 * Live queries always win — never substitute this for real org data.
 */

export interface LedgerPerson {
  name: string;
  registerNo: string | null;
  role: string;
  status: "Active" | "Invited";
}

export interface LedgerTeam {
  name: string;
  members: string;
  roles: string;
}

export interface LedgerRole {
  name: string;
  members: string;
  kind: "System" | "Custom";
}

export interface LedgerInvite {
  name: string;
  role: string;
  state: string;
}

export const TRUTH_LEDGER = {
  people: [
    { name: "Maya Jordan", registerNo: "Member 042", role: "Product Admin", status: "Active" },
    { name: "Owen Clarke", registerNo: null, role: "Support Lead", status: "Active" },
    { name: "Priya Shah", registerNo: null, role: "Analyst", status: "Invited" },
  ] as LedgerPerson[],
  teams: [
    { name: "Product", members: "12 members", roles: "3 roles" },
    { name: "Customer operations", members: "18 members", roles: "4 roles" },
    { name: "Finance", members: "6 members", roles: "2 roles" },
  ] as LedgerTeam[],
  roles: [
    { name: "Organization owner", members: "1 member", kind: "System" },
    { name: "Product admin", members: "5 members", kind: "Custom" },
    { name: "Support lead", members: "4 members", kind: "Custom" },
  ] as LedgerRole[],
  invites: [
    { name: "Priya Shah", role: "Analyst", state: "Expires October 11, 2026" },
    { name: "Noah Williams", role: "Support lead", state: "Opened" },
    { name: "Leah Kim", role: "Product admin", state: "Delivery failed" },
  ] as LedgerInvite[],
  stats: [
    { label: "Active members", value: "42" },
    { label: "Custom roles", value: "6" },
    { label: "Pending invites", value: "3" },
  ],
  roleDistribution: [
    { name: "Organization owner", count: 1 },
    { name: "Product admin", count: 5 },
    { name: "Support lead", count: 4 },
    { name: "Analyst", count: 6 },
    { name: "Member", count: 26 },
  ],
} as const;

/** Signature UI: the six permission rules shown on the permission register. */
export const SIGNATURE_PERMISSIONS = [
  {
    group: "People",
    rules: [
      {
        label: "Invite members",
        description: "Can invite new people and choose an initial role.",
        state: "Allow" as const,
      },
      {
        label: "Deactivate members",
        description: "Can suspend access while preserving ownership history.",
        state: "Deny" as const,
      },
    ],
  },
  {
    group: "Access",
    rules: [
      {
        label: "Change member roles",
        description: "Can replace a member’s assigned organization role.",
        state: "Allow" as const,
      },
      {
        label: "Edit role permissions",
        description: "Inherits the organization policy for custom roles.",
        state: "Inherit" as const,
      },
    ],
  },
  {
    group: "Governance",
    rules: [
      {
        label: "Read audit log",
        description: "Can review consequential access changes and exports.",
        state: "Allow" as const,
      },
      {
        label: "Export audit records",
        description: "Cannot download the organization audit archive.",
        state: "Deny" as const,
      },
    ],
  },
] as const;
