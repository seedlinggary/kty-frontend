"use client";

import { useState } from "react";
import { submitFormResponse } from "@/lib/actions/form-responses";
import { DynamicFormRenderer, type RenderableField } from "@/components/forms/dynamic-form-renderer";

type Props = {
  formId: string;
  title: string;
  description: string | null;
  thankYouMessage: string | null;
  fields: RenderableField[];
};

export function PublicForm({ formId, title, description, thankYouMessage, fields }: Props) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center">
        <h1 className="font-serif text-2xl font-bold text-ink">Thank You</h1>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-ink/80">
          {thankYouMessage || "Thank you for your response — it has been received."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-ink">{title}</h1>
      {description && (
        <p className="mt-4 whitespace-pre-line leading-relaxed text-ink/80">{description}</p>
      )}
      <div className="mt-8 rounded-xl border border-line bg-white p-8">
        <DynamicFormRenderer
          fields={fields}
          onSubmit={(answers) => submitFormResponse({ formId, answers })}
          onSuccess={() => setSubmitted(true)}
          submitLabel="Submit"
        />
      </div>
    </div>
  );
}
