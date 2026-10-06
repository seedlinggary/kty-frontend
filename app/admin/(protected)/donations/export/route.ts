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
  { key: "purpose", label: "Purpose" },
  { key: "amountILS", label: "Amount (ILS)" },
  { key: "status", label: "Status" },
  { key: "user", label: "Linked User" },
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Submitted" },
];

export async function GET() {
  const donations = await prisma.donation.findMany({
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = donations.map((d) => ({
    reference: `DON-${d.referenceCode}`,
    fullName: d.fullName,
    email: d.email,
    phone: d.phone ?? "",
    address: d.address ?? "",
    city: d.city ?? "",
    purpose: d.purpose ?? "",
    amountILS: agorotToShekels(d.amountAgorot),
    status: d.status,
    user: d.user?.fullName ?? "",
    createdBy: d.createdBy,
    createdAt: d.createdAt.toISOString(),
  }));

  const csv = toCsv(COLUMNS, rows);
  const filename = `donations-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
