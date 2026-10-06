import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { agorotToShekels } from "@/lib/money";

const COLUMNS: CsvColumn[] = [
  { key: "clientName", label: "Client Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "groupe", label: "Category" },
  { key: "amountILS", label: "Amount (ILS)" },
  { key: "confirmation", label: "Confirmation #" },
  { key: "kevaId", label: "Keva ID" },
  { key: "comments", label: "Comments" },
  { key: "family", label: "Linked Family" },
  { key: "receivedAt", label: "Received" },
];

export async function GET() {
  const transactions = await prisma.externalTransaction.findMany({
    include: { family: { select: { fullName: true } } },
    orderBy: { receivedAt: "desc" },
  });

  const rows = transactions.map((t) => ({
    clientName: t.clientName ?? "",
    email: t.email ?? "",
    phone: t.phone ?? "",
    groupe: t.groupe ?? "",
    amountILS: agorotToShekels(t.amountAgorot),
    confirmation: t.confirmation ?? "",
    kevaId: t.kevaId ?? "",
    comments: t.comments ?? "",
    family: t.family?.fullName ?? "",
    receivedAt: t.receivedAt.toISOString(),
  }));

  const csv = toCsv(COLUMNS, rows);
  const filename = `other-transactions-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
