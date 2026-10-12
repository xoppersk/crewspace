import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "pri" | "outline" | "dest" | "on-dark" | "white";
export type ButtonSize = "app" | "h40" | "h44";

function cls(variant: ButtonVariant, size: ButtonSize, extra?: string) {
  return [
    "btn",
    variant === "pri" ? "pri" : "",
    variant === "dest" ? "dest" : "",
    variant === "on-dark" ? "on-dark" : "",
    variant === "white" ? "white" : "",
    size === "h40" ? "h40" : "",
    size === "h44" ? "h44" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = "outline",
  size = "app",
  className,
  children,
  ...rest
}: BtnProps) {
  return (
    <button className={cls(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "outline",
  size = "app",
  className,
  href,
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  href: string;
  children: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={cls(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
