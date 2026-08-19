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
  phone: string;
  email?: string | null;
  groupe: string;
  language?: "en" | "he";
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
    ["Phone", input.phone],
  ];
  if (input.email) pairs.push(["Email", input.email]);
  pairs.push(["Groupe", input.groupe]);
  pairs.push(["GroupeLock", "1"]);
  pairs.push(["Avour", `BILL-${input.billId}`]);
  pairs.push(["AvourLock", "1"]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    pairs.push([
      "Redirect",
      `${siteUrl.replace(/^https?:\/\//, "")}/pay/thank-you?bill=${input.billId}`,
    ]);
  }
  if (input.language === "en") {
    pairs.push(["Language", "en"]);
  }
  // "he" (or unspecified) leaves the page in its default Hebrew display.

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
