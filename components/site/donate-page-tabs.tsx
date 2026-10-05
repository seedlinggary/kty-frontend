"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DonationForm } from "@/components/site/donation-form";
import { MembershipForm } from "@/components/site/membership-form";

export function DonatePageTabs({ locale }: { locale: "en" | "he" }) {
  const t = useTranslations("donate");
  const [tab, setTab] = useState<"donation" | "membership">("donation");

  return (
    <div>
      <div className="mb-6 flex gap-2 rounded-lg border border-line bg-pale p-1">
        <button
          type="button"
          onClick={() => setTab("donation")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "donation" ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
          }`}
        >
          {t("tabDonation")}
        </button>
        <button
          type="button"
          onClick={() => setTab("membership")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "membership" ? "bg-white text-ink shadow-sm" : "text-ink/60 hover:text-ink"
          }`}
        >
          {t("tabMembership")}
        </button>
      </div>

      {tab === "donation" ? <DonationForm locale={locale} /> : <MembershipForm locale={locale} />}
    </div>
  );
}
