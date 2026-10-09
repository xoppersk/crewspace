import Link from "next/link";
import {
  ArrowRight,
  FileText,
  KeyRound,
  MailPlus,
  ScanSearch,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TRUTH_LEDGER } from "@/lib/demo/truth-ledger";
import { RoleBadge } from "@/components/roles/role-badge";
import { RoleSeal } from "@/components/crew/role-seal";
import { MatrixTeaser } from "./_components/matrix-teaser";

/**
 * Marketing landing (UI-DESIGN.md §2.1): top nav → hero with the interactive
 * permission-matrix teaser → three pattern sections (Directory, Roles,
 * Audit) with static mock visuals → How it works (Invite → Assign →
 * Verify) → tech-stack strip → footer.
 */

const NAV_LINKS = [
  { label: "Directory", href: "#directory" },
  { label: "Roles", href: "#roles" },
  { label: "Audit", href: "#audit" },
  { label: "How it works", href: "#how-it-works" },
];

const PATTERNS = [
  {
    id: "directory",
    icon: Users,
    kicker: "Pattern · Directory",
    title: "Find people quickly",
    description:
      "Find people quickly, understand their access, and open a focused member detail drawer.",
    mock: <DirectoryMock />,
  },
  {
    id: "roles",
    icon: KeyRound,
    kicker: "Pattern · Roles",
    title: "Shape access in plain language",
    description:
      "Shape access in plain language and review the exact effect of every permission change.",
    mock: <RolesMock />,
  },
  {
    id: "audit",
    icon: FileText,
    kicker: "Pattern · Audit",
    title: "Trace every consequential change",
    description:
      "Trace consequential changes by actor, object, time, and before-and-after values.",
    mock: <AuditMock />,
  },
];

const STEPS = [
  {
    icon: MailPlus,
    step: "1",
    title: "Invite",
    description:
      "Send invitations with the right role from day one — delivery, expiry, and resend are all tracked.",
  },
  {
    icon: KeyRound,
    step: "2",
    title: "Assign",
    description:
      "Give people roles in plain language. Custom roles start from a safe baseline, never a blank slate.",
  },
  {
    icon: ShieldCheck,
    step: "3",
    title: "Verify",
    description:
      "The audit log records every change with before-and-after values, so access is always explainable.",
  },
];

export default function Home() {
  return (
    <main className="min-h-svh bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-md bg-primary text-base font-bold text-white"
            >
              C
            </span>
            <span className="text-lg font-bold tracking-tight">Crewspace</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Product">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-in">
                View live demo <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 md:pt-24 md:pb-16">
        <p className="text-xs font-bold tracking-[0.17em] uppercase text-primary">
          Team access, made explainable
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Know exactly who can do what
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Crewspace is a people-and-permissions workspace with calm authority: granular
          roles in plain language, an immutable audit log, and access everyone can
          explain.
        </p>
        <div className="mt-10">
          <MatrixTeaser />
        </div>
      </section>

      {/* Pattern sections */}
      {PATTERNS.map((pattern, i) => (
        <section
          key={pattern.id}
          id={pattern.id}
          className={i % 2 === 1 ? "border-y bg-card" : undefined}
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
            <div className={i % 2 === 1 ? "md:order-2" : undefined}>
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.17em] uppercase text-primary">
                <pattern.icon className="size-4" aria-hidden /> {pattern.kicker}
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                {pattern.title}
              </h2>
              <p className="mt-4 max-w-md text-muted-foreground">{pattern.description}</p>
              <Button variant="outline" asChild className="mt-6">
                <Link href="/sign-in">
                  See it in the demo <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className={i % 2 === 1 ? "md:order-1" : undefined}>{pattern.mock}</div>
          </div>
        </section>
      ))}

      {/* How it works */}
      <section id="how-it-works" className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <p className="text-xs font-bold tracking-[0.17em] uppercase text-primary">
            How it works
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Invite → Assign → Verify
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.step} className="border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft">
                    <step.icon className="size-5 text-primary" aria-hidden />
                  </span>
                  <span className="text-sm font-bold text-muted-foreground">
                    Step {step.step}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack strip */}
      <section className="border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
          <p className="text-sm font-medium text-muted-foreground">
            Built on production-grade primitives
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {["Next.js", "Supabase", "shadcn/ui"].map((tech) => (
              <span
                key={tech}
                className="border px-3 py-1.5 text-sm font-semibold tracking-tight"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-white"
            >
              C
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight">Crewspace</p>
              <p className="text-xs text-muted-foreground">Access everyone can explain.</p>
            </div>
          </div>
          <nav className="flex items-center gap-5 text-sm text-muted-foreground" aria-label="Footer">
            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/sign-up" className="hover:text-foreground">
              Get started
            </Link>
            <Link href="#how-it-works" className="hover:text-foreground">
              How it works
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

/** Static directory mock: register rows from the truth ledger. */
function DirectoryMock() {
  return (
    <div className="border bg-background shadow-sm" aria-hidden>
      <div className="border-b-2 border-foreground px-5 pt-4 pb-3">
        <p className="text-xs font-bold tracking-[0.13em] uppercase text-muted-foreground">
          Member register
        </p>
      </div>
      <ul className="divide-y">
        {TRUTH_LEDGER.people.map((person) => (
          <li key={person.name} className="flex items-center gap-3 px-5 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
              {person.name
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{person.name}</span>
              {person.registerNo ? (
                <span className="mt-0.5 block">
                  <RoleSeal>{person.registerNo}</RoleSeal>
                </span>
              ) : null}
            </span>
            <RoleBadge roleName={person.role} />
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span
                className={
                  person.status === "Active"
                    ? "size-2 rounded-full bg-success"
                    : "size-2 rounded-full bg-warning"
                }
              />
              {person.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Static roles mock: register groups with allow-state chips. */
function RolesMock() {
  const groups: { name: string; rules: string[] }[] = [
    { name: "People", rules: ["Invite members", "Deactivate members"] },
    { name: "Access", rules: ["Change member roles", "Edit role permissions"] },
    { name: "Governance", rules: ["Read audit log", "Export audit records"] },
  ];
  return (
    <div className="border bg-background p-5 shadow-sm md:p-6" aria-hidden>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Permission register</p>
        <p className="text-xs text-muted-foreground">6 shown · 18 total</p>
      </div>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.name}>
            <p className="register-group-title border-t-2 border-foreground pt-2 pb-1">
              <span>{group.name}</span>
              <span className="text-muted-foreground">{group.rules.length} rules</span>
            </p>
            <div className="flex flex-col pt-1">
              {group.rules.map((rule) => (
                <div
                  key={rule}
                  className="flex items-center justify-between border-b py-2 text-sm last:border-b-0"
                >
                  <span className="font-medium">{rule}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-success">
                    <UserCheck className="size-3.5" /> Allow
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Static audit mock: human-readable sentences with before/after values. */
function AuditMock() {
  const events = [
    {
      actor: "Maya Jordan",
      sentence: "changed Luis Gomez’s role from Member to Manager",
      time: "2h ago",
    },
    {
      actor: "Sheku Koroma",
      sentence: "accepted Priya Shah’s invitation as Analyst",
      time: "5h ago",
    },
    {
      actor: "Maya Jordan",
      sentence: "exported the audit log (42 events)",
      time: "Yesterday",
    },
  ];
  return (
    <div className="border bg-background shadow-sm" aria-hidden>
      <div className="border-b-2 border-foreground px-5 pt-4 pb-3">
        <p className="text-xs font-bold tracking-[0.13em] uppercase text-muted-foreground">
          Audit log · immutable
        </p>
      </div>
      <ul className="divide-y">
        {events.map((event) => (
          <li key={event.sentence} className="flex items-start gap-3 px-5 py-3.5">
            <ScanSearch className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{event.actor}</span>{" "}
              <span className="text-muted-foreground">{event.sentence}</span>
            </p>
            <time className="shrink-0 text-xs text-muted-foreground">{event.time}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}
