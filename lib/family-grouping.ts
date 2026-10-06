type FamilyRef = { id: string; fullName: string };

/**
 * Splits a list of records into clusters by their linked Family (preserving
 * first-seen order), plus whatever's left over with no Family at all. Lets
 * an admin list page show "one block per household" instead of every
 * repeat signup/payment as an unrelated row, while still surfacing anything
 * that hasn't been merged yet rather than hiding it.
 */
export function groupByFamily<T>(
  items: T[],
  getFamily: (item: T) => FamilyRef | null
): { groups: { family: FamilyRef; items: T[] }[]; ungrouped: T[] } {
  const order: string[] = [];
  const groups = new Map<string, { family: FamilyRef; items: T[] }>();
  const ungrouped: T[] = [];

  for (const item of items) {
    const family = getFamily(item);
    if (!family) {
      ungrouped.push(item);
      continue;
    }
    if (!groups.has(family.id)) {
      groups.set(family.id, { family, items: [] });
      order.push(family.id);
    }
    groups.get(family.id)!.items.push(item);
  }

  return { groups: order.map((id) => groups.get(id)!), ungrouped };
}
