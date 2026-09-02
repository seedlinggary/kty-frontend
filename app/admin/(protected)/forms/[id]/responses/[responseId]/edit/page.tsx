import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditResponseForm } from "@/components/admin/edit-response-form";

export const metadata: Metadata = { title: "Edit Response" };

export default async function EditResponsePage({
  params,
}: {
  params: Promise<{ id: string; responseId: string }>;
}) {
  const { id, responseId } = await params;

  const response = await prisma.formResponse.findUnique({
    where: { id: responseId },
    include: { form: { include: { fields: { where: { archivedAt: null }, orderBy: { order: "asc" } } } } },
  });
  if (!response || response.formId !== id) notFound();

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">
        Edit Response — {response.form.title}
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Submitted {response.createdAt.toLocaleString()}
      </p>
      <div className="mt-6 max-w-2xl rounded-xl border border-line bg-white p-6">
        <EditResponseForm
          formId={id}
          responseId={response.id}
          fields={response.form.fields}
          initialAnswers={response.answers as Record<string, unknown>}
        />
      </div>
    </div>
  );
}
