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

// NedarimPlus's JSON reports don't reliably return numeric fields as JSON
// numbers - confirmed in practice that KevaSuccess/KevaTashlumim can come
// back as numeric strings (e.g. "12"). Every "number" field below is typed
// loosely to reflect that; callers should go through a tolerant conversion
// (see toNumber() in lib/actions/nedarim-import.ts) rather than a strict
// `=== number` comparison or passing it straight into a Prisma Int field.
export type KevaListEntry = {
  Zeout: string | null;
  ClientName: string | null;
  Adresse: string | null;
  City: string | null;
  Phone: string | null;
  Mail: string | null;
  Amount: number | string | null;
  Currency: number | string | null;
  Itra: number | string | null;
  Success: number | string | null;
  LastNum: string | null;
  CreationDate: string | null;
  NextDate: string | null;
  ErrorText: string | null;
  Groupe: string | null;
  Comments: string | null;
  MasofId: string | null;
  Tokef: string | null;
  Enabled: number | string | null;
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

export type KevaHistoryEntry = {
  ID: number | string; // 1 = successful charge | 2 = declined | 3 = cancelled
  Amount: number | string | null;
  Date: string | null;
  Name: string | null;
  LastNum: string | null;
  TransactionId: string | null;
};

export type KevaDetail = {
  KevaId: string;
  KevaStatus: number | string | null; // 1 active | 2 frozen | 3 deleted
  KevaName: string | null;
  KevaAdresse: string | null;
  KevaCity: string | null;
  KevaPhone: string | null;
  KevaMail: string | null;
  KevaGroupe: string | null;
  KevaAmount: number | string | null;
  KevaCurrency: number | string | null;
  KevaTashlumim: number | string | null; // remaining charges
  KevaSuccess: number | string | null; // charges already made
  CreatedDate: string | null;
  KevaNextDate: string | null;
  KevaFrequency: number | string | null; // 1 monthly | 2 weekly | 3 Yizkor (annual memorial)
  TotalHistoryAmount: number | string | null;
  HistoryCount: number | string | null;
  HistoryData: KevaHistoryEntry[] | null;
};

/**
 * Full detail for one standing order, including its charge history
 * (HistoryData) - unlike GetKevaJson's list, this isn't documented with any
 * rate limit, so it's fine to call once per standing order being imported
 * or re-synced. Returns null if not configured, or on any request/parse
 * failure.
 */
export async function fetchKevaDetail(kevaId: string): Promise<KevaDetail | null> {
  const mosad = process.env.NEDARIM_MOSAD;
  const apiPassword = process.env.NEDARIM_APIPASSWORD;
  if (!mosad || !apiPassword) return null;

  const url = `${REPORTS_BASE_URL}?${new URLSearchParams({
    Action: "GetKevaId",
    MosadId: mosad,
    ApiPassword: apiPassword,
    KevaId: kevaId,
  })}`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      console.error(`[nedarim reports] GetKevaId HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data || typeof data !== "object") {
      console.error("[nedarim reports] GetKevaId returned unexpected response", data);
      return null;
    }
    return data as KevaDetail;
  } catch (error) {
    console.error("[nedarim reports] GetKevaId request failed", error);
    return null;
  }
}
