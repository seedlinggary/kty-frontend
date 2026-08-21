import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { agorotToShekels } from "@/lib/money";

const COLUMNS: CsvColumn[] = [
  { key: "billId", label: "Bill ID" },
  { key: "fullName", label: "Full Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "membership", label: "Membership" },
  { key: "menSeats", label: "Men's Seats" },
  { key: "womenSeats", label: "Women's Seats" },
  { key: "totalSeats", label: "Total Seats" },
  { key: "lineTotalILS", label: "Line Total (ILS)" },
  { key: "billTotalILS", label: "Bill Total (ILS)" },
  { key: "otherHolidays", label: "Also Includes" },
  { key: "status", label: "Status" },
  { key: "confirmation", label: "Confirmation #" },
  { key: "notes", label: "Notes" },
  { key: "createdBy", label: "Created By" },
  { key: "submittedAt", label: "Submitted" },
];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const holiday = await prisma.holiday.findUnique({
    where: { id },
    include: {
      signups: {
        orderBy: { createdAt: "asc" },
        include: {
          bill: {
            include: {
              transactions: { orderBy: { receivedAt: "desc" }, take: 1 },
              lineItems: { include: { holiday: true } },
            },
          },
        },
      },
    },
  });

  if (!holiday) {
    return NextResponse.json({ error: "Holiday not found" }, { status: 404 });
  }

  const rows = holiday.signups.map((s) => {
    const bill = s.bill;
    const otherHolidays = bill.lineItems
      .filter((item) => item.holidayId !== holiday.id)
      .map((item) => item.holiday.nameEn)
      .join(", ");

    return {
      billId: `BILL-${bill.referenceCode}`,
      fullName: bill.fullName,
      phone: bill.phone,
      email: bill.email ?? "",
      membership: bill.isMember ? "Member" : "Non-Member",
      menSeats: s.menSeats,
      womenSeats: s.womenSeats,
      totalSeats: s.menSeats + s.womenSeats,
      lineTotalILS: agorotToShekels(s.totalAgorot),
      billTotalILS: agorotToShekels(bill.totalAgorot),
      otherHolidays,
      status: bill.status,
      confirmation: bill.transactions[0]?.confirmation ?? "",
      notes: bill.notes ?? "",
      createdBy: bill.createdBy,
      submittedAt: s.createdAt.toISOString(),
    };
  });

  const csv = toCsv(COLUMNS, rows);
  const filename = `signups-${holiday.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
