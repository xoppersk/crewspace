import Link from "next/link";
import { ArrowRight, Command, Database, KeyRound, LayoutDashboard, ShieldCheck, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  {
    icon: KeyRound,
    title: "Supabase Auth",
    description: "Email/password, magic links, and password reset — wired through @supabase/ssr cookie sessions.",
  },
  {
    icon: Database,
    title: "Postgres + Row Level Security",
    description: "A profiles table with a handle_new_user() trigger and owner-only RLS, plus a pgTAP test skeleton.",
  },
  {
    icon: ShieldCheck,
    title: "Server-side guards",
    description: "requireUser() for auth and a requireOrgAccess() pattern for multi-tenant authorization.",
  },
  {
    icon: LayoutDashboard,
    title: "App shell",
    description: "Collapsible sidebar, header with theme toggle and user menu, command palette, empty states.",
  },
  {
    icon: Command,
    title: "Command palette",
    description: "cmdk-based palette with an extensible actions array. Press ⌘K anywhere in the app.",
  },
  {
    icon: Zap,
    title: "CI gates",
    description: "Lint → typecheck → Vitest → bundle-size gate on every push, with Vercel previews per PR.",
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-svh">
      {/* Top bar */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="font-semibold tracking-tight">Sevyn App Starter</span>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center md:py-28">
        <h1 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">
          Ship your next SaaS on a starter that already does the boring parts
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
          Next.js App Router, TypeScript, Tailwind v4, shadcn/ui, and Supabase — with auth,
          a Postgres schema, Row Level Security, an app shell, and CI gates baked in.
          Clone it, rename it, build.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/app">
              Open the app <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted">
                  <feature.icon className="size-4.5 text-foreground" />
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 text-sm text-muted-foreground">
          <span>Sevyn App Starter · Next.js + Supabase</span>
          <span>Clone → rename → ship</span>
        </div>
      </footer>
    </main>
  );
}
