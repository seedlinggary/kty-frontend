"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { overrideMembershipAction } from "@/lib/actions/payment-admin";

type Props = {
  membershipId: string;
  initial: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    monthlyShekels: number;
    status: "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
  };
  /** NedarimPlus's last confirmed charge for this standing order, if any. */
  lastConfirmedShekels: number | null;
};

export function OverrideMembershipForm({ membershipId, initial, lastConfirmedShekels }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [monthlyShekels, setMonthlyShekels] = useState(initial.monthlyShekels);
  const [status, setStatus] = useState(initial.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const amountDivergesFromNedarim = lastConfirmedShekels != null && monthlyShekels !== lastConfirmedShekels;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (amountDivergesFromNedarim) {
      const ok = window.confirm(
        `You're saving ₪${monthlyShekels}/mo here, but NedarimPlus's last confirmed charge was ₪${lastConfirmedShekels}. ` +
          "This only updates our own records - it does not change what NedarimPlus will actually charge on the existing standing order. Save anyway?"
      );
      if (!ok) return;
    }

    startTransition(async () => {
      const result = await overrideMembershipAction({ id: membershipId, fullName, email, phone, address, city, monthlyShekels, status });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/memberships");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5 rounded-xl border border-line bg-white p-6">
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Super admin override - this directly overwrites the recorded membership. Changing the
        monthly amount here only updates our records; it does not change what NedarimPlus will
        actually charge on the existing standing order.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Full Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Monthly Amount (₪)</label>
          <input type="number" min={0} step="0.01" value={monthlyShekels} onChange={(e) => setMonthlyShekels(Number(e.target.value) || 0)} className="w-full rounded-md border border-line px-3 py-2" />
          {lastConfirmedShekels != null && (
            <p className="mt-1 text-xs text-ink/50">NedarimPlus&apos;s last confirmed charge: ₪{lastConfirmedShekels}</p>
          )}
          {amountDivergesFromNedarim && (
            <p className="mt-1 text-xs text-amber-700">
              This is different from NedarimPlus&apos;s last confirmed amount - saving only updates our records.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full rounded-md border border-line px-3 py-2">
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="PAST_DUE">Past Due</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-line pt-5">
        <button type="submit" disabled={isPending} className="rounded-md bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-50">
          {isPending ? "Saving..." : "Save Override"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
