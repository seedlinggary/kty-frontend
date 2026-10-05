"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSignup } from "@/lib/actions/signup-admin";
import { formatAgorotAsILS } from "@/lib/money";

type OtherLineItem = { holidayNameEn: string; menSeats: number; womenSeats: number };

type Props = {
  signupId: string;
  holidayId: string;
  holidayNameEn: string;
  memberPriceAgorot: number;
  nonMemberPriceAgorot: number;
  billStatus: "PENDING" | "PAID" | "CANCELLED";
  initial: {
    fullName: string;
    phone: string;
    email: string;
    isMember: boolean;
    notes: string;
    menSeats: number;
    womenSeats: number;
  };
  otherLineItems: OtherLineItem[];
};

export function EditSignupForm({
  signupId,
  holidayId,
  holidayNameEn,
  memberPriceAgorot,
  nonMemberPriceAgorot,
  billStatus,
  initial,
  otherLineItems,
}: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [isMember, setIsMember] = useState(initial.isMember);
  const [menSeats, setMenSeats] = useState(initial.menSeats);
  const [womenSeats, setWomenSeats] = useState(initial.womenSeats);
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const perSeat = isMember ? memberPriceAgorot : nonMemberPriceAgorot;
  const totalAgorot = useMemo(() => perSeat * (menSeats + womenSeats), [perSeat, menSeats, womenSeats]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (menSeats + womenSeats < 1) {
      setError("Please select at least one seat.");
      return;
    }
    if (!fullName.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }

    startTransition(async () => {
      const result = await updateSignup({
        signupId,
        fullName,
        phone,
        email,
        isMember,
        notes,
        menSeats,
        womenSeats,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/admin/holidays/${holidayId}/signups`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5 rounded-xl border border-line bg-white p-6">
      {billStatus === "PAID" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This bill is already marked paid. Fixing the name/phone/email is always safe. If you
          change seats or membership status, the total shown here updates, but the amount actually
          collected does not change automatically — coordinate any refund or extra charge
          separately.
        </p>
      )}

      {otherLineItems.length > 0 && (
        <p className="rounded-md bg-pale px-3 py-2 text-sm text-ink/70">
          This family&apos;s payment also covers: {otherLineItems.map((li) => `${li.holidayNameEn} (${li.menSeats}M/${li.womenSeats}W)`).join(", ")}.
          Membership status is shared across the whole bill, so changing it below recalculates
          those totals too.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Full Name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-ink">Membership</span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsMember(true)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              isMember ? "border-accent bg-accent/10 text-ink" : "border-line text-ink/70"
            }`}
          >
            Member
          </button>
          <button
            type="button"
            onClick={() => setIsMember(false)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              !isMember ? "border-accent bg-accent/10 text-ink" : "border-line text-ink/70"
            }`}
          >
            Non-Member
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Men&apos;s Seats — {holidayNameEn}
          </label>
          <input
            type="number"
            min={0}
            value={menSeats}
            onChange={(e) => setMenSeats(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Women&apos;s Seats — {holidayNameEn}
          </label>
          <input
            type="number"
            min={0}
            value={womenSeats}
            onChange={(e) => setWomenSeats(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-line px-3 py-2"
        />
      </div>

      <div className="flex items-center justify-between border-t border-line pt-5">
        <p className="text-lg font-semibold text-ink">
          {formatAgorotAsILS(totalAgorot)}
          <span className="ml-1 text-sm font-normal text-ink/50">for {holidayNameEn}</span>
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
