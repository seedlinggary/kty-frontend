"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { overridePaymentLinkAction } from "@/lib/actions/payment-admin";

type Props = {
  paymentLinkId: string;
  initial: {
    label: string;
    fullName: string;
    phone: string;
    email: string;
    amountShekels: number;
    status: "PENDING" | "PAID" | "CANCELLED";
  };
};

export function OverridePaymentLinkForm({ paymentLinkId, initial }: Props) {
  const router = useRouter();
  const [label, setLabel] = useState(initial.label);
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [amountShekels, setAmountShekels] = useState(initial.amountShekels);
  const [status, setStatus] = useState(initial.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await overridePaymentLinkAction({ id: paymentLinkId, label, fullName, phone, email, amountShekels, status });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/payment-links");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5 rounded-xl border border-line bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Label</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Amount (₪)</label>
          <input type="number" min={0} step="0.01" value={amountShekels} onChange={(e) => setAmountShekels(Number(e.target.value) || 0)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full rounded-md border border-line px-3 py-2">
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
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
