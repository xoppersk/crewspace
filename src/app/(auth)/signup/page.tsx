import { redirect } from "next/navigation";

/**
 * Legacy alias — the canonical route is /sign-up.
 */
export default function SignupCompatPage() {
  redirect("/sign-up");
}
