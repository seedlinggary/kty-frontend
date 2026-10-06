/**
 * A small marker for a value our own system filled in or guessed, as
 * opposed to one that came directly from NedarimPlus - hover (or long-press
 * on touch) to see why. Uses the browser's native `title` tooltip rather
 * than a custom positioned one, deliberately: nearly every place this
 * shows up sits inside an `overflow-x-auto` table wrapper, where a custom
 * absolutely-positioned tooltip risks being clipped.
 */
export function EstimatedMark({ title }: { title: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      className="ml-1 cursor-help text-xs font-bold text-amber-600"
    >
      ⓘ
    </span>
  );
}
