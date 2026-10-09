import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * HintBar — the indigo-ruled explainer strip from the Signature UI.
 * States a rule in plain language, above the surface it explains.
 */
export function HintBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("hint-bar flex items-start gap-2.5", className)} role="note">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
