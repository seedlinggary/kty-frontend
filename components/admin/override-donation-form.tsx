"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { overrideDonationAction } from "@/lib/actions/payment-admin";

type Props = {
  donationId: string;
  initial: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    amountShekels: number;
    purpose: string;
    status: "PENDING" | "PAID" | "CANCELLED";
  };
};

export function OverrideDonationForm({ donationId, initial }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [amountShekels, setAmountShekels] = useState(initial.amountShekels);
  const [purpose, setPurpose] = useState(initial.purpose);
  const [status, setStatus] = useState(initial.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await overrideDonationAction({
        id: donationId,
        fullName,
        email,
        phone,
        address,
        city,
        amountShekels,
        purpose,
        status,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/donations");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5 rounded-xl border border-line bg-white p-6">
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Super admin override - this directly overwrites the recorded donation. Use it to correct a
        mistake (e.g. after reconciling against the bank statement), not as a normal workflow.
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
          <label className="mb-1 block text-sm font-medium text-ink">Amount (₪)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amountShekels}
            onChange={(e) => setAmountShekels(Number(e.target.value) || 0)}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-full rounded-md border border-line px-3 py-2">
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">Purpose (optional)</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
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
