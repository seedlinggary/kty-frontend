/**
 * WRITE-capable calls against NedarimPlus's standing-order management API.
 * Unlike everything else this app does with NedarimPlus (build a redirect
 * link, or read-only reports), these functions make a REAL change on
 * NedarimPlus's own live standing order - there is no sandbox/test mode
 * documented for this API. Still genuinely in testing as a feature - every
 * caller is expected to be SUPERADMIN-gated and double-confirmed; see
 * lib/actions/nedarim-keva-admin.ts.
 *
 * All of these hit the same Manage3.aspx endpoint as the read-only reports
 * in lib/nedarim-reports.ts, but take "MosadNumber" (not "MosadId" like the
 * read endpoints) - confirmed per NedarimPlus's own docs for each of these
 * specific actions.
 */
const MANAGE_BASE_URL = "https://matara.pro/nedarimplus/Reports/Manage3.aspx";

export function isNedarimWritesConfigured(): boolean {
  return Boolean(process.env.NEDARIM_MOSAD && process.env.NEDARIM_APIPASSWORD);
}

export type NedarimWriteResult =
  | { ok: true; raw?: unknown }
  | { ok: false; error: string };

/**
 * NedarimPlus's own docs admit these endpoints are inconsistent: some
 * return JSON {Result, Message}, EnableKevaNew's success is JSON
 * {NextDate}, and others return plain TEXT ("OK" or an error string with
 * no wrapper at all). Handles all three rather than assuming one.
 */
async function parseManageResponse(res: Response): Promise<NedarimWriteResult> {
  const text = (await res.text()).trim();

  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object") {
      if ("Result" in json) {
        return json.Result === "OK"
          ? { ok: true, raw: json }
          : { ok: false, error: String(json.Message || "NedarimPlus returned an error.") };
      }
      // EnableKevaNew's documented success shape: {"NextDate":"dd/MM/yy"}, no Result field.
      if ("NextDate" in json) {
        return { ok: true, raw: json };
      }
    }
  } catch {
    // Not JSON - fall through to plain-text handling below.
  }

  if (text === "OK") return { ok: true };
  return { ok: false, error: text || "NedarimPlus returned an unrecognized response." };
}

async function callManageApi(params: Record<string, string>): Promise<NedarimWriteResult> {
  const mosad = process.env.NEDARIM_MOSAD;
  const apiPassword = process.env.NEDARIM_APIPASSWORD;
  if (!mosad || !apiPassword) {
    return { ok: false, error: "NedarimPlus isn't configured (missing NEDARIM_APIPASSWORD)." };
  }

  const url = `${MANAGE_BASE_URL}?${new URLSearchParams({
    MosadNumber: mosad,
    ApiPassword: apiPassword,
    ...params,
  })}`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      console.error(`[nedarim writes] ${params.Action} HTTP ${res.status}`);
      return { ok: false, error: `NedarimPlus request failed (HTTP ${res.status}).` };
    }
    return await parseManageResponse(res);
  } catch (error) {
    console.error(`[nedarim writes] ${params.Action} request failed`, error);
    return { ok: false, error: "Couldn't reach NedarimPlus just now - try again shortly." };
  }
}

/**
 * UpdateKevaNew - partial update: only the fields passed here change on the
 * real standing order. amountShekels maps to NedarimPlus's own "Amount"
 * (the actual recurring charge), tashlumim to "Tashlumim" (payments
 * remaining per NedarimPlus's own count).
 */
export async function updateKevaAmount(
  kevaId: string,
  amountShekels: number,
  tashlumim?: number
): Promise<NedarimWriteResult> {
  const params: Record<string, string> = {
    Action: "UpdateKevaNew",
    KevaId: kevaId,
    Amount: String(amountShekels),
  };
  if (tashlumim != null) params.Tashlumim = String(tashlumim);
  return callManageApi(params);
}

/** DeleteKeva - permanently cancels the standing order on NedarimPlus's own side. Irreversible there. */
export async function deleteKeva(kevaId: string): Promise<NedarimWriteResult> {
  return callManageApi({ Action: "DeleteKeva", KevaId: kevaId });
}

/** DisableKeva - freezes the standing order (no further charges) without deleting it; reversible via enableKeva. */
export async function disableKeva(kevaId: string): Promise<NedarimWriteResult> {
  return callManageApi({ Action: "DisableKeva", KevaId: kevaId });
}

/** EnableKevaNew - unfreezes a disabled standing order. Success includes the new NextDate NedarimPlus computed. */
export async function enableKeva(kevaId: string): Promise<NedarimWriteResult> {
  return callManageApi({ Action: "EnableKevaNew", KevaId: kevaId });
}
