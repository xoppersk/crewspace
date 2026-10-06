import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

/**
 * StatCards — admin dashboard stat cards (members, pending invitations,
 * teams, custom roles). Each card links to its section.
 */
export function StatCards({
  stats,
}: {
  stats: { label: string; value: number; href: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          href={stat.href}
          className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="p-4 sm:p-5">
              <p className="text-3xl font-bold tracking-tight tabular-nums">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
