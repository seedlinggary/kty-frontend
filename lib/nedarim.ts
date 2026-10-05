import { agorotToShekels } from "@/lib/money";

const PAYMENT_BASE_URL = "https://www.matara.pro/nedarimplus/online/";

/**
 * Only NEDARIM_MOSAD is actually required for the "direct payment link" redirect
 * flow this site uses. NEDARIM_APIVALID is for the iframe-embed method (not used
 * here) - it's kept as an env var for documentation / future use, not required.
 */
export function isNedarimConfigured(): boolean {
  return Boolean(process.env.NEDARIM_MOSAD);
}

export interface PaymentLinkInput {
  billId: string;
  amountAgorot: number;
  clientName: string;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  city?: string | null;
  groupe: string;
  language?: "en" | "he";
  /** Avour prefix, e.g. "BILL" (default), "DON", "MEM", "LINK" - see REFERENCE_PREFIXES. */
  referencePrefix?: string;
  /** Redirect query param name holding the reference code; defaults to "bill" for back-compat. */
  redirectParam?: string;
}

function buildRedirect(input: { billId: string; redirectParam?: string }): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;
  const param = input.redirectParam ?? "bill";
  return `${siteUrl.replace(/^https?:\/\//, "")}/pay/thank-you?${param}=${input.billId}`;
}

/**
 * Builds a NedarimPlus "direct payment link" (redirect flow - no card data
 * ever touches our server). Returns null if NEDARIM_MOSAD isn't configured,
 * so callers can render a fallback instead of a broken link.
 *
 * Amount and payment count are locked to a single full payment so the webhook's
 * Amount always equals the signup's total - a partial/installment payment would
 * otherwise never match and the signup would stay PENDING forever.
 */
export function buildPaymentLink(input: PaymentLinkInput): string | null {
  const mosad = process.env.NEDARIM_MOSAD;
  if (!mosad) return null;

  // NedarimPlus docs require encodeURIComponent-style encoding (spaces as %20).
  // URLSearchParams encodes spaces as "+" (form-encoding convention), which
  // NedarimPlus's payment page does NOT decode back to a space when displaying
  // fields - it shows the literal "+" character. Build the query string by hand
  // with encodeURIComponent so multi-word names/categories render correctly.
  const pairs: [string, string][] = [
    ["mosad", mosad],
    ["Amount", String(agorotToShekels(input.amountAgorot))],
    ["AmountLock", "1"],
    ["Payment", "1"],
    ["PaymentLock", "1"],
    ["OnlyNormal", "1"],
    ["ClientName", input.clientName],
  ];
  if (input.phone) pairs.push(["Phone", input.phone]);
  if (input.email) pairs.push(["Email", input.email]);
  if (input.street) pairs.push(["Street", input.street]);
  if (input.city) pairs.push(["City", input.city]);
  pairs.push(["Groupe", input.groupe]);
  pairs.push(["GroupeLock", "1"]);
  pairs.push(["Avour", `${input.referencePrefix ?? "BILL"}-${input.billId}`]);
  pairs.push(["AvourLock", "1"]);

  const redirect = buildRedirect(input);
  if (redirect) pairs.push(["Redirect", redirect]);
  if (input.language === "en") {
    pairs.push(["Language", "en"]);
  }
  // "he" (or unspecified) leaves the page in its default Hebrew display.

  const query = pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  return `${PAYMENT_BASE_URL}?${query}`;
}

export interface RecurringPaymentLinkInput {
  membershipId: string;
  monthlyAmountAgorot: number;
  clientName: string;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  city?: string | null;
  groupe: string;
  language?: "en" | "he";
}

/**
 * Builds a NedarimPlus standing-order ("Keva") direct payment link for a
 * monthly recurring charge - same base mechanism as buildPaymentLink, but
 * OnlyKeva=1 instead of OnlyNormal=1, and Payment is left unset (NedarimPlus
 * treats a blank Payment count as an unlimited/ongoing standing order rather
 * than a fixed number of installments).
 */
export function buildRecurringPaymentLink(input: RecurringPaymentLinkInput): string | null {
  const mosad = process.env.NEDARIM_MOSAD;
  if (!mosad) return null;

  const pairs: [string, string][] = [
    ["mosad", mosad],
    ["Amount", String(agorotToShekels(input.monthlyAmountAgorot))],
    ["AmountLock", "1"],
    ["OnlyKeva", "1"],
    ["ClientName", input.clientName],
  ];
  if (input.phone) pairs.push(["Phone", input.phone]);
  if (input.email) pairs.push(["Email", input.email]);
  if (input.street) pairs.push(["Street", input.street]);
  if (input.city) pairs.push(["City", input.city]);
  pairs.push(["Groupe", input.groupe]);
  pairs.push(["GroupeLock", "1"]);
  pairs.push(["Avour", `MEM-${input.membershipId}`]);
  pairs.push(["AvourLock", "1"]);

  const redirect = buildRedirect({ billId: input.membershipId, redirectParam: "membership" });
  if (redirect) pairs.push(["Redirect", redirect]);
  if (input.language === "en") {
    pairs.push(["Language", "en"]);
  }

  const query = pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  return `${PAYMENT_BASE_URL}?${query}`;
}

/** Source IPs NedarimPlus sends webhook callbacks from (documented, not expected to rotate). */
export const NEDARIM_WEBHOOK_IPS = ["18.196.146.117", "18.194.219.73"];

export function extractBillIdFromComment(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const match = comment.match(/BILL-([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

export type ReferenceKind = "BILL" | "DON" | "MEM" | "LINK";

/**
 * Generalized version of extractBillIdFromComment, for routing a webhook
 * payload to whichever payable type its Avour/Comments prefix indicates.
 */
export function extractReferenceFromComment(
  comment: string | null | undefined
): { kind: ReferenceKind; code: string } | null {
  if (!comment) return null;
  const match = comment.match(/\b(BILL|DON|MEM|LINK)-([A-Za-z0-9]+)/);
  if (!match) return null;
  return { kind: match[1] as ReferenceKind, code: match[2] };
}
