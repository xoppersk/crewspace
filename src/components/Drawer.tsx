"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A record over its list: right-side panel over a scrim.
 * role="dialog", aria-modal, Escape closes, focus returns to the opener.
 */
export function Drawer({
  labelledBy,
  onClose,
  children,
  footer,
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const closeBtn =
      ref.current?.querySelector<HTMLElement>("[data-drawer-close]");
    closeBtn?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={ref}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
        {footer}
      </aside>
    </div>
  );
}

export function DrawerClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      data-drawer-close
      aria-label="Close"
      onClick={onClose}
      style={{
        display: "inline-flex",
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        border: 0,
        background: "transparent",
        color: "var(--ink-2)",
        cursor: "pointer",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M3 3l10 10M13 3L3 13" />
      </svg>
    </button>
  );
}
