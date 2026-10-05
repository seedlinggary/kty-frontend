import nodemailer from "nodemailer";
import { formatAgorotAsILS } from "@/lib/money";

/**
 * Generic SMTP email sending - works with any provider (Gmail, Office365, a
 * transactional service's SMTP relay, etc.). Nothing sends until these env
 * vars are filled in, exactly like NEDARIM_MOSAD gating payment links - callers
 * should check isEmailConfigured() and handle the "not set up yet" case.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  return cachedTransport;
}

export type SendEmailResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email isn't configured yet (SMTP_HOST/SMTP_USER/SMTP_PASSWORD)." };
  }

  try {
    await getTransport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to send email." };
  }
}

/**
 * Bilingual (English first, then Hebrew) follow-up email for a payment that
 * never went through, with a fresh link to retry. Bilingual rather than
 * locale-aware since we often don't know which language the payer prefers.
 */
export function buildPaymentFollowUpEmail(input: {
  fullName: string;
  amountAgorot: number;
  description: string; // e.g. "your donation", "your membership", "Pesach seats"
  descriptionHe: string;
  paymentLink: string | null;
  shulNameEn: string;
  shulNameHe: string;
}): { subject: string; html: string; text: string } {
  const amount = formatAgorotAsILS(input.amountAgorot, "en");
  const amountHe = formatAgorotAsILS(input.amountAgorot, "he");

  const subject = `Payment issue — ${input.description} / בעיה בתשלום`;

  const retryBlockHtml = input.paymentLink
    ? `<p><a href="${input.paymentLink}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Pay Now / שלם כעת</a></p>`
    : `<p>Please contact our office to arrange payment. / אנא צרו קשר עם משרד השול לתשלום.</p>`;
  const retryBlockText = input.paymentLink
    ? `Pay now: ${input.paymentLink}`
    : `Please contact our office to arrange payment.`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <p>Dear ${input.fullName},</p>
      <p>We tried to process a payment of <strong>${amount}</strong> for ${input.description}, but it did not go through successfully. This can happen for a number of reasons (card declined, session timed out, etc.) and is not something you need to worry about - we just wanted to let you know, since we have no other way of reaching you automatically about it.</p>
      ${retryBlockHtml}
      <p>If you've already resolved this or paid another way, you can disregard this email - no need to pay twice.</p>
      <p>Thank you,<br/>${input.shulNameEn}</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #ddd;" />
      <div dir="rtl" style="text-align:right;">
        <p>שלום ${input.fullName},</p>
        <p>ניסינו לעבד תשלום בסך <strong>${amountHe}</strong> עבור ${input.descriptionHe}, אך התשלום לא עבר בהצלחה. הדבר יכול לקרות מכמה סיבות (כרטיס נדחה, פג תוקף החיבור וכו') ואין צורך להיבהל - רצינו רק לעדכן אתכם, מכיוון שאין לנו דרך אחרת להודיע על כך באופן אוטומטי.</p>
        ${input.paymentLink ? `<p><a href="${input.paymentLink}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">שלם כעת</a></p>` : `<p>אנא צרו קשר עם משרד השול לתשלום.</p>`}
        <p>אם כבר פתרתם זאת או שילמתם בדרך אחרת, אין צורך להתייחס למייל זה.</p>
        <p>בתודה,<br/>${input.shulNameHe}</p>
      </div>
    </div>
  `;

  const text = [
    `Dear ${input.fullName},`,
    `We tried to process a payment of ${amount} for ${input.description}, but it did not go through. ${retryBlockText}`,
    `If you've already resolved this, you can disregard this email.`,
    `Thank you, ${input.shulNameEn}`,
    ``,
    `שלום ${input.fullName}, ניסינו לעבד תשלום בסך ${amountHe} עבור ${input.descriptionHe} אך הוא לא עבר בהצלחה.`,
    input.paymentLink ? `לתשלום: ${input.paymentLink}` : `אנא צרו קשר עם המשרד.`,
  ].join("\n");

  return { subject, html, text };
}
