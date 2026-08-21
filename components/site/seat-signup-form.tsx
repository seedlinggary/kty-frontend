"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createBill } from "@/lib/actions/signups";
import { agorotToShekels } from "@/lib/money";
import { Button } from "@/components/ui/button";

export type HolidayOption = {
  slug: string;
  nameEn: string;
  nameHe: string;
  descriptionEn?: string | null;
  descriptionHe?: string | null;
  memberPriceAgorot: number;
  nonMemberPriceAgorot: number;
};

type Props = {
  holidays: HolidayOption[];
  highlightSlug?: string;
  locale: "en" | "he";
};

type SeatCounts = { menSeats: number; womenSeats: number };

type SuccessState = {
  billId: string;
  totalAgorot: number;
  paymentLink: string | null;
  breakdown: { name: string; menSeats: number; womenSeats: number; lineTotalAgorot: number }[];
};

function formatIls(agorot: number, locale: "en" | "he") {
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(agorotToShekels(agorot));
}

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
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-line text-lg text-ink hover:bg-pale"
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
          className="flex h-10 w-10 items-center justify-center rounded-md border border-line text-lg text-ink hover:bg-pale"
          aria-label="increase"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SeatSignupForm({ holidays, highlightSlug, locale }: Props) {
  const t = useTranslations("seats");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [seats, setSeats] = useState<Record<string, SeatCounts>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateSeats(slug: string, patch: Partial<SeatCounts>) {
    setSeats((prev) => {
      const current = prev[slug] ?? { menSeats: 0, womenSeats: 0 };
      return { ...prev, [slug]: { ...current, ...patch } };
    });
  }

  const totalAgorot = useMemo(() => {
    return holidays.reduce((sum, holiday) => {
      const count = seats[holiday.slug];
      if (!count) return sum;
      const perSeat = isMember ? holiday.memberPriceAgorot : holiday.nonMemberPriceAgorot;
      return sum + perSeat * (count.menSeats + count.womenSeats);
    }, 0);
  }, [holidays, seats, isMember]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lineItems = holidays
      .map((h) => ({
        holidaySlug: h.slug,
        menSeats: seats[h.slug]?.menSeats ?? 0,
        womenSeats: seats[h.slug]?.womenSeats ?? 0,
      }))
      .filter((item) => item.menSeats + item.womenSeats > 0);

    if (lineItems.length === 0) {
      setError(t("atLeastOneSeat"));
      return;
    }

    startTransition(async () => {
      const result = await createBill({
        fullName,
        phone,
        email,
        isMember,
        notes,
        lineItems,
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

      const breakdown = holidays
        .filter((h) => (seats[h.slug]?.menSeats ?? 0) + (seats[h.slug]?.womenSeats ?? 0) > 0)
        .map((h) => {
          const count = seats[h.slug]!;
          const perSeat = isMember ? h.memberPriceAgorot : h.nonMemberPriceAgorot;
          return {
            name: locale === "he" ? h.nameHe : h.nameEn,
            menSeats: count.menSeats,
            womenSeats: count.womenSeats,
            lineTotalAgorot: perSeat * (count.menSeats + count.womenSeats),
          };
        });

      setSuccess({
        billId: result.billId,
        totalAgorot: result.totalAgorot,
        paymentLink: result.paymentLink,
        breakdown,
      });
    });
  }

  if (success) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          {t("statusLabel")}: {t("statusPending")}
        </span>
        <h2 className="mt-4 font-serif text-2xl font-semibold text-ink">{t("successHeading")}</h2>
        <p className="mt-2 text-ink/70">{t("successBody")}</p>

        <div className="mx-auto mt-5 max-w-sm rounded-md border border-line bg-pale p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
            {t("breakdownHeading")}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink/80">
            {success.breakdown.map((line) => (
              <li key={line.name} className="flex items-center justify-between gap-4">
                <span>
                  {line.name} ({line.menSeats + line.womenSeats})
                </span>
                <span className="font-medium">{formatIls(line.lineTotalAgorot, locale)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-sm text-ink/50">
          {t("billIdLabel")}: <span className="font-mono">BILL-{success.billId}</span>
        </p>
        <p className="mt-1 font-serif text-3xl font-bold text-ink">
          {formatIls(success.totalAgorot, locale)}
        </p>

        <p className="mx-auto mt-5 max-w-md rounded-md bg-amber-50 p-4 text-sm text-amber-900">
          {t("notConfirmedNote")}
        </p>

        <div className="mt-6">
          {success.paymentLink ? (
            <a
              href={success.paymentLink}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent"
            >
              {t("payNow")}
            </a>
          ) : (
            <p className="rounded-md bg-pale p-4 text-sm text-ink/70">
              {t("paymentNotConfigured")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 rounded-xl border border-line bg-white p-8">
      <p className="text-ink/70">{t("formIntro")}</p>

      <div>
        <span className="mb-2 block text-sm font-medium text-ink">{t("membership")}</span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsMember(true)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              isMember ? "border-accent bg-accent/10 text-ink" : "border-line text-ink/70"
            }`}
          >
            {t("member")}
          </button>
          <button
            type="button"
            onClick={() => setIsMember(false)}
            className={`rounded-md border px-4 py-2 text-sm font-medium ${
              !isMember ? "border-accent bg-accent/10 text-ink" : "border-line text-ink/70"
            }`}
          >
            {t("nonMember")}
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-lg font-semibold text-ink">{t("holidaysSectionHeading")}</h2>
        <div className="mt-4 space-y-4">
          {holidays.map((holiday) => {
            const count = seats[holiday.slug] ?? { menSeats: 0, womenSeats: 0 };
            const isHighlighted = holiday.slug === highlightSlug;
            return (
              <div
                key={holiday.slug}
                id={`holiday-${holiday.slug}`}
                className={`rounded-lg border p-4 ${
                  isHighlighted ? "border-accent bg-accent/5" : "border-line"
                }`}
              >
                <h3 className="font-serif text-base font-semibold text-ink">
                  {locale === "he" ? holiday.nameHe : holiday.nameEn}
                </h3>
                {(locale === "he" ? holiday.descriptionHe : holiday.descriptionEn) && (
                  <p className="mt-1 text-sm text-ink/60">
                    {locale === "he" ? holiday.descriptionHe : holiday.descriptionEn}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink/60">
                  <span>{t("perSeatMember", { price: agorotToShekels(holiday.memberPriceAgorot) })}</span>
                  <span>
                    {t("perSeatNonMember", { price: agorotToShekels(holiday.nonMemberPriceAgorot) })}
                  </span>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Stepper
                    label={t("menSeats")}
                    value={count.menSeats}
                    onChange={(v) => updateSeats(holiday.slug, { menSeats: v })}
                  />
                  <Stepper
                    label={t("womenSeats")}
                    value={count.womenSeats}
                    onChange={(v) => updateSeats(holiday.slug, { womenSeats: v })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-serif text-lg font-semibold text-ink">{t("contactSectionHeading")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">{t("fullName")}</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">{t("phone")}</label>
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-ink">{t("email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink">{t("notes")}</label>
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
          <p className="font-serif text-2xl font-bold text-ink">{formatIls(totalAgorot, locale)}</p>
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? t("submitting") : t("submit")}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
