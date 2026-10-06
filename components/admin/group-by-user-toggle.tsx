"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Checked by default (grouped view) - unchecking adds ?view=raw to show the
 * flat, ungrouped table instead. Reads/writes the URL directly so it works
 * as a plain toggle without needing a separate "Apply" click.
 */
export function GroupByUserToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const grouped = searchParams.get("view") !== "raw";

  function onChange(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) {
      params.delete("view");
    } else {
      params.set("view", "raw");
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-ink/70">
      <input
        type="checkbox"
        checked={grouped}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-line"
      />
      Group by user
    </label>
  );
}
