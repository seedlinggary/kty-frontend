"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsFormState } from "@/lib/actions/settings";
import type { SiteSettingsData } from "@/lib/settings";

export function SettingsForm({ settings }: { settings: SiteSettingsData }) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateSettings,
    undefined
  );

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-navy">Hero Tagline</h2>
        <p className="mt-1 text-sm text-ink/50">Shown under the shul name on the homepage.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">English</label>
            <textarea
              name="heroTaglineEn"
              rows={2}
              defaultValue={settings.heroTaglineEn}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Hebrew</label>
            <textarea
              name="heroTaglineHe"
              dir="rtl"
              rows={2}
              defaultValue={settings.heroTaglineHe}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-navy">About</h2>
        <p className="mt-1 text-sm text-ink/50">Shown on the Home and About pages.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">English</label>
            <textarea
              name="aboutEn"
              rows={6}
              required
              defaultValue={settings.aboutEn}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Hebrew</label>
            <textarea
              name="aboutHe"
              dir="rtl"
              rows={6}
              required
              defaultValue={settings.aboutHe}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-navy">Contact & Location</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-navy">Address</label>
            <input
              name="address"
              required
              defaultValue={settings.address}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Phone</label>
            <input
              name="contactPhone"
              defaultValue={settings.contactPhone}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Email</label>
            <input
              name="contactEmail"
              type="email"
              defaultValue={settings.contactEmail}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-navy">Davening Times</h2>
        <p className="mt-1 text-sm text-ink/50">
          Optional — leave blank to hide this section on the homepage.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">English</label>
            <textarea
              name="serviceTimesEn"
              rows={4}
              defaultValue={settings.serviceTimesEn ?? ""}
              placeholder={"Shacharis: 7:00am\nMincha/Maariv: See calendar"}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-navy">Hebrew</label>
            <textarea
              name="serviceTimesHe"
              dir="rtl"
              rows={4}
              defaultValue={settings.serviceTimesHe ?? ""}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
        </div>
      </section>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">Settings saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-navy px-6 py-2.5 text-sm font-semibold text-cream hover:bg-navy-light disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
