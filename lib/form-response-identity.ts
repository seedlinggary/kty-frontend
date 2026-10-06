type FieldLike = { id: string; label: string };

function findByLabel(answers: Record<string, unknown>, fields: FieldLike[], keywords: string[]): string | null {
  for (const field of fields) {
    const label = field.label.toLowerCase();
    if (keywords.some((k) => label.includes(k))) {
      const value = answers[field.id];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

/**
 * A FormResponse has no fixed name/email/phone columns - its answers are a
 * JSON blob keyed by dynamic FormField ids. Best-effort: look at the form's
 * own field labels for anything that sounds like a name/email/phone/address
 * field and pull the answer from there. Shared between the User-merge
 * action (one response at a time) and the duplicate-recommendation scan
 * (many at once, already loaded) so both agree on the same guess.
 */
export function extractFormResponseIdentity(
  answers: Record<string, unknown>,
  fields: FieldLike[],
  fallbackFullName: string
) {
  return {
    fullName: findByLabel(answers, fields, ["name"]) ?? fallbackFullName,
    email: findByLabel(answers, fields, ["email"]),
    phone: findByLabel(answers, fields, ["phone", "mobile"]),
    address: findByLabel(answers, fields, ["address", "street"]),
    city: findByLabel(answers, fields, ["city"]),
  };
}
