import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Crewspace",
    template: "%s · Crewspace",
  },
  description:
    "Crewspace — know exactly who can do what. Multi-tenant team workspace with granular RBAC, invitations, and an immutable audit log.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        {/* Bottom-right on desktop, top-center on mobile (UI-DESIGN.md §2.4). */}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
