import type { Metadata } from "next";
import { FormBuilder } from "@/components/admin/form-builder";

export const metadata: Metadata = { title: "New Form" };

export default function NewFormPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">New Form</h1>
      <p className="mt-1 text-sm text-ink/60">
        Build the form, then save it as a draft (unchecked &quot;Open&quot;) until it&apos;s
        ready to send out.
      </p>
      <div className="mt-6">
        <FormBuilder />
      </div>
    </div>
  );
}
