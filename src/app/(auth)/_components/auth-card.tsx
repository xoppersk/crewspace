import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Centered card shell shared by every auth page. Pages supply the
 * title/description/footer; the form itself is a client component.
 */
export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Crewspace home">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-white"
        >
          C
        </span>
        <span className="text-xl font-bold tracking-tight">Crewspace</span>
      </Link>
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer ? <CardFooter className="justify-center">{footer}</CardFooter> : null}
      </Card>
    </div>
  );
}
