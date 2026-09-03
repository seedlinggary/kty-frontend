import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import type { FormFieldType } from "../lib/generated/prisma/client";
import { generateTimeSlots } from "../lib/forms";

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
        "Kehillas Tiferes Yisroel (KTY) is a small, tight-knit Anglo Charedi community in Ramat Beit Shemesh Hey, led by Rav Lovy. We're a warm, welcoming kehilla for families looking for a genuine, close-knit davening and learning environment.",
      aboutHe:
        "קהילת תפארת ישראל (KTY) היא קהילה חרדית-אנגלוסקסית קטנה ומלוכדת ברמת בית שמש ה', בראשות הרב לובי. קהילה חמה ומקבלת פנים למשפחות המחפשות סביבת תפילה ולימוד אמיתית ומלוכדת.",
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

  await seedIntakeForm();
}

async function seedIntakeForm() {
  const shacharisOptions = generateTimeSlots(6, 0, 8, 30, 15);
  const minchaOptions = generateTimeSlots(13, 15, 19, 0, 15);
  const maarivOptions = generateTimeSlots(20, 30, 0, 0, 15);

  const fieldDefs: {
    label: string;
    type: FormFieldType;
    required: boolean;
    options?: string[];
    helpText?: string;
    /** Label of an earlier field this one's visibility/label depends on. */
    conditionLabel?: string;
    conditionValue?: string;
    conditionMode?: "SHOW_IF" | "HIDE_IF";
    /** Replaces `label` whenever the condition value matches (stays always-visible). */
    altLabel?: string;
  }[] = [
    {
      label: "Marital Status",
      type: "SINGLE_CHOICE",
      required: true,
      options: ["Married", "Single"],
      helpText: "For our few single parents - we just need a bit less info from you below.",
    },
    {
      label: "Husband's Given Name",
      type: "SHORT_TEXT",
      required: true,
      conditionLabel: "Marital Status",
      conditionValue: "Single",
      altLabel: "Your Given Name",
    },
    {
      label: "Husband's Hebrew Name",
      type: "SHORT_TEXT",
      required: true,
      helpText: "e.g., Yaakov ben Avraham",
      conditionLabel: "Marital Status",
      conditionValue: "Single",
      altLabel: "Your Hebrew Name",
    },
    {
      label: "Husband's Email",
      type: "EMAIL",
      required: true,
      conditionLabel: "Marital Status",
      conditionValue: "Single",
      altLabel: "Your Email",
    },
    {
      label: "Husband's Mobile Number",
      type: "PHONE",
      required: true,
      conditionLabel: "Marital Status",
      conditionValue: "Single",
      altLabel: "Your Mobile Number",
    },
    {
      label: "Husband: Kohen / Levi / Yisrael",
      type: "SINGLE_CHOICE",
      required: false,
      options: ["Kohen", "Levi", "Yisrael"],
      conditionLabel: "Marital Status",
      conditionValue: "Single",
      altLabel: "Kohen / Levi / Yisrael",
    },
    {
      label: "Wife's Given Name",
      type: "SHORT_TEXT",
      required: false,
      conditionLabel: "Marital Status",
      conditionValue: "Married",
      conditionMode: "SHOW_IF",
    },
    {
      label: "Wife's Hebrew Name",
      type: "SHORT_TEXT",
      required: false,
      helpText: "e.g., Sarah bat Avraham",
      conditionLabel: "Marital Status",
      conditionValue: "Married",
      conditionMode: "SHOW_IF",
    },
    {
      label: "Wife's Email",
      type: "EMAIL",
      required: false,
      conditionLabel: "Marital Status",
      conditionValue: "Married",
      conditionMode: "SHOW_IF",
    },
    {
      label: "Wife's Mobile Number",
      type: "PHONE",
      required: false,
      conditionLabel: "Marital Status",
      conditionValue: "Married",
      conditionMode: "SHOW_IF",
    },
    { label: "Family Name", type: "SHORT_TEXT", required: true },
    {
      label: "Children's Hebrew Names & Birthdays",
      type: "NAME_DATE_LIST",
      required: false,
      helpText: "Add one row per child",
    },
    { label: "Home Phone Number", type: "PHONE", required: false },
    { label: "Address", type: "SHORT_TEXT", required: true },
    {
      label: "Membership Status",
      type: "SINGLE_CHOICE",
      required: true,
      options: ["Member", "Not a member yet"],
    },
    {
      label: "Shacharis Minyan Preference",
      type: "SINGLE_CHOICE",
      required: false,
      options: shacharisOptions,
    },
    {
      label: "Mincha Minyan Preference",
      type: "SINGLE_CHOICE",
      required: false,
      options: minchaOptions,
    },
    {
      label: "Maariv Minyan Preference",
      type: "SINGLE_CHOICE",
      required: false,
      options: maarivOptions,
    },
    { label: "Suggestions", type: "LONG_TEXT", required: false },
    {
      label: "Talents You Can Offer the Shul / How Would You Like to Get Involved?",
      type: "LONG_TEXT",
      required: false,
    },
    {
      label: "Is there anything the shul should know that could help us accommodate your family?",
      type: "LONG_TEXT",
      required: false,
    },
  ];

  const description = `Thank you so much for taking the time to fill out this form.

Baruch Hashem, we are incredibly excited and grateful to have moved into our new building and to begin this next stage of growth for KTY.

As the kehillah continues to grow, we want every family to feel part of building and shaping its future. Your feedback, ideas and suggestions are extremely valuable to us, and this form will also help us better understand the needs of the kehillah as we plan ahead.

We are excited to develop daily minyanim, learning sedarim, shiurim, programmes and other opportunities for the community. In order to do this properly, we need to understand what works best for the people who will actually be taking part.

At the same time, the building is still a work in progress. There are areas we are continuing to improve, and the Iryah is also expected to carry out further construction, although the exact timing and duration are still unclear. We therefore ask for everyone's patience and understanding as we settle in and continue working to make the shul into a true Makom Torah, Tefillah and Kehillah.

We are very excited about what lies ahead and look forward to building the next chapter of KTY together.`;

  const form = await prisma.form.upsert({
    where: { slug: "kehilla-intake-5787" },
    update: {},
    create: {
      slug: "kehilla-intake-5787",
      title: "KTY Kehilla Information Form",
      description,
      thankYouMessage: "Thank you for your response — it has been received.",
      // Draft on purpose: stays unreachable (even with the link) until opened from admin.
      isOpen: false,
    },
  });

  // Idempotent sync by label: update fields that already exist (fixing order,
  // wording, etc.), create ones that don't. Never deletes - unlisted fieldDefs
  // would need to be archived by hand via the admin builder, same as any other
  // field removal, so old responses referencing them stay resolvable.
  const existingFields = await prisma.formField.findMany({ where: { formId: form.id } });
  const byLabel = new Map(existingFields.map((f) => [f.label, f]));
  const labelToId = new Map<string, string>();

  for (let i = 0; i < fieldDefs.length; i++) {
    const def = fieldDefs[i];
    const data = {
      label: def.label,
      type: def.type,
      required: def.required,
      options: def.options ?? undefined,
      helpText: def.helpText ?? null,
      order: i,
    };
    const existing = byLabel.get(def.label);
    if (existing) {
      await prisma.formField.update({ where: { id: existing.id }, data });
      labelToId.set(def.label, existing.id);
    } else {
      const created = await prisma.formField.create({ data: { ...data, formId: form.id } });
      labelToId.set(def.label, created.id);
    }
  }

  // Second pass: resolve each field's conditionLabel to the depended-on field's id.
  for (const def of fieldDefs) {
    if (!def.conditionLabel) continue;
    const fieldId = labelToId.get(def.label);
    const conditionFieldId = labelToId.get(def.conditionLabel);
    if (!fieldId || !conditionFieldId) continue;
    await prisma.formField.update({
      where: { id: fieldId },
      data: {
        conditionFieldId,
        conditionValue: def.conditionValue ?? null,
        conditionMode: def.conditionMode ?? null,
        altLabel: def.altLabel ?? null,
      },
    });
  }

  console.log(`Synced ${fieldDefs.length} fields for the intake form.`);

  console.log(`Form ready (draft): ${form.title} -> /forms/${form.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
