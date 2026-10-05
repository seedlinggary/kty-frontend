import { auth } from "@/auth";

/**
 * Route-level protection (the /admin layout) only guarantees "some logged-in
 * admin," not which role - actions that should be SUPERADMIN-only (creating a
 * fixed-amount payment link, overwriting a payment record) check explicitly.
 */
export async function requireSuperAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") {
    return { ok: false, error: "Only a super admin can do this." };
  }
  return { ok: true };
}
