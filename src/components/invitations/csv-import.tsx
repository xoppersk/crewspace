"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  RotateCcw,
  XCircle,
  X,
} from "lucide-react";

import {
  bulkInvite,
  type InviteOrgContext,
  type SendResult,
} from "@/lib/invitations/actions";
import {
  inviteCsvTemplate,
  normalizeEmail,
  parseInviteCsv,
  validateCsvRow,
  type CsvRowResult,
} from "@/lib/invitations/policy";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Bulk CSV import (APP-FLOW Flow C): downloadable template, drag-drop,
 * client-side parse + per-row Zod validation with a review table
 * (valid / warning / error), then a server action inserts valid rows
 * one-by-one and reports "N sent, M failed" with retry for failures.
 */
export function CsvImport({
  open,
  onOpenChange,
  context,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: InviteOrgContext;
  onDone: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<CsvRowResult[]>([]);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);

  const rolesByName = useMemo(
    () => new Map(context.roles.map((r) => [r.name.toLowerCase(), r.id] as const)),
    [context.roles],
  );
  const teamsByName = useMemo(
    () => new Map(context.teams.map((t) => [t.name.toLowerCase(), t.id] as const)),
    [context.teams],
  );

  const visibleRows = useMemo(() => rows.filter((_, i) => !removed.has(i)), [rows, removed]);
  const counts = useMemo(() => {
    let valid = 0,
      warning = 0,
      error = 0;
    for (const r of visibleRows) {
      if (r.status === "valid") valid += 1;
      else if (r.status === "warning") warning += 1;
      else error += 1;
    }
    return { valid, warning, error };
  }, [visibleRows]);

  const sendable = useMemo(
    () => visibleRows.filter((r) => r.status !== "error"),
    [visibleRows],
  );

  function downloadTemplate() {
    const blob = new Blob([inviteCsvTemplate()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invitations-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function readFile(file: File) {
    setParseError(null);
    setResults(null);
    const text = await file.text();
    try {
      const inputs = parseInviteCsv(text);
      const seen = new Set<string>();
      const validated = inputs.map((input) => {
        const result = validateCsvRow(input, {
          rolesByName,
          teamsByName,
          defaultRoleId: context.defaultRoleId ?? context.roles[0]?.id ?? "",
          defaultRoleName: context.defaultRoleName ?? context.roles[0]?.name ?? "Member",
          seenEmails: seen,
        });
        if (result.status !== "error") seen.add(result.email);
        return result;
      });
      setRows(validated);
      setRemoved(new Set());
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Could not read this file.");
      setRows([]);
    }
  }

  async function onSend() {
    setSending(true);
    try {
      const { sent } = await bulkInvite(
        context.id,
        sendable.map((r) => ({
          email: r.email,
          fullName: r.fullName,
          roleId: r.roleId ?? context.defaultRoleId ?? "",
          teamIds: r.teamIds,
        })),
      );
      setResults(sent);
      onDone();
    } finally {
      setSending(false);
    }
  }

  const failedResults = useMemo(
    () => (results ?? []).filter((r) => !r.ok),
    [results],
  );

  async function onRetry() {
    // Re-send only the failures (re-validated server-side).
    setSending(true);
    try {
      const retryRows = failedResults.map((f) => {
        const original = sendable.find((r) => normalizeEmail(r.email) === normalizeEmail(f.email));
        return {
          email: f.email,
          fullName: original?.fullName ?? "",
          roleId: original?.roleId ?? context.defaultRoleId ?? "",
          teamIds: original?.teamIds ?? [],
        };
      });
      const { sent } = await bulkInvite(context.id, retryRows);
      setResults((prev) => {
        const next = [...(prev ?? [])];
        for (const s of sent) {
          const i = next.findIndex((p) => normalizeEmail(p.email) === normalizeEmail(s.email));
          if (i >= 0) next[i] = s;
        }
        return next;
      });
      onDone();
    } finally {
      setSending(false);
    }
  }

  function close() {
    onOpenChange(false);
    setRows([]);
    setRemoved(new Set());
    setResults(null);
    setParseError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk import invitations</DialogTitle>
          <DialogDescription>
            Upload a CSV with columns <span className="font-mono">email,full_name,role,team</span>.
            Unknown roles map to the default role; unknown teams are dropped.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {results ? (
            <ResultSummary results={results} onRetry={onRetry} retrying={sending} />
          ) : (
            <>
              <div
                role="button"
                tabIndex={0}
                aria-label="Drop a CSV file or click to choose one"
                onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void readFile(file);
                }}
                className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
              >
                <FileUp className="size-6 text-muted-foreground" />
                <p className="text-sm">
                  Drop your CSV here, or <span className="font-medium underline">choose a file</span>
                </p>
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); downloadTemplate(); }} className="min-h-11">
                  <Download className="size-4" /> Download template
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void readFile(file);
                    e.target.value = "";
                  }}
                />
              </div>

              {parseError ? (
                <Alert variant="destructive">
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              ) : null}

              {visibleRows.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary">
                      <CheckCircle2 className="size-3.5" /> {counts.valid} valid
                    </Badge>
                    {counts.warning > 0 ? (
                      <Badge variant="outline" className="border-warning/50 text-warning ">
                        <AlertTriangle className="size-3.5" /> {counts.warning} warnings
                      </Badge>
                    ) : null}
                    {counts.error > 0 ? (
                      <Badge variant="destructive">
                        <XCircle className="size-3.5" /> {counts.error} errors
                      </Badge>
                    ) : null}
                    {counts.error > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Remove error rows before sending.
                      </span>
                    ) : null}
                  </div>

                  {/* Review table: table on desktop, cards on mobile */}
                  <div className="hidden max-h-72 overflow-y-auto rounded-md border md:block">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">Role</th>
                          <th className="px-3 py-2 font-medium">Team</th>
                          <th className="px-3 py-2 font-medium">Note</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((r, i) => (
                          <tr key={r.input.line} className="border-t align-top">
                            <td className="px-3 py-2">
                              <RowStatusIcon status={r.status} />
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-medium">{r.email || "—"}</span>
                              {r.fullName ? (
                                <span className="block text-xs text-muted-foreground">{r.fullName}</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">{r.input.role || "default"}</td>
                            <td className="px-3 py-2">{r.input.team || "—"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {r.message ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                aria-label={`Remove row ${r.input.line}`}
                                onClick={() => setRemoved((prev) => new Set(prev).add(i))}
                                className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
                              >
                                <X className="size-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="flex flex-col gap-2 md:hidden">
                    {visibleRows.map((r, i) => (
                      <li
                        key={r.input.line}
                        className="flex items-start gap-3 rounded-lg border p-3"
                      >
                        <RowStatusIcon status={r.status} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{r.email || "—"}</p>
                          {r.message ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">{r.message}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove row ${r.input.line}`}
                          onClick={() => setRemoved((prev) => new Set(prev).add(i))}
                          className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} className="min-h-11">
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && visibleRows.length > 0 ? (
            <Button
              onClick={onSend}
              disabled={sending || sendable.length === 0 || counts.error > 0}
              className="min-h-11"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : null}
              Send {sendable.length} invitation{sendable.length === 1 ? "" : "s"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RowStatusIcon({ status }: { status: "valid" | "warning" | "error" }) {
  if (status === "valid") return <CheckCircle2 className="size-4 text-success" aria-label="Valid" />;
  if (status === "warning") return <AlertTriangle className="size-4 text-warning" aria-label="Warning" />;
  return <XCircle className="size-4 text-destructive" aria-label="Error" />;
}

function ResultSummary({
  results,
  onRetry,
  retrying,
}: {
  results: SendResult[];
  onRetry: () => void;
  retrying: boolean;
}) {
  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return (
    <div className="flex flex-col gap-3">
      <Alert variant={failed.length ? "destructive" : "default"}>
        <AlertDescription className="text-sm">
          <span className="font-semibold">
            {sent} sent{failed.length ? `, ${failed.length} failed` : ""}
          </span>
          {failed.length > 0 ? " — fix the issues below and retry." : " — you're all set."}
        </AlertDescription>
      </Alert>
      {failed.length > 0 ? (
        <>
          <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
            {failed.map((f) => (
              <li key={f.email} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{f.email}</p>
                <p className="text-muted-foreground">{f.error}</p>
                {f.memberId ? (
                  <p className="mt-1 text-xs">They&rsquo;re already a member — no invite needed.</p>
                ) : null}
              </li>
            ))}
          </ul>
          <Button onClick={onRetry} disabled={retrying} variant="outline" className="min-h-11 self-start">
            {retrying ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            Retry {failed.length} failed
          </Button>
        </>
      ) : null}
    </div>
  );
}
