import { prisma } from "@/lib/prisma";

export async function getOpenHolidays() {
  try {
    return await prisma.holiday.findMany({
      where: { isOpen: true },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return [];
  }
}

export async function getHolidayBySlug(slug: string) {
  try {
    return await prisma.holiday.findUnique({ where: { slug } });
  } catch {
    return null;
  }
}

export function computeTotalAgorot(
  holiday: { memberPriceAgorot: number; nonMemberPriceAgorot: number },
  isMember: boolean,
  menSeats: number,
  womenSeats: number
) {
  const perSeat = isMember ? holiday.memberPriceAgorot : holiday.nonMemberPriceAgorot;
  return perSeat * (menSeats + womenSeats);
}
