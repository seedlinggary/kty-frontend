"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveForm, type FieldDraft as SavedFieldDraft } from "@/lib/actions/forms";
import { slugify } from "@/lib/slug";
import { FORM_FIELD_TYPE_LABELS, FORM_FIELD_TYPES, isChoiceType } from "@/lib/forms";
import type { FormFieldType } from "@/lib/generated/prisma/client";

type FieldDraft = {
  key: string;
  id?: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options: string[];
  helpText: string;
};

type Props = {
  formId?: string;
  initial?: {
    title: string;
    slug: string;
    description: string;
    thankYouMessage: string;
    isOpen: boolean;
    fields: Omit<FieldDraft, "key">[];
  };
};

function newField(): FieldDraft {
  return {
    key: crypto.randomUUID(),
    label: "",
    type: "SHORT_TEXT",
    required: false,
    options: [],
    helpText: "",
  };
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (v: string[]) => void;
}) {
  const rows = options.length > 0 ? options : [""];
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs font-medium text-ink/60">Options</p>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={row}
            onChange={(e) => {
              const next = [...rows];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="w-full rounded-md border border-line px-2 py-1.5 text-sm"
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              className="shrink-0 text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, ""])}
        className="text-xs font-medium text-accent hover:underline"
      >
        + Add option
      </button>
    </div>
  );
}

export function FormBuilder({ formId, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [thankYouMessage, setThankYouMessage] = useState(initial?.thankYouMessage ?? "");
  const [isOpen, setIsOpen] = useState(initial?.isOpen ?? false);
  const [fields, setFields] = useState<FieldDraft[]>(
    initial?.fields.length
      ? initial.fields.map((f) => ({ ...f, key: f.id ?? crypto.randomUUID() }))
      : [newField()]
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField(key: string, patch: Partial<FieldDraft>) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const payload: SavedFieldDraft[] = fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.options,
        helpText: f.helpText,
      }));

      const result = await saveForm({
        id: formId,
        title,
        slug,
        description,
        thankYouMessage,
        isOpen,
        fields: payload,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/admin/forms/${result.formId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Form Details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Title</label>
            <input
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">URL Slug</label>
            <input
              required
              value={slug}
              onChange={(e) => {
                setSlug(slugify(e.target.value));
                setSlugTouched(true);
              }}
              className="w-full rounded-md border border-line px-3 py-2 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-ink/50">
              Link: /forms/{slug || "..."} — never listed anywhere, only reachable by sharing this
              directly.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Intro (shown above the questions)
            </label>
            <textarea
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Thank-you message (shown after submitting)
            </label>
            <textarea
              rows={3}
              value={thankYouMessage}
              onChange={(e) => setThankYouMessage(e.target.value)}
              placeholder="Thank you for your response — it has been received."
              className="w-full rounded-md border border-line px-3 py-2"
            />
          </div>
          <label className="flex items-start gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(e) => setIsOpen(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line"
            />
            <span>
              Open — the direct link works and accepts responses.
              <span className="block font-normal text-ink/50">
                Leave unchecked while drafting: even someone with the link sees &quot;not
                available&quot; until you check this.
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Questions</h2>
        <div className="mt-4 space-y-4">
          {fields.map((field, index) => (
            <div key={field.key} className="rounded-lg border border-line p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Question label"
                    value={field.label}
                    onChange={(e) => updateField(field.key, { label: e.target.value })}
                    className="w-full rounded-md border border-line px-3 py-2 font-medium"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateField(field.key, { type: e.target.value as FormFieldType })
                      }
                      className="rounded-md border border-line px-3 py-2 text-sm"
                    >
                      {FORM_FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {FORM_FIELD_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(field.key, { required: e.target.checked })}
                        className="h-4 w-4 rounded border-line"
                      />
                      Required
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="Help text (optional)"
                    value={field.helpText}
                    onChange={(e) => updateField(field.key, { helpText: e.target.value })}
                    className="w-full rounded-md border border-line px-3 py-2 text-sm"
                  />
                  {isChoiceType(field.type) && (
                    <OptionsEditor
                      options={field.options}
                      onChange={(options) => updateField(field.key, { options })}
                    />
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => moveField(index, -1)}
                    disabled={index === 0}
                    className="rounded border border-line px-2 py-1 text-xs text-ink/60 hover:bg-pale disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(index, 1)}
                    disabled={index === fields.length - 1}
                    className="rounded border border-line px-2 py-1 text-xs text-ink/60 hover:bg-pale disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setFields((prev) => prev.filter((f) => f.key !== field.key))}
                    disabled={fields.length === 1}
                    className="rounded border border-line px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-30"
                    aria-label="Remove field"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setFields((prev) => [...prev, newField()])}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale"
          >
            + Add Question
          </button>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-ink px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save Form"}
      </button>
    </form>
  );
}
