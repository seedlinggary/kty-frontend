/**
 * NedarimPlus's authenticated "reports" API (Manage3.aspx) - needs the
 * secret ApiPassword key (generated in NedarimPlus: עוד > מפתחות API),
 * distinct from the public Mosad/ApiValid used for building payment links.
 * Unlike the payment-link flow, this is genuinely optional - nothing here
 * runs until NEDARIM_APIPASSWORD is set.
 *
 * GetKevaJson in particular is the one real source of automatic *decline*
 * data NedarimPlus exposes anywhere: every standing order on the account
 * (ours and any pre-existing ones), each with an ErrorText field showing
 * the last charge attempt's decline reason if it failed. There is no
 * equivalent for one-time ("Ragil") transactions - a decline there simply
 * never creates a transaction record at all, so this only ever helps with
 * memberships specifically.
 */
const REPORTS_BASE_URL = "https://matara.pro/nedarimplus/Reports/Manage3.aspx";

export function isNedarimReportingConfigured(): boolean {
  return Boolean(process.env.NEDARIM_MOSAD && process.env.NEDARIM_APIPASSWORD);
}

export type KevaListEntry = {
  Zeout: string | null;
  ClientName: string | null;
  Adresse: string | null;
  City: string | null;
  Phone: string | null;
  Mail: string | null;
  Amount: number | null;
  Currency: number | null;
  Itra: number | null;
  Success: number | null;
  LastNum: string | null;
  CreationDate: string | null;
  NextDate: string | null;
  ErrorText: string | null;
  Groupe: string | null;
  Comments: string | null;
  MasofId: string | null;
  Tokef: string | null;
  Enabled: number | null;
  KevaId: string;
};

/**
 * Lists every credit-card standing order on the Mosad - rate-limited by
 * NedarimPlus to 20 calls/hour, but this single call covers every standing
 * order at once, so polling it a few times a day is well within budget.
 * Returns null if not configured, or on any request/parse failure (callers
 * should treat that as "couldn't check right now," not "no declines."
 */
export async function fetchKevaList(): Promise<KevaListEntry[] | null> {
  const mosad = process.env.NEDARIM_MOSAD;
  const apiPassword = process.env.NEDARIM_APIPASSWORD;
  if (!mosad || !apiPassword) return null;

  const url = `${REPORTS_BASE_URL}?${new URLSearchParams({
    Action: "GetKevaJson",
    MosadId: mosad,
    ApiPassword: apiPassword,
  })}`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      console.error(`[nedarim reports] GetKevaJson HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error("[nedarim reports] GetKevaJson returned non-array response", data);
      return null;
    }
    return data as KevaListEntry[];
  } catch (error) {
    console.error("[nedarim reports] GetKevaJson request failed", error);
    return null;
  }
}
