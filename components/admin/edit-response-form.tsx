"use client";

import { useRouter } from "next/navigation";
import { updateFormResponse } from "@/lib/actions/form-responses";
import { DynamicFormRenderer, type RenderableField } from "@/components/forms/dynamic-form-renderer";

type Props = {
  formId: string;
  responseId: string;
  fields: RenderableField[];
  initialAnswers: Record<string, unknown>;
};

export function EditResponseForm({ formId, responseId, fields, initialAnswers }: Props) {
  const router = useRouter();

  return (
    <DynamicFormRenderer
      fields={fields}
      initialAnswers={initialAnswers}
      onSubmit={(answers) => updateFormResponse(responseId, answers)}
      onSuccess={() => {
        router.push(`/admin/forms/${formId}/responses`);
        router.refresh();
      }}
      submitLabel="Save Changes"
      submittingLabel="Saving..."
    />
  );
}
