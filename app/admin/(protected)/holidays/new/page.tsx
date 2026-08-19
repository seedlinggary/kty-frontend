import type { Metadata } from "next";
import { HolidayForm } from "@/components/admin/holiday-form";
import { createHoliday } from "@/lib/actions/holidays";

export const metadata: Metadata = { title: "New Holiday" };

export default function NewHolidayPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-navy">New Holiday</h1>
      <p className="mt-1 text-sm text-ink/60">
        Create a new seat sale. It will show up on the public site immediately if &quot;Open for
        public sign-up&quot; is checked.
      </p>
      <div className="mt-6">
        <HolidayForm action={createHoliday} submitLabel="Create Holiday" />
      </div>
    </div>
  );
}
