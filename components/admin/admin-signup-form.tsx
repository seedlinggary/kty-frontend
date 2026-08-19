"use client";

import { useMemo, useState, useTransition } from "react";
import { createSignup } from "@/lib/actions/signups";
import { formatAgorotAsILS } from "@/lib/money";
import { CopyLinkButton } from "@/components/admin/copy-link-button";

type Props = {
  holidaySlug: string;
  memberPriceAgorot: number;
  nonMemberPriceAgorot: number;
};

export function AdminSignupForm({ holidaySlug, memberPriceAgorot, nonMemberPriceAgorot }: Props) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [menSeats, setMenSeats] = useState(0);
  const [womenSeats, setWomenSeats] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    billId: string;
    totalAgorot: number;
    paymentLink: string | null;
  } | null>(null);
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
      const result = await createSignup({
        holidaySlug,
        fullName,
        phone,
        email,
        isMember,
        menSeats,
        womenSeats,
        notes,
        locale: "en",
        createdBy: "admin",
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(result);
    });
  }

  if (success) {
    return (
      <div className="max-w-xl rounded-xl border border-line bg-white p-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          Status: Payment Pending
        </span>
        <h2 className="mt-3 font-serif text-xl font-semibold text-navy">Bill Created</h2>
        <p className="mt-2 text-sm text-ink/60">Reference: BILL-{success.billId}</p>
        <p className="mt-2 text-2xl font-bold text-navy">{formatAgorotAsILS(success.totalAgorot)}</p>
        <p className="mt-3 text-sm text-ink/60">
          Seats are not confirmed until this is paid — send the link below to the family, or mark it
          paid manually from the holiday&apos;s signup list once payment is received another way.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {success.paymentLink ? (
            <>
              <a
                href={success.paymentLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-gold-light"
              >
                Open Payment Page
              </a>
              <CopyLinkButton link={success.paymentLink} />
            </>
          ) : (
            <p className="text-sm text-ink/60">
              NedarimPlus isn&apos;t configured yet, so no payment link was generated.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setSuccess(null);
            setFullName("");
            setPhone("");
            setEmail("");
            setMenSeats(0);
            setWomenSeats(0);
            setNotes("");
          }}
          className="mt-6 text-sm font-medium text-navy hover:underline"
        >
          + Create another bill
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-5 rounded-xl border border-line bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Full Name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-navy">Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-navy">Membership</span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsMember(true)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              isMember ? "border-gold bg-gold/15 text-navy" : "border-line text-ink/70"
            }`}
          >
            Member
          </button>
          <button
            type="button"
            onClick={() => setIsMember(false)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              !isMember ? "border-gold bg-gold/15 text-navy" : "border-line text-ink/70"
            }`}
          >
            Non-Member
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Men&apos;s Seats</label>
          <input
            type="number"
            min={0}
            value={menSeats}
            onChange={(e) => setMenSeats(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Women&apos;s Seats</label>
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
        <label className="mb-1 block text-sm font-medium text-navy">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-line px-3 py-2"
        />
      </div>

      <div className="flex items-center justify-between border-t border-line pt-5">
        <p className="text-lg font-semibold text-navy">{formatAgorotAsILS(totalAgorot)}</p>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-cream hover:bg-navy-light disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create Bill"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
