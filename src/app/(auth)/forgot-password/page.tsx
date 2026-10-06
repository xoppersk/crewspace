import { redirect } from "next/navigation";

/**
 * Legacy alias — the canonical route is /reset-password?step=request.
 * Kept so stale links and old emails never 404.
 */
export default function ForgotPasswordCompatPage() {
  redirect("/reset-password?step=request");
}
