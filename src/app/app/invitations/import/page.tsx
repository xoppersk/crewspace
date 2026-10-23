import type { Metadata } from "next";
import { loadActiveWorkspaceData } from "@/lib/data/server";
import { AppShell, FocusedShell } from "@/components/Shell";
import { CsvImport } from "./CsvImport";

export const metadata: Metadata = {
  title: "Crewspace — Import members",
};

/**
 * G-02 CSV import. The page only supplies the workspace's real data
 * (roles, teams, members, open invitations, seat counts); the upload
 * → check → send flow runs in CsvImport, and sending inserts real
 * invitation rows through the importInvitations server action.
 */
export default async function CsvImportPage() {
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="invitations">{null}</AppShell>;
  }

  return (
    <FocusedShell flowName="Import members" cancelLabel="Cancel import" cancelHref="/app/invitations">
      <div className="gov-crumb-row">
        <span>Import members</span>
        <span aria-hidden="true">/</span>
        <span>Upload</span>
        <span aria-hidden="true">/</span>
        <b>Check</b>
      </div>

      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <CsvImport data={data} />
      </div>
    </FocusedShell>
  );
}
