"use client";

import { useState, useTransition } from "react";
import { getFieldOptions, isAnswerEmpty } from "@/lib/forms";
import type { FormFieldType } from "@/lib/generated/prisma/client";

export type RenderableField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options: unknown;
  helpText: string | null;
};

type NameDateEntry = { name: string; date: string };

type SubmitResult = { ok: true } | { ok: false; error: string };

type Props = {
  fields: RenderableField[];
  initialAnswers?: Record<string, unknown>;
  onSubmit: (answers: Record<string, unknown>) => Promise<SubmitResult>;
  onSuccess?: () => void;
  submitLabel: string;
  submittingLabel?: string;
};

const inputClass = "w-full rounded-md border border-line px-3 py-2";

function TextList({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const rows = value.length > 0 ? value : [""];
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={row}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...rows];
              next[i] = e.target.value;
              onChange(next);
            }}
            className={inputClass}
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              className="shrink-0 rounded-md border border-line px-3 py-2 text-sm text-ink/60 hover:bg-pale"
              aria-label="Remove"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, ""])}
        className="text-sm font-medium text-accent hover:underline"
      >
        + Add another
      </button>
    </div>
  );
}

function NameDateList({
  value,
  onChange,
}: {
  value: NameDateEntry[];
  onChange: (v: NameDateEntry[]) => void;
}) {
  const rows = value.length > 0 ? value : [{ name: "", date: "" }];
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={row.name}
            placeholder="Name"
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
            className={inputClass}
          />
          <input
            type="date"
            value={row.date}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...next[i], date: e.target.value };
              onChange(next);
            }}
            className={`${inputClass} max-w-[180px]`}
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              className="shrink-0 rounded-md border border-line px-3 py-2 text-sm text-ink/60 hover:bg-pale"
              aria-label="Remove"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { name: "", date: "" }])}
        className="text-sm font-medium text-accent hover:underline"
      >
        + Add another
      </button>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: RenderableField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const options = getFieldOptions(field.options);

  switch (field.type) {
    case "LONG_TEXT":
      return (
        <textarea
          rows={4}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "EMAIL":
      return (
        <input
          type="email"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "PHONE":
      return (
        <input
          type="tel"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "NUMBER":
      return (
        <input
          type="number"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "DATE":
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case "SINGLE_CHOICE":
      return (
        <div className="space-y-1.5">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                checked={value === option}
                onChange={() => onChange(option)}
                className="h-4 w-4 border-line"
              />
              {option}
            </label>
          ))}
        </div>
      );
    case "MULTI_CHOICE": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1.5">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...selected, option] : selected.filter((o) => o !== option)
                  )
                }
                className="h-4 w-4 rounded border-line"
              />
              {option}
            </label>
          ))}
        </div>
      );
    }
    case "MULTI_TEXT":
      return (
        <TextList value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
      );
    case "NAME_DATE_LIST":
      return (
        <NameDateList
          value={Array.isArray(value) ? (value as NameDateEntry[]) : []}
          onChange={onChange}
        />
      );
    case "SHORT_TEXT":
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
  }
}

export function DynamicFormRenderer({
  fields,
  initialAnswers,
  onSubmit,
  onSuccess,
  submitLabel,
  submittingLabel = "Submitting...",
}: Props) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers ?? {});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const field of fields) {
      if (field.required && isAnswerEmpty(answers[field.id])) {
        setError(`"${field.label}" is required.`);
        return;
      }
    }

    startTransition(async () => {
      const result = await onSubmit(answers);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {fields.map((field) => (
        <div key={field.id}>
          <label className="mb-1 block text-sm font-medium text-ink">
            {field.label}
            {field.required && <span className="text-red-600"> *</span>}
          </label>
          {field.helpText && <p className="mb-1.5 text-xs text-ink/50">{field.helpText}</p>}
          <FieldInput
            field={field}
            value={answers[field.id]}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [field.id]: v }))}
          />
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-ink px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent disabled:opacity-50"
      >
        {isPending ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
