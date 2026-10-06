import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { agorotToShekels } from "@/lib/money";

const COLUMNS: CsvColumn[] = [
  { key: "reference", label: "Reference" },
  { key: "label", label: "Label" },
  { key: "fullName", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "amountILS", label: "Amount (ILS)" },
  { key: "status", label: "Status" },
  { key: "family", label: "Linked Family" },
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Created" },
];

export async function GET() {
  const links = await prisma.paymentLink.findMany({
    include: { family: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = links.map((l) => ({
    reference: `LINK-${l.referenceCode}`,
    label: l.label,
    fullName: l.fullName ?? "",
    email: l.email ?? "",
    phone: l.phone ?? "",
    amountILS: agorotToShekels(l.amountAgorot),
    status: l.status,
    family: l.family?.fullName ?? "",
    createdBy: l.createdBy,
    createdAt: l.createdAt.toISOString(),
  }));

  const csv = toCsv(COLUMNS, rows);
  const filename = `payment-links-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
