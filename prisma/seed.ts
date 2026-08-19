import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "Shul Office";

  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.admin.upsert({
      where: { email: adminEmail.toLowerCase() },
      update: {},
      create: { email: adminEmail.toLowerCase(), passwordHash, name: adminName },
    });
    console.log(`Admin ready: ${adminEmail}`);
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set - skipping admin creation.");
  }

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      aboutEn:
        "Kehilat Tiferet Yisrael (KTY) is a small, tight-knit American-Charedi community in Ramat Beit Shemesh Hey, led by Rav Lovy. We're a warm, welcoming kehilla for families looking for a genuine, close-knit davening and learning environment.",
      aboutHe:
        "קהילת תפארת ישראל (KTY) היא קהילה חרדית-אמריקאית קטנה ומלוכדת ברמת בית שמש ה', בראשות הרב לובי. קהילה חמה ומקבלת פנים למשפחות המחפשות סביבת תפילה ולימוד אמיתית ומלוכדת.",
      contactPhone: "",
      contactEmail: "",
      address: "Across from Yonatan, Ramat Beit Shemesh Hey",
      serviceTimesEn: null,
      serviceTimesHe: null,
      heroTaglineEn: "A warm home for tefillah and learning in Ramat Beit Shemesh Hey.",
      heroTaglineHe: "בית חם לתפילה ולימוד ברמת בית שמש ה'.",
    },
  });
  console.log("Site settings ready.");

  await prisma.holiday.upsert({
    where: { slug: "yomim-noraim-5787" },
    update: {},
    create: {
      slug: "yomim-noraim-5787",
      nameEn: "Yomim Noraim 5787",
      nameHe: 'ימים נוראים תשפ"ז',
      descriptionEn: "Seats for Rosh Hashana and Yom Kippur davening.",
      descriptionHe: 'מקומות לתפילות ראש השנה ויום כיפור.',
      memberPriceAgorot: 10000,
      nonMemberPriceAgorot: 20000,
      isOpen: true,
    },
  });
  console.log("Sample holiday ready: Yomim Noraim 5787");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
