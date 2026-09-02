import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PublicForm } from "@/components/forms/public-form";
import { getFormBySlug } from "@/lib/forms-server";

// Always check the live open/draft state - never statically cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const form = await getFormBySlug(slug);
  return { title: form?.title ?? "Form" };
}

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const form = await getFormBySlug(slug);

  if (!form || !form.isOpen) {
    return (
      <Container className="flex flex-col items-center py-24 text-center">
        <h1 className="font-serif text-2xl font-bold text-ink">This form isn&apos;t available</h1>
        <p className="mt-3 max-w-md text-ink/70">
          This link may be incomplete, or the form hasn&apos;t been published yet. Please check
          back later or contact the shul office.
        </p>
      </Container>
    );
  }

  return (
    <Container className="max-w-2xl py-16">
      <PublicForm
        formId={form.id}
        title={form.title}
        description={form.description}
        thankYouMessage={form.thankYouMessage}
        fields={form.fields}
      />
    </Container>
  );
}
