import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { formatAnswerForDisplay } from "@/lib/forms";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const form = await prisma.form.findUnique({
    where: { id },
    include: {
      fields: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      responses: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const columns: CsvColumn[] = [
    { key: "submittedAt", label: "Submitted" },
    ...form.fields.map((f) => ({ key: f.id, label: f.label })),
  ];

  const rows = form.responses.map((response) => {
    const answers = response.answers as Record<string, unknown>;
    const row: Record<string, string> = {
      submittedAt: response.createdAt.toISOString(),
    };
    for (const field of form.fields) {
      row[field.id] = formatAnswerForDisplay(field.type, answers[field.id]);
    }
    return row;
  });

  const csv = toCsv(columns, rows);
  const filename = `${form.slug}-responses-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
