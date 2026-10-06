"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFamilyAction } from "@/lib/actions/families";

type Props = {
  familyId: string;
  initial: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    notes: string;
  };
};

export function EditFamilyForm({ familyId, initial }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateFamilyAction({ id: familyId, fullName, email, phone, address, city, notes });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-line bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Full Name</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
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
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">Staff Notes (optional)</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
        {saved && <span className="text-sm text-green-700">Saved.</span>}
        <button type="submit" disabled={isPending} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent disabled:opacity-50">
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
