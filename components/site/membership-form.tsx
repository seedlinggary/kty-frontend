"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createMembership } from "@/lib/actions/memberships";
import { agorotToShekels } from "@/lib/money";
import { Button } from "@/components/ui/button";
import type { MembershipTier } from "@/lib/generated/prisma/client";

function formatIls(agorot: number, locale: "en" | "he") {
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
  }).format(agorotToShekels(agorot));
}

export function MembershipForm({ locale }: { locale: "en" | "he" }) {
  const t = useTranslations("membership");
  const [tier, setTier] = useState<MembershipTier | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ membershipId: string; monthlyAgorot: number; paymentLink: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!tier) {
      setError(t("selectTier"));
      return;
    }
    if (!fullName.trim() || !email.trim()) {
      setError(t("missingFields"));
      return;
    }

    startTransition(async () => {
      const result = await createMembership({ fullName, email, phone, address, city, tier, locale, createdBy: "public" });
      if (!result.ok) {
        setError(t("missingFields"));
        return;
      }
      setSuccess(result);
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
        <p className="mt-4 font-serif text-3xl font-bold text-ink">{formatIls(success.monthlyAgorot, locale)} / mo</p>
        <p className="mt-1 text-sm text-ink/50">
          {t("referenceLabel")}: <span className="font-mono">MEM-{success.membershipId}</span>
        </p>
        <p className="mx-auto mt-5 max-w-md rounded-md bg-amber-50 p-4 text-sm text-amber-900">{t("notConfirmedNote")}</p>
        <div className="mt-6">
          {success.paymentLink ? (
            <a href={success.paymentLink} className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-accent">
              {t("payNow")}
            </a>
          ) : (
            <p className="rounded-md bg-pale p-4 text-sm text-ink/70">{t("paymentNotConfigured")}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-line bg-white p-8">
      <p className="text-ink/70">{t("formIntro")}</p>

      <div>
        <h2 className="font-serif text-lg font-semibold text-ink">{t("tierHeading")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTier("ASSOCIATE")}
            className={`rounded-lg border p-4 text-left ${tier === "ASSOCIATE" ? "border-accent bg-accent/5" : "border-line"}`}
          >
            <p className="font-serif text-base font-semibold text-ink">{t("associateLabel")}</p>
            <p className="mt-1 text-sm text-ink/60">{t("associatePrice")}</p>
          </button>
          <button
            type="button"
            onClick={() => setTier("FULL")}
            className={`rounded-lg border p-4 text-left ${tier === "FULL" ? "border-accent bg-accent/5" : "border-line"}`}
          >
            <p className="font-serif text-base font-semibold text-ink">{t("fullLabel")}</p>
            <p className="mt-1 text-sm text-ink/60">{t("fullPrice")}</p>
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">{t("fullName")}</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">{t("email")}</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">{t("phone")}</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">{t("address")}</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">{t("city")}</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-md border border-line px-3 py-2" />
        </div>
      </div>

      <div className="flex justify-end border-t border-line pt-6">
        <Button type="submit" disabled={isPending}>
          {isPending ? t("submitting") : t("submit")}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
