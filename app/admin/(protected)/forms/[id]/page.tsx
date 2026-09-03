import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FormBuilder } from "@/components/admin/form-builder";
import { CopyLinkButton } from "@/components/admin/copy-link-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const form = await prisma.form.findUnique({ where: { id } });
  return { title: form?.title ?? "Form" };
}

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      fields: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      _count: { select: { responses: { where: { deletedAt: null } } } },
    },
  });
  if (!form) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const publicLink = `${siteUrl}/forms/${form.slug}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">{form.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink/60">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                form.isOpen ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
              }`}
            >
              {form.isOpen ? "Open" : "Draft"}
            </span>
            <a href={publicLink} target="_blank" rel="noreferrer" className="hover:underline">
              {publicLink}
            </a>
            <CopyLinkButton link={publicLink} label="Copy Form Link" />
          </div>
        </div>
        <Link
          href={`/admin/forms/${form.id}/responses`}
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
        >
          View Responses ({form._count.responses})
        </Link>
      </div>

      <div className="mt-6">
        <FormBuilder
          formId={form.id}
          initial={{
            title: form.title,
            slug: form.slug,
            description: form.description ?? "",
            thankYouMessage: form.thankYouMessage ?? "",
            isOpen: form.isOpen,
            fields: form.fields.map((f) => ({
              id: f.id,
              label: f.label,
              type: f.type,
              required: f.required,
              options: Array.isArray(f.options) ? (f.options as string[]) : [],
              helpText: f.helpText ?? "",
              // Persisted fields' key is their id (see FormBuilder), so referencing
              // another field's id here as conditionKey resolves correctly on save.
              conditionKey: f.conditionFieldId,
              conditionValue: f.conditionValue,
              conditionMode: f.conditionMode,
              altLabel: f.altLabel,
            })),
          }}
        />
      </div>
    </div>
  );
}
