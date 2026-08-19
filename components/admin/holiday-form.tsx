"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/actions/holidays";
import { slugify } from "@/lib/slug";

type DefaultValues = {
  nameEn: string;
  nameHe: string;
  descriptionEn: string;
  descriptionHe: string;
  memberPrice: number;
  nonMemberPrice: number;
  isOpen: boolean;
  slug: string;
};

export function HolidayForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: DefaultValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [slug, setSlug] = useState(defaultValues?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultValues?.slug));

  return (
    <form action={formAction} className="max-w-2xl space-y-6 rounded-xl border border-line bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Name (English)</label>
          <input
            name="nameEn"
            required
            defaultValue={defaultValues?.nameEn}
            onChange={(e) => {
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Name (Hebrew)</label>
          <input
            name="nameHe"
            dir="rtl"
            required
            defaultValue={defaultValues?.nameHe}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-navy">URL Slug</label>
        <input
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlug(slugify(e.target.value));
            setSlugTouched(true);
          }}
          className="w-full rounded-md border border-line px-3 py-2 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-ink/50">Public URL: /seats/{slug || "..."}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Description (English)</label>
          <textarea
            name="descriptionEn"
            rows={3}
            defaultValue={defaultValues?.descriptionEn}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Description (Hebrew)</label>
          <textarea
            name="descriptionHe"
            dir="rtl"
            rows={3}
            defaultValue={defaultValues?.descriptionHe}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Member Price (₪ / seat)</label>
          <input
            name="memberPrice"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={defaultValues?.memberPrice ?? 100}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-navy">Non-Member Price (₪ / seat)</label>
          <input
            name="nonMemberPrice"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={defaultValues?.nonMemberPrice ?? 200}
            className="w-full rounded-md border border-line px-3 py-2"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-navy">
        <input
          type="checkbox"
          name="isOpen"
          defaultChecked={defaultValues?.isOpen ?? true}
          className="h-4 w-4 rounded border-line"
        />
        Open for public sign-up
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-cream hover:bg-navy-light disabled:opacity-50"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
