import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { agorotToShekels } from "@/lib/money";

const COLUMNS: CsvColumn[] = [
  { key: "reference", label: "Reference" },
  { key: "fullName", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "tier", label: "Tier" },
  { key: "monthlyILS", label: "Monthly Amount (ILS)" },
  { key: "rateEstimated", label: "Rate Unconfirmed" },
  { key: "status", label: "Status" },
  { key: "nextChargeDate", label: "Next Charge" },
  { key: "lastChargeAt", label: "Last Charge" },
  { key: "family", label: "Linked Family" },
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Signed Up" },
];

export async function GET() {
  const memberships = await prisma.membership.findMany({
    include: { family: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = memberships.map((m) => ({
    reference: `MEM-${m.referenceCode}`,
    fullName: m.fullName,
    email: m.email,
    phone: m.phone ?? "",
    address: m.address ?? "",
    city: m.city ?? "",
    tier: m.tier,
    monthlyILS: agorotToShekels(m.monthlyAgorot),
    rateEstimated: m.monthlyAgorotIsEstimated ? "Yes" : "",
    status: m.status,
    nextChargeDate: m.nextChargeDate?.toISOString() ?? "",
    lastChargeAt: m.lastChargeAt?.toISOString() ?? "",
    family: m.family?.fullName ?? "",
    createdBy: m.createdBy,
    createdAt: m.createdAt.toISOString(),
  }));

  const csv = toCsv(COLUMNS, rows);
  const filename = `memberships-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
