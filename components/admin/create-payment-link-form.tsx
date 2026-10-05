"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPaymentLink } from "@/lib/actions/payment-links";
import { CopyLinkButton } from "@/components/admin/copy-link-button";

export function CreatePaymentLinkForm() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amountShekels, setAmountShekels] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ paymentLink: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPaymentLink({ label, fullName, phone, email, amountShekels });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess({ paymentLink: result.paymentLink });
      router.refresh();
    });
  }

  if (success) {
    return (
      <div className="max-w-xl rounded-xl border border-line bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Payment Link Created</h2>
        {success.paymentLink ? (
          <div className="mt-3 flex items-center gap-3">
            <a href={success.paymentLink} target="_blank" rel="noreferrer" className="truncate text-sm text-accent hover:underline">
              {success.paymentLink}
            </a>
            <CopyLinkButton link={success.paymentLink} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/60">NedarimPlus isn&apos;t configured yet.</p>
        )}
        <button
          type="button"
          onClick={() => {
            setSuccess(null);
            setLabel("");
            setFullName("");
            setPhone("");
            setEmail("");
            setAmountShekels(0);
          }}
          className="mt-5 text-sm font-medium text-ink hover:underline"
        >
          + Create another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4 rounded-xl border border-line bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">What is this for? (shown to you, not necessarily to the payer)</label>
        <input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Pledge balance, Event fee" className="w-full rounded-md border border-line px-3 py-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Name (optional)</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">Email (optional)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Amount (₪)</label>
          <input type="number" min={0} step="0.01" required value={amountShekels} onChange={(e) => setAmountShekels(Number(e.target.value) || 0)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
      </div>
      <div className="flex justify-end border-t border-line pt-4">
        <button type="submit" disabled={isPending} className="rounded-md bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-50">
          {isPending ? "Creating..." : "Create Payment Link"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
