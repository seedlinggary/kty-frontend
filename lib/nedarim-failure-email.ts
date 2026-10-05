/**
 * Parses NedarimPlus's "payment failed" notification email (the one sent to
 * the shul's office inbox - there's no webhook for declines, only this).
 * Format is a fixed set of Hebrew "label: value" lines. Based on a real
 * sample (standing-order decline); one-time ("Ragil") declines are expected
 * to use the same labeled-line format with a slightly different intro
 * sentence and possibly "מספר עסקה" instead of "מספר הוראה" - the parser
 * keys off the labels themselves, not the intro text, so it should hold up
 * for either case, but hasn't been confirmed against a real one-time sample.
 */
export type ParsedFailureEmail = {
  orderNumber: string | null;
  idNumber: string | null;
  clientName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  amountAgorot: number | null;
  paymentType: string | null;
  category: string | null;
  comments: string | null;
  cardLast4: string | null;
  cardExpiry: string | null;
  failureReason: string | null;
  cardBrand: string | null;
  terminalLocation: string | null;
};

const LABEL_MAP: Record<string, keyof ParsedFailureEmail> = {
  "מספר הוראה": "orderNumber",
  "מספר עסקה": "orderNumber",
  "מספר זהות": "idNumber",
  "שם לקוח": "clientName",
  כתובת: "address",
  טלפון: "phone",
  מייל: "email",
  תשלומים: "paymentType",
  קטגוריה: "category",
  הערות: "comments",
  "4 ספרות אחרונות": "cardLast4",
  תוקף: "cardExpiry",
  "סיבת שגיאה": "failureReason",
  מותג: "cardBrand",
  "מיקום מסוף": "terminalLocation",
};

function parseAmountToAgorot(value: string): number | null {
  // e.g. "240.00 ₪" -> 24000
  const cleaned = value.replace(/[^\d.]/g, "");
  const shekels = Number(cleaned);
  if (!cleaned || Number.isNaN(shekels)) return null;
  return Math.round(shekels * 100);
}

export function parseNedarimFailureEmail(rawText: string): ParsedFailureEmail {
  const result: ParsedFailureEmail = {
    orderNumber: null,
    idNumber: null,
    clientName: null,
    address: null,
    phone: null,
    email: null,
    amountAgorot: null,
    paymentType: null,
    category: null,
    comments: null,
    cardLast4: null,
    cardExpiry: null,
    failureReason: null,
    cardBrand: null,
    terminalLocation: null,
  };

  const lines = rawText.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([^:]+?)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, label, value] = match;
    const trimmedLabel = label.trim();
    const trimmedValue = value.trim();

    if (trimmedLabel === "סכום") {
      result.amountAgorot = parseAmountToAgorot(trimmedValue);
      continue;
    }

    const field = LABEL_MAP[trimmedLabel];
    if (field && trimmedValue) {
      (result[field] as string) = trimmedValue;
    }
  }

  return result;
}

/** Heuristic check that a block of text looks like a NedarimPlus decline notification at all - used to sanity-check pasted/fetched email content before treating it as one. Matches the root נדח- rather than a specific conjugation (נדחה/נדחתה/etc. all share it). */
export function looksLikeNedarimFailureEmail(rawText: string): boolean {
  return rawText.includes("נדח") && rawText.includes("נדרים פלוס");
}
