import type { FormFieldType } from "@/lib/generated/prisma/client";

export const FORM_FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  SHORT_TEXT: "Short Text",
  LONG_TEXT: "Long Text",
  EMAIL: "Email",
  PHONE: "Phone",
  NUMBER: "Number",
  DATE: "Date",
  SINGLE_CHOICE: "Multiple Choice — pick one",
  MULTI_CHOICE: "Multiple Choice — pick many",
  MULTI_TEXT: "Repeatable List (text)",
  NAME_DATE_LIST: "Repeatable List (name + date)",
};

export const FORM_FIELD_TYPES = Object.keys(FORM_FIELD_TYPE_LABELS) as FormFieldType[];

export const CHOICE_TYPES: FormFieldType[] = ["SINGLE_CHOICE", "MULTI_CHOICE"];
export const LIST_TYPES: FormFieldType[] = ["MULTI_TEXT", "NAME_DATE_LIST"];

export function isChoiceType(type: FormFieldType): boolean {
  return CHOICE_TYPES.includes(type);
}

export function isListType(type: FormFieldType): boolean {
  return LIST_TYPES.includes(type);
}

export function getFieldOptions(options: unknown): string[] {
  if (Array.isArray(options)) return options.filter((o): o is string => typeof o === "string");
  return [];
}

type NameDateEntry = { name?: string; date?: string };

/** Renders any answer value as a single display/CSV-friendly string. */
export function formatAnswerForDisplay(type: FormFieldType, value: unknown): string {
  if (value == null || value === "") return "";

  if (type === "MULTI_CHOICE" || type === "MULTI_TEXT") {
    return Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value);
  }

  if (type === "NAME_DATE_LIST") {
    if (!Array.isArray(value)) return "";
    return (value as NameDateEntry[])
      .filter((entry) => entry?.name || entry?.date)
      .map((entry) => `${entry.name || "?"} (${entry.date || "?"})`)
      .join("; ");
  }

  return String(value);
}

/** Case-insensitive substring match against any answer's rendered text - used for the admin search box. */
export function answerMatchesSearch(type: FormFieldType, value: unknown, needle: string): boolean {
  return formatAnswerForDisplay(type, value).toLowerCase().includes(needle.toLowerCase());
}

export function isAnswerEmpty(value: unknown): boolean {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    return value.every((entry) => {
      if (typeof entry === "string") return entry.trim() === "";
      if (entry && typeof entry === "object") {
        const e = entry as NameDateEntry;
        return !e.name && !e.date;
      }
      return true;
    });
  }
  return false;
}

/** Generates "H:MM AM/PM" labels at a fixed interval between two times, inclusive of both ends. */
export function generateTimeSlots(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  stepMinutes: number
): string[] {
  const slots: string[] = [];
  const totalStart = startHour * 60 + startMinute;
  const totalEnd = endHour * 60 + endMinute;
  const wrapsMidnight = totalEnd < totalStart;
  const end = wrapsMidnight ? totalEnd + 24 * 60 : totalEnd;

  for (let t = totalStart; t <= end; t += stepMinutes) {
    const minutesOfDay = t % (24 * 60);
    const h24 = Math.floor(minutesOfDay / 60);
    const m = minutesOfDay % 60;
    const period = h24 < 12 || h24 === 24 ? "AM" : "PM";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    slots.push(`${h12}:${String(m).padStart(2, "0")} ${period}`);
  }
  return slots;
}
