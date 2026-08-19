"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createSignup } from "@/lib/actions/signups";
import { agorotToShekels } from "@/lib/money";
import { Button } from "@/components/ui/button";

type Props = {
  holidaySlug: string;
  holidayName: string;
  memberPriceAgorot: number;
  nonMemberPriceAgorot: number;
  locale: "en" | "he";
};

type SuccessState = {
  billId: string;
  totalAgorot: number;
  paymentLink: string | null;
};

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-navy">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-line text-lg text-navy hover:bg-cream-alt"
          aria-label="decrease"
        >
          &minus;
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="h-10 w-16 rounded-md border border-line text-center"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-line text-lg text-navy hover:bg-cream-alt"
          aria-label="increase"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SeatSignupForm({
  holidaySlug,
  holidayName,
  memberPriceAgorot,
  nonMemberPriceAgorot,
  locale,
}: Props) {
  const t = useTranslations("seats");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [menSeats, setMenSeats] = useState(0);
  const [womenSeats, setWomenSeats] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [isPending, startTransition] = useTransition();

  const perSeat = isMember ? memberPriceAgorot : nonMemberPriceAgorot;
  const totalAgorot = useMemo(() => perSeat * (menSeats + womenSeats), [perSeat, menSeats, womenSeats]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (menSeats + womenSeats < 1) {
      setError(t("atLeastOneSeat"));
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
        locale,
        createdBy: "public",
      });

      if (!result.ok) {
        const key =
          result.error === "no_seats"
            ? "atLeastOneSeat"
            : result.error === "missing_fields"
              ? "missingFields"
              : "holidayNotOpen";
        setError(t(key));
        return;
      }

      setSuccess({
        billId: result.billId,
        totalAgorot: result.totalAgorot,
        paymentLink: result.paymentLink,
      });
    });
  }

  if (success) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          {t("statusLabel")}: {t("statusPending")}
        </span>
        <h2 className="mt-4 font-serif text-2xl font-semibold text-navy">{t("successHeading")}</h2>
        <p className="mt-2 text-ink/70">{t("successBody", { holiday: holidayName })}</p>
        <p className="mt-4 text-sm text-ink/50">
          {t("billIdLabel")}: <span className="font-mono">BILL-{success.billId}</span>
        </p>
        <p className="mt-1 font-serif text-3xl font-bold text-navy">
          {new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
            style: "currency",
            currency: "ILS",
            minimumFractionDigits: 0,
          }).format(agorotToShekels(success.totalAgorot))}
        </p>

        <p className="mx-auto mt-5 max-w-md rounded-md bg-amber-50 p-4 text-sm text-amber-900">
          {t("notConfirmedNote")}
        </p>

        <div className="mt-6">
          {success.paymentLink ? (
            <a
              href={success.paymentLink}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-6 py-3 text-sm font-semibold text-navy shadow-sm hover:bg-gold-light"
            >
              {t("payNow")}
            </a>
          ) : (
            <p className="rounded-md bg-cream-alt p-4 text-sm text-ink/70">
              {t("paymentNotConfigured")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-line bg-white p-8">
      <p className="text-ink/70">{t("formIntro")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">{t("fullName")}</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">{t("phone")}</label>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-navy">{t("email")}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-navy">{t("membership")}</span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsMember(true)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              isMember ? "border-gold bg-gold/15 text-navy" : "border-line text-ink/70"
            }`}
          >
            {t("member")}
          </button>
          <button
            type="button"
            onClick={() => setIsMember(false)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              !isMember ? "border-gold bg-gold/15 text-navy" : "border-line text-ink/70"
            }`}
          >
            {t("nonMember")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stepper label={t("menSeats")} value={menSeats} onChange={setMenSeats} />
        <Stepper label={t("womenSeats")} value={womenSeats} onChange={setWomenSeats} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-navy">{t("notes")}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notesPlaceholder")}
          rows={3}
          className="w-full rounded-md border border-line px-3 py-2"
        />
      </div>

      <div className="flex items-center justify-between border-t border-line pt-6">
        <div>
          <p className="text-sm text-ink/60">{t("totalLabel")}</p>
          <p className="font-serif text-2xl font-bold text-navy">
            {new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
              style: "currency",
              currency: "ILS",
              minimumFractionDigits: 0,
            }).format(agorotToShekels(totalAgorot))}
          </p>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("submitting") : t("submit")}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
