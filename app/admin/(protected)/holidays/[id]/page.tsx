import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HolidayForm } from "@/components/admin/holiday-form";
import { updateHoliday } from "@/lib/actions/holidays";
import { agorotToShekels, formatAgorotAsILS } from "@/lib/money";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const holiday = await prisma.holiday.findUnique({ where: { id } });
  return { title: holiday?.nameEn ?? "Holiday" };
}

export default async function EditHolidayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const holiday = await prisma.holiday.findUnique({
    where: { id },
    include: { signups: true },
  });
  if (!holiday) notFound();

  const active = holiday.signups.filter((s) => s.status !== "CANCELLED");
  const paid = holiday.signups.filter((s) => s.status === "PAID");
  const pending = holiday.signups.filter((s) => s.status === "PENDING");
  const boundAction = updateHoliday.bind(null, holiday.id);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy">{holiday.nameEn}</h1>
          <p className="text-sm text-ink/50">/seats/{holiday.slug}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/admin/holidays/${holiday.id}/signups/new`}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-alt"
          >
            + Create Bill
          </Link>
          <Link
            href={`/admin/holidays/${holiday.id}/signups`}
            className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-cream hover:bg-navy-light"
          >
            View Signups ({holiday.signups.length})
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-line bg-white p-6 sm:grid-cols-5">
        <Stat label="Men's Seats" value={active.reduce((s, x) => s + x.menSeats, 0)} />
        <Stat label="Women's Seats" value={active.reduce((s, x) => s + x.womenSeats, 0)} />
        <Stat label="Paid" value={paid.length} />
        <Stat label="Pending" value={pending.length} />
        <Stat
          label="Paid Revenue"
          value={formatAgorotAsILS(paid.reduce((s, x) => s + x.totalAgorot, 0))}
        />
      </div>

      <h2 className="mt-8 font-serif text-lg font-semibold text-navy">Edit Details</h2>
      <div className="mt-3">
        <HolidayForm
          action={boundAction}
          submitLabel="Save Changes"
          defaultValues={{
            nameEn: holiday.nameEn,
            nameHe: holiday.nameHe,
            descriptionEn: holiday.descriptionEn ?? "",
            descriptionHe: holiday.descriptionHe ?? "",
            memberPrice: agorotToShekels(holiday.memberPriceAgorot),
            nonMemberPrice: agorotToShekels(holiday.nonMemberPriceAgorot),
            isOpen: holiday.isOpen,
            slug: holiday.slug,
          }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-1 text-lg font-semibold text-navy">{value}</p>
    </div>
  );
}
