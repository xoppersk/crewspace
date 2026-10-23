"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { settingResultFor } from "@/lib/api";
import { createRole } from "@/lib/data/actions";
import { APP_LAYER_PERMISSION_IDS } from "@/lib/data/permissions";
import type {
  Permission,
  PermissionGroup,
  Role,
  Setting,
} from "@/lib/types";
import { Button, ButtonLink } from "@/components/Button";
import { PermissionRow, settingLabel } from "@/components/PermissionRow";
import { PermissionStrip } from "@/components/PermissionStrip";
import { IconCheck } from "@/components/icons";

/**
 * The role wizard's three steps in one client flow:
 * 1) name + what it's for + which role to copy;
 * 2) adjust the register (starts as an exact copy);
 * 3) review the differences, then create for real.
 */
export function RoleWizard({
  roles,
  permissions,
  groups,
  baselineIds,
  initialCopyFrom,
}: {
  roles: Role[];
  permissions: Permission[];
  groups: PermissionGroup[];
  baselineIds: number[];
  initialCopyFrom: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [copyFrom, setCopyFrom] = useState(initialCopyFrom);
  const source = roles.find((r) => r.id === copyFrom) ?? roles[0]!;
  const [settings, setSettings] = useState<Record<string, Setting>>(
    () => ({ ...source.settings }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeCopyFrom = (id: string) => {
    setCopyFrom(id);
    const src = roles.find((r) => r.id === id);
    if (src) setSettings({ ...src.settings });
  };

  const changes = useMemo(
    () =>
      permissions
        .filter((p) => settings[String(p.id)] !== source.settings[String(p.id)])
        .map((p) => ({
          permission: p,
          from: source.settings[String(p.id)]!,
          to: settings[String(p.id)]!,
        })),
    [permissions, settings, source],
  );

  const previewRole: Role = {
    id: "new",
    regNumber: "R-—",
    name: name || "New role",
    type: "Custom",
    summary,
    settings,
    lastChanged: "—",
  };
  const allows = permissions.filter(
    (p) =>
      settingResultFor(settings[String(p.id)]!, p.id, baselineIds) ===
      "Allowed",
  ).length;

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await createRole({
      name: name.trim(),
      summary: summary.trim(),
      settings,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(res.roleId ? `/app/roles/${res.roleId}` : "/app/roles");
    router.refresh();
  };

  return (
    <>
      <nav aria-label="Steps" className="card wz-steps">
        {[
          { n: 1, label: "Start from", sum: source.name },
          { n: 2, label: "Permissions", sum: `${changes.length} changed of 18` },
          { n: 3, label: "Review and create", sum: "" },
        ].map((s) => (
          <div
            key={s.n}
            className="wz-step"
            aria-current={step === s.n ? "step" : undefined}
          >
            <span className="n" aria-hidden="true">
              {step > s.n ? <IconCheck /> : s.n}
            </span>
            <span>
              <b>{s.label}</b>
              {s.sum ? (
                <>
                  <br />
                  <span className="sum">{s.sum}</span>
                </>
              ) : null}
            </span>
          </div>
        ))}
      </nav>

      {step === 1 ? (
        <div className="main-col-stack" style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 2px" }}>
            <h1 className="stitle">Name the new role</h1>
            <p className="sled">
              Nothing exists yet. Start from an existing role — the new
              role begins as an exact copy of its register.
            </p>
          </div>
          <section className="card wz-name-card">
            <div className="fld">
              <label htmlFor="nm">Name</label>
              <input
                id="nm"
                className="in"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekend support"
              />
            </div>
            <div className="fld">
              <label htmlFor="cf">Copy from</label>
              <select
                id="cf"
                className="in"
                value={copyFrom}
                onChange={(e) => changeCopyFrom(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="fld span2">
              <label htmlFor="ds">What it’s for</label>
              <input
                id="ds"
                className="in"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="One line the register will show"
              />
            </div>
          </section>
          <div>
            <Button
              variant="pri"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
            >
              Continue to permissions
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="main-col-stack" style={{ maxWidth: 860 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 2px" }}>
            <h1 className="stitle">Set what {name || "the role"} allows</h1>
            <p className="sled">
              Copied from {source.name}. Change anything; the differences
              are reviewed before the role exists.
            </p>
          </div>
          <section className="card register-card" aria-labelledby="pr">
            <div role="table" className="tbl-stack" style={{ minWidth: 620 }}>
              {groups.map((g) => (
                <div role="rowgroup" key={g.name}>
                  <div className="grp">
                    <span>{g.name}</span>
                  </div>
                  {g.permissionIds.map((pid) => {
                    const p = permissions.find((x) => x.id === pid)!;
                    return (
                      <PermissionRow
                        key={pid}
                        permission={p}
                        baselineIds={baselineIds}
                        setting={settings[String(pid)]!}
                        changedFrom={
                          settings[String(pid)] !== source.settings[String(pid)]
                            ? source.settings[String(pid)]!
                            : null
                        }
                        disabledReason={
                          APP_LAYER_PERMISSION_IDS.has(pid)
                            ? "Managed at the platform layer."
                            : undefined
                        }
                        onChange={(next) =>
                          setSettings((s) => ({ ...s, [String(pid)]: next }))
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button variant="pri" onClick={() => setStep(3)}>
              Review the role
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="split-340">
          <div className="main-col-stack">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 2px" }}>
              <h1 className="stitle">Review the new role</h1>
              <p className="sled">
                Check what it allows compared with {source.name}, then
                create it. Nobody is assigned yet — assign people from
                their records afterwards.
              </p>
            </div>
            <section className="card" aria-labelledby="df" style={{ overflow: "hidden" }}>
              <div className="card-head">
                <h2 id="df">Compared with {source.name}</h2>
              </div>
              <div role="table" aria-label={`Changes from ${source.name}`} style={{ minWidth: 560 }}>
                <div role="row" className="dr th">
                  <span role="columnheader">Permission</span>
                  <span role="columnheader">{source.name} → new</span>
                  <span role="columnheader">Result</span>
                </div>
                {changes.length === 0 ? (
                  <div role="row" className="dr">
                    <span role="cell">No differences — an exact copy.</span>
                    <span role="cell" />
                    <span role="cell" />
                  </div>
                ) : null}
                {changes.map((c) => (
                  <div role="row" className="dr" key={c.permission.id}>
                    <span role="cell">
                      <b style={{ fontWeight: 600 }}>{c.permission.name}</b>
                      <small>{c.permission.group}</small>
                    </span>
                    <span role="cell">
                      {settingLabel(c.from)} → {settingLabel(c.to)}
                    </span>
                    <span role="cell">
                      {settingResultFor(c.to, c.permission.id, baselineIds)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "18px 22px 20px", borderTop: "1px solid var(--rule-strong)", display: "flex", flexDirection: "column", gap: 10 }}>
                <span>
                  <b>Allows {allows} of 18</b>
                </span>
                <PermissionStrip
                  role={previewRole}
                  permissions={permissions}
                  baselineIds={baselineIds}
                  full
                  showCount={false}
                />
              </div>
            </section>
          </div>
          <aside className="aside-sticky">
            <section className="dpanel">
              <h2>When you create it</h2>
              <span>
                Roles go from {roles.length} to {roles.length + 1}.{" "}
                {source.name} is unchanged. One audit entry is written for
                the new role.
              </span>
              {error ? (
                <span style={{ color: "#f2b8b5" }}>{error}</span>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Button
                  variant="white"
                  size="h40"
                  disabled={busy || !name.trim()}
                  onClick={() => void create()}
                  style={{ justifyContent: "center" }}
                >
                  Create role
                </Button>
                <Button
                  variant="on-dark"
                  disabled={busy}
                  onClick={() => setStep(2)}
                >
                  Back to permissions
                </Button>
                <ButtonLink variant="on-dark" href="/app/roles">
                  Cancel
                </ButtonLink>
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </>
  );
}
