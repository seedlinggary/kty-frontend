import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Site Settings" };

export default async function SettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-navy">Site Settings</h1>
      <p className="mt-1 text-sm text-ink/60">
        Edit public site content. Changes go live immediately, no deploy needed.
      </p>
      <div className="mt-6">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
