type UserRef = { id: string; fullName: string };

/**
 * Splits a list of records into clusters by their linked User (preserving
 * first-seen order), plus whatever's left over with no User at all. Lets
 * an admin list page show "one block per real person" instead of every
 * repeat signup/payment as an unrelated row, while still surfacing anything
 * that hasn't been merged yet rather than hiding it.
 */
export function groupByUser<T>(
  items: T[],
  getUser: (item: T) => UserRef | null
): { groups: { user: UserRef; items: T[] }[]; ungrouped: T[] } {
  const order: string[] = [];
  const groups = new Map<string, { user: UserRef; items: T[] }>();
  const ungrouped: T[] = [];

  for (const item of items) {
    const user = getUser(item);
    if (!user) {
      ungrouped.push(item);
      continue;
    }
    if (!groups.has(user.id)) {
      groups.set(user.id, { user, items: [] });
      order.push(user.id);
    }
    groups.get(user.id)!.items.push(item);
  }

  return { groups: order.map((id) => groups.get(id)!), ungrouped };
}
