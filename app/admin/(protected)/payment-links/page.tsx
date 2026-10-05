import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { CreatePaymentLinkForm } from "@/components/admin/create-payment-link-form";
import { buildPaymentLink } from "@/lib/nedarim";
import { markPaymentLinkPaidAction } from "@/lib/actions/payment-admin";
import { cancelPaymentLinkAction } from "@/lib/actions/payment-links";
import { flagForFollowUpAction } from "@/lib/actions/payment-follow-ups";
import { CopyLinkButton } from "@/components/admin/copy-link-button";

export const metadata: Metadata = { title: "Payment Links" };

const statusStyles: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function PaymentLinksPage() {
  const session = await auth();
  const isSuperAdmin = session?.user?.role === "SUPERADMIN";

  const links = await prisma.paymentLink.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Payment Links</h1>
      <p className="mt-1 text-sm text-ink/60">
        Fixed, predetermined-amount links - for a pledge, an event fee, or correcting an
        underpayment - so someone can just pay that exact amount. Creating one requires a super
        admin.
      </p>

      {isSuperAdmin ? (
        <div className="mt-6">
          <CreatePaymentLinkForm />
        </div>
      ) : (
        <p className="mt-6 rounded-md bg-pale p-4 text-sm text-ink/60">
          Only a super admin can create a new payment link. You can still view and manage existing
          ones below.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => {
              const paymentLink =
                link.status === "PENDING"
                  ? buildPaymentLink({
                      billId: link.referenceCode,
                      amountAgorot: link.amountAgorot,
                      clientName: link.fullName || "Payment",
                      phone: link.phone || "",
                      email: link.email,
                      groupe: link.label,
                      referencePrefix: "LINK",
                      redirectParam: "link",
                    })
                  : null;
              return (
                <tr key={link.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-medium text-ink">{link.label}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {link.fullName && <p>{link.fullName}</p>}
                    {link.phone && <p className="text-xs text-ink/50">{link.phone}</p>}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(link.amountAgorot)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[link.status]}`}>{link.status}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink/60">LINK-{link.referenceCode}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      {paymentLink && <CopyLinkButton link={paymentLink} label="Copy Payment Link" />}
                      {link.status === "PENDING" && (
                        <form action={markPaymentLinkPaidAction}>
                          <input type="hidden" name="id" value={link.id} />
                          <button type="submit" className="rounded bg-green-700 px-2 py-1 text-xs font-semibold text-white hover:bg-green-800">
                            Mark Paid
                          </button>
                        </form>
                      )}
                      {link.status !== "CANCELLED" && isSuperAdmin && (
                        <form action={cancelPaymentLinkAction}>
                          <input type="hidden" name="id" value={link.id} />
                          <button type="submit" className="text-xs font-medium text-red-600 hover:underline">Cancel</button>
                        </form>
                      )}
                      {link.status === "PENDING" && (
                        <form action={flagForFollowUpAction}>
                          <input type="hidden" name="kind" value="paymentLink" />
                          <input type="hidden" name="id" value={link.id} />
                          <button type="submit" className="text-xs font-medium text-amber-700 hover:underline">Flag Failed</button>
                        </form>
                      )}
                      {isSuperAdmin && (
                        <Link href={`/admin/payment-links/${link.id}/edit`} className="text-xs font-medium text-ink hover:underline">
                          Edit (Override)
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {links.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/50">No payment links yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
