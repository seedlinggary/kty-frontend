import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { SortHeader } from "@/components/admin/sort-header";
import { deleteFormResponseAction } from "@/lib/actions/form-responses";
import { formatAnswerForDisplay, answerMatchesSearch, getFieldOptions, isChoiceType } from "@/lib/forms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const form = await prisma.form.findUnique({ where: { id } });
  return { title: form ? `Responses — ${form.title}` : "Responses" };
}

type SearchParams = Record<string, string | undefined>;

function buildHref(id: string, params: SearchParams, overrides: SearchParams) {
  const merged = { ...params, ...overrides };
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) usp.set(key, value);
  }
  const qs = usp.toString();
  return `/admin/forms/${id}/responses${qs ? `?${qs}` : ""}`;
}

export default async function FormResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const sortKey = sp.sort ?? "date";
  const dir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";

  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      fields: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      responses: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!form) notFound();

  const choiceFields = form.fields.filter((f) => isChoiceType(f.type));
  const activeFilters = choiceFields
    .map((f) => ({ field: f, value: sp[`filter_${f.id}`] }))
    .filter((f) => f.value);

  let responses = form.responses;

  if (q) {
    responses = responses.filter((r) =>
      form.fields.some((f) => answerMatchesSearch(f.type, (r.answers as Record<string, unknown>)[f.id], q))
    );
  }
  for (const { field, value } of activeFilters) {
    responses = responses.filter((r) => {
      const answer = (r.answers as Record<string, unknown>)[field.id];
      if (field.type === "MULTI_CHOICE") {
        return Array.isArray(answer) && (answer as string[]).includes(value!);
      }
      return answer === value;
    });
  }

  const direction = dir === "asc" ? 1 : -1;
  const sortField = form.fields.find((f) => f.id === sortKey);
  const sorted = [...responses].sort((a, b) => {
    if (sortKey === "date" || !sortField) {
      return direction * (a.createdAt.getTime() - b.createdAt.getTime());
    }
    const aAnswers = a.answers as Record<string, unknown>;
    const bAnswers = b.answers as Record<string, unknown>;
    if (sortField.type === "NUMBER") {
      const aNum = Number(aAnswers[sortField.id]) || 0;
      const bNum = Number(bAnswers[sortField.id]) || 0;
      return direction * (aNum - bNum);
    }
    const aText = formatAnswerForDisplay(sortField.type, aAnswers[sortField.id]);
    const bText = formatAnswerForDisplay(sortField.type, bAnswers[sortField.id]);
    return direction * aText.localeCompare(bText);
  });

  const isFiltered = Boolean(q) || activeFilters.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">
            Responses — {form.title}
          </h1>
          <p className="text-sm text-ink/50">
            {sorted.length} shown{isFiltered ? " (filtered)" : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href={`/admin/forms/${form.id}/responses/export`}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale"
          >
            Export CSV
          </a>
          <Link
            href={`/admin/forms/${form.id}`}
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
          >
            Back to Form
          </Link>
        </div>
      </div>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4"
      >
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={dir} />
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search any answer"
            className="w-56 rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
        {choiceFields.map((field) => (
          <div key={field.id}>
            <label className="mb-1 block max-w-[10rem] truncate text-xs font-medium text-ink/60">
              {field.label}
            </label>
            <select
              name={`filter_${field.id}`}
              defaultValue={sp[`filter_${field.id}`] ?? ""}
              className="rounded-md border border-line px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {getFieldOptions(field.options).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
        >
          Apply
        </button>
        {isFiltered && (
          <Link
            href={`/admin/forms/${form.id}/responses`}
            className="text-sm font-medium text-ink/60 hover:text-ink hover:underline"
          >
            Clear filters
          </Link>
        )}
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">
                <SortHeader
                  href={buildHref(form.id, sp, { sort: "date", dir: sortKey === "date" && dir === "asc" ? "desc" : "asc" })}
                  isActive={sortKey === "date"}
                  dir={dir}
                >
                  Submitted
                </SortHeader>
              </th>
              {form.fields.map((field) => (
                <th key={field.id} className="px-4 py-3">
                  <SortHeader
                    href={buildHref(form.id, sp, {
                      sort: field.id,
                      dir: sortKey === field.id && dir === "asc" ? "desc" : "asc",
                    })}
                    isActive={sortKey === field.id}
                    dir={dir}
                  >
                    {field.label}
                  </SortHeader>
                </th>
              ))}
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((response) => {
              const answers = response.answers as Record<string, unknown>;
              return (
                <tr key={response.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink/60">
                    {response.createdAt.toLocaleDateString()}
                  </td>
                  {form.fields.map((field) => (
                    <td key={field.id} className="max-w-[16rem] px-4 py-3 text-ink/80">
                      {formatAnswerForDisplay(field.type, answers[field.id]) || (
                        <span className="text-ink/30">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/admin/forms/${form.id}/responses/${response.id}/edit`}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Edit
                      </Link>
                      <form action={deleteFormResponseAction}>
                        <input type="hidden" name="responseId" value={response.id} />
                        <ConfirmSubmitButton
                          confirmMessage="Delete this response? It will be removed from totals and CSV exports."
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={form.fields.length + 2} className="px-4 py-8 text-center text-ink/50">
                  {isFiltered ? "No responses match these filters." : "No responses yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
