import { prisma } from "@/lib/prisma";

export async function getHolidaysWithStats() {
  const holidays = await prisma.holiday.findMany({
    orderBy: { createdAt: "desc" },
    include: { signups: { include: { bill: true } } },
  });

  return holidays.map((holiday) => {
    const active = holiday.signups.filter((s) => s.bill.status !== "CANCELLED");
    const paid = holiday.signups.filter((s) => s.bill.status === "PAID");
    const pending = holiday.signups.filter((s) => s.bill.status === "PENDING");

    return {
      ...holiday,
      totalMenSeats: active.reduce((sum, s) => sum + s.menSeats, 0),
      totalWomenSeats: active.reduce((sum, s) => sum + s.womenSeats, 0),
      paidCount: paid.length,
      pendingCount: pending.length,
      paidRevenueAgorot: paid.reduce((sum, s) => sum + s.totalAgorot, 0),
      pendingRevenueAgorot: pending.reduce((sum, s) => sum + s.totalAgorot, 0),
    };
  });
}

export type HolidayWithStats = Awaited<ReturnType<typeof getHolidaysWithStats>>[number];
