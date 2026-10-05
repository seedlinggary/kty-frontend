type PersonRef = { id: string; fullName: string };

/**
 * Splits a list of records into clusters by their linked Person (preserving
 * first-seen order), plus whatever's left over with no Person at all. Lets
 * an admin list page show "one block per real person" instead of every
 * repeat signup/payment as an unrelated row, while still surfacing anything
 * that hasn't been merged yet rather than hiding it.
 */
export function groupByPerson<T>(
  items: T[],
  getPerson: (item: T) => PersonRef | null
): { groups: { person: PersonRef; items: T[] }[]; ungrouped: T[] } {
  const order: string[] = [];
  const groups = new Map<string, { person: PersonRef; items: T[] }>();
  const ungrouped: T[] = [];

  for (const item of items) {
    const person = getPerson(item);
    if (!person) {
      ungrouped.push(item);
      continue;
    }
    if (!groups.has(person.id)) {
      groups.set(person.id, { person, items: [] });
      order.push(person.id);
    }
    groups.get(person.id)!.items.push(item);
  }

  return { groups: order.map((id) => groups.get(id)!), ungrouped };
}
