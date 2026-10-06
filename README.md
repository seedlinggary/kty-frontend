# Kehillas Tiferes Yisroel (KTY) — Website

Public site (Home/About, bilingual English/Hebrew) plus a holiday seat-sale system:
families sign up and pay via a NedarimPlus/Matara payment link (no card data ever
touches this site), and an admin panel manages holidays, tracks men's/women's seat
counts, and reconciles payments.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL via Prisma ORM
- NextAuth (credentials) for the admin login
- next-intl for the bilingual public site (English default, `/he` for Hebrew)

## First-time setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Get a Postgres database.** Two options:
   - **Local (development):** run a container —
     ```bash
     docker run -d --name kty-postgres -e POSTGRES_USER=kty -e POSTGRES_PASSWORD=kty -e POSTGRES_DB=kty -p 55432:5432 postgres:16-alpine
     ```
     (`npx prisma dev` also works for a zero-Docker local Postgres, but was unreliable
     in some sandboxed environments during development — Docker is the more dependable
     local option if you hit connection resets.)
   - **Production:** create a free database at [neon.com](https://neon.com) (pairs
     natively with Vercel) and copy its connection string.

3. **Copy `.env.example` to `.env`** and fill in `DATABASE_URL` plus the admin
   credentials. Leave the `NEDARIM_*` vars blank for now — the site works fully
   without them (see below).

4. **Create the schema and seed starter data:**
   ```bash
   npm run db:migrate   # applies prisma/migrations
   npm run db:seed       # creates the first admin login + sample "Yomim Noraim" holiday
   ```

5. **Run it:**
   ```bash
   npm run dev
   ```
   Site: http://localhost:3000 — Admin: http://localhost:3000/admin/login
   (credentials from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`)

## Connecting NedarimPlus (when you're ready)

The site launches and fully works — signups, admin, everything — without any
NedarimPlus configuration. Payment links just show "contact the office" until
you add two values to your environment (in `.env` locally, or your host's
environment variable settings in production):

```
NEDARIM_MOSAD=      # your 7-digit institution number
NEDARIM_APIVALID=   # the ApiValid code
```

Where to find them: log into NedarimPlus at matara.pro, go to the top menu
**עוד** (More) → **מפתחות API** (API Keys). Both values are shown at the top of
that screen. These two are safe to use in a payment link — they are **not**
the same as the secret `ApiPassword` key (starts with `npk_`), which this site
doesn't need, since it never calls the NedarimPlus API directly. Instead it
redirects payers to NedarimPlus's own hosted payment page with the amount and
their details pre-filled and locked.

**Optional but recommended — automatic payment confirmation:** in NedarimPlus,
go to **עוד → Webhook** and set the "עדכוני עסקאות" (transaction updates) URL to:
```
https://YOUR-DOMAIN/api/webhooks/nedarimplus
```
This lets the site automatically mark a signup as paid the moment NedarimPlus
confirms the charge. Without it, staff mark payments as paid manually from
the admin signup list (there's a field for the confirmation number).

## Admin workflows

- **Search** (`/admin/search`): one box - name, email, or phone - searches
  across holiday seats, donations, memberships (with their full payment
  history inline), payment links, other NedarimPlus transactions, untracked
  payment issues, and every congregant form submission, so staff can pull up
  everything about one person without checking each admin page separately.
  NedarimPlus never de-duplicates - the same real person signing up again
  becomes a brand-new unrelated record every time - so Search also lets staff
  check the rows that are the same person (across holiday seats, donations,
  memberships, payment links, and form submissions) and "Combine Checked Rows
  Into One User." That creates (or reuses) a **User** - see
  `/admin/users` - showing their whole combined history in one place.
  Nothing is ever deleted by this: a "Remove from user" link on the User
  page undoes it per record, and the underlying record itself is untouched
  either way, including right back in NedarimPlus. A form submission has no
  fixed name/email columns (its answers are a dynamic JSON blob), so merging
  one in makes a best-effort guess at a name/email/phone by matching the
  form's own field labels - good enough to seed a new User, though in
  practice a submission is usually merged alongside a donation/membership/
  signup that already has real contact fields.
- **The same checking-and-combining works right on every list page it
  applies to** - Donations, Memberships, Holiday Signups, Payment Links,
  Other NedarimPlus Transactions, and each Form's Responses - not just
  centrally on Search. A name spelled differently across languages, or a
  different email on a second attempt, can be obvious at a glance on the
  list you're already looking at even when neither value alone would turn up
  as a text-search match. Each of those pages also has a "Group by user"
  checkbox, checked by default, that clusters every row already linked to
  the same User together (with whatever's still unlinked kept visible
  underneath, never hidden) - uncheck it to go back to the plain,
  unclustered table.
- **Possible Duplicates** (on `/admin/users`): staff don't have to spot
  matches by eye at all - this section scans every donation, membership,
  holiday seat, payment link, other transaction, and form submission for
  ones sharing the same email or phone number (normalized - case/whitespace
  for email, digits-only for phone) that aren't combined onto the same
  User yet, and recommends combining them, with one button that runs the
  same non-destructive combine used everywhere else. It's a recommendation,
  not an automatic change - nothing merges until staff click it, and an
  oddly large match (e.g. a shared office email on many unrelated records)
  is left out rather than shown as a wall of false positives.
- **Holidays** (`/admin/holidays`): create a new holiday any time — Sukkos,
  Pesach, next year's Yomim Noraim, etc. Each holiday has its own member/
  non-member seat price and an open/closed toggle. Creating one immediately
  makes it available at `/seats/<slug>` on the public site if marked open.
- **Signups** (`/admin/holidays/[id]/signups`): every signup, its men's/
  women's seat counts, status, and a "Create Bill" button to build a
  reservation + payment link on behalf of a family (e.g. over the phone).
- **Site Settings** (`/admin/settings`): edit the About text, address, phone,
  email, hero tagline, and davening times shown on the public site — no
  redeploy needed.
- **Donations** (`/admin/donations`): every one-time donation from `/donate`
  (any amount, bilingual), with Mark Paid / Cancel / Flag Failed actions.
  `/donate` also has a tab to switch to the membership form inline, so either
  page works as an entry point to both.
- **Memberships** (`/admin/memberships`): monthly recurring dues from
  `/membership` (Associate ₪100 or Full ₪200), charged via NedarimPlus's
  standing-order ("Keva") mechanism rather than a one-time payment. "Payment
  History" on each row opens a full detail page with every charge NedarimPlus
  has reported for that member (date, amount, confirmation), plus any
  flagged payment issues for them.
- **Import from NedarimPlus** (on `/admin/memberships`, super admin only,
  needs `NEDARIM_APIPASSWORD` - same requirement as the automatic
  membership-decline check below): pulls in every standing order NedarimPlus
  already has on file - including ones set up directly on their own site
  before this system existed - and creates a Membership here for any one we
  don't already have (matched by NedarimPlus's own KevaId), along with its
  real signup date and its full past payment history (each past charge
  becomes a normal Transaction, matched by NedarimPlus's own transaction ID
  so nothing is ever duplicated). Safe to run again any time, including
  just to re-sync: anything already on file - a membership, a past payment -
  is matched and skipped, never duplicated, and a membership's status/tier/
  amount are never silently overwritten by a re-sync (only its signup date,
  since that has no admin-editable UI anywhere to begin with). Strictly
  read-only against NedarimPlus - it only calls their GetKevaJson/GetKevaId
  reports; nothing is ever written back or changed on their side.
  NedarimPlus also reports, per standing order, how many payments have been
  made and (per their own count) how many remain - shown on the membership's
  detail page as "Payment Term" when NedarimPlus reports one; a blank/zero
  remaining commonly means no fixed end, though it's worth checking
  NedarimPlus's own dashboard directly for a specific order if a number
  looks off, since their docs don't spell out every edge case.
  "Past Due" can come from either this import/re-sync noticing NedarimPlus
  reported a decline on the last charge attempt, or from the system's own
  daily check (see Payment Follow-Ups below) noticing an expected charge
  simply never arrived - whichever notices first.
  Anywhere this import fills in or guesses a value instead of using one
  NedarimPlus actually reported, a small ⓘ appears next to it (hover for
  why) - today that's a past charge's amount, when NedarimPlus's own
  history didn't report one for that specific payment (confirmed to
  happen - their docs only promise a blank amount for a declined/cancelled
  charge, not a guarantee for every successful one; this fills in the
  membership's own recurring rate instead of showing a wrong ₪0), and a
  membership's Tier, which NedarimPlus has no concept of at all - it's
  always guessed here by comparing the charge amount to our own Associate/
  Full price points. Nothing with a real reported value gets a mark.
  NedarimPlus's date fields have turned up in more than one shape in
  practice (plain DD/MM/YYYY, a classic ASP.NET date wrapper, raw epoch
  numbers) - import/re-sync tries each in turn and logs anything it still
  can't recognize, rather than silently defaulting to "now." Every date
  shown anywhere in `/admin` spells the month out (e.g. "8 Jan 2027") rather
  than a bare numeric date, specifically to avoid the day/month ambiguity
  that caused a real bug here (a slash-separated date reads as day-month to
  some people and month-day to others).
- Both forms require an email (the one reliable way to reach someone about a
  failed payment) and collect phone/address/city without requiring them -
  worded as plain fields rather than "(optional)," since the goal is still to
  capture that info whenever it's given, not to signal it's skippable.
  Address and city are also passed through as NedarimPlus's own `Street`/
  `City` payment-link params, so they're pre-filled on the NedarimPlus page
  instead of being asked for twice.
- **Payment Links** (`/admin/payment-links`): a super admin can create a
  fixed, predetermined-amount link for a pledge, event fee, or correcting an
  underpayment, so someone can just pay that exact amount.
- **Payment Follow-Ups** (`/admin/payment-follow-ups`): NedarimPlus never
  tells us directly when a card is declined — only successes trigger the
  webhook. So anything that stays PENDING for more than 2 hours (checked
  daily, see `vercel.json`) gets flagged automatically here as a likely
  failure; staff can also flag one by hand right away after reading a
  forwarded NedarimPlus decline email. "Send Email" (one at a time or all at
  once) sends a bilingual follow-up with a fresh payment link. If someone
  retries and it goes through, the follow-up resolves itself automatically —
  nothing to track by hand.
  "+ Paste a Decline Email" on this page parses NedarimPlus's actual decline
  notification email (paste the full body) and matches it automatically to
  the right donation/membership/bill if it's one of ours (by the comment
  reference, or by order number against a known membership's standing-order
  ID), or tracks it on its own with the email's contact details if it's a
  decline on something our system never created (e.g. a pre-existing standing
  order). The first time an email is sent for one of those standalone cases,
  a real Payment Link is generated for it automatically, so from then on a
  successful retry closes the loop exactly like everything else.
  If `NEDARIM_APIPASSWORD` is set, memberships get a genuinely automatic
  check too (no email involved at all): the same daily job calls NedarimPlus's
  standing-order reporting API, which does expose a real decline reason per
  standing order (unlike one-time payments, where NedarimPlus has no decline
  data available at all, by their own documentation).
- **Other Transactions** (`/admin/other-transactions`): any successful
  NedarimPlus payment that doesn't match one of our own links (a pre-existing
  standing order set up directly in NedarimPlus, or any other payment link
  shared outside this app) is still recorded here rather than silently
  dropped, so staff have a complete picture of everything coming through the
  Mosad.
- **Super admin overrides**: a `SUPERADMIN`-role admin (the seeded admin is
  one by default) can directly overwrite a donation/membership/payment-link's
  recorded details from an "Edit (Override)" link, and is the only role that
  can create a new Payment Link. A plain `ADMIN` can view everything and send
  follow-up emails, but not freehand-edit a payment record.
  **Everything on this list is local-only** - every override, cancel,
  reactivate, and mark-paid action only updates our own database.
  NedarimPlus's own standing order/charge is completely untouched by any of
  it, there's no refund/reversal capability anywhere, and cancelling a
  membership here does **not** stop the real recurring charge - the actual
  standing order has to be cancelled directly in NedarimPlus (or see Live
  Actions below). If NedarimPlus charges a membership again after it's
  marked Cancelled here, the charge is still recorded (the money really
  moved) but the status is deliberately **not** silently flipped back to
  Active - a banner on that membership's page flags it instead, since
  otherwise the mismatch would be invisible.
  If an override amount differs from NedarimPlus's last confirmed charge,
  the edit form shows that amount and asks for confirmation before saving -
  a reminder that this only changes our records, not NedarimPlus's.
  Every override, cancel, reactivate, mark-paid, and signup correction is
  logged to an audit trail (who, when, before → after for every changed
  field) shown as "Change History" on the relevant edit/detail page - a
  one-way record, never itself editable. Cancelling anything (a donation,
  membership, bill, or payment link) requires confirming twice, the second
  time by typing "CANCEL" - a reflexive double-click can't sail through
  both. None of this is a substitute for reconciling against NedarimPlus's
  own dashboard directly, especially for anything these overrides touch.
- **NedarimPlus Live Actions (membership detail page, `SUPERADMIN` only,
  needs `NEDARIM_APIPASSWORD`) - genuinely still in testing.** Unlike every
  other action in this app, these make a **real, live change on
  NedarimPlus's own standing order** - not just our own records:
  - **Update amount** (`UpdateKevaNew`) - changes the actual monthly charge
    and/or payments-remaining count on the real standing order, then syncs
    our own `monthlyAgorot` to match. Shows NedarimPlus's last confirmed
    charge next to the field first, since our own number can drift from
    reality if someone used the local-only Edit (Override) before - that
    discrepancy is shown, not silently papered over, before you commit a
    real change on top of it.
  - **Freeze / Disable** (`DisableKeva`) and **Re-enable** (`EnableKevaNew`)
    - pauses/resumes real charging. Reversible on NedarimPlus's side.
  - **Delete (Permanent)** (`DeleteKeva`) - permanently deletes the real
    standing order. Irreversible there.
  Every one of these requires confirming twice - a dialog, then typing a
  specific word (DISABLE/ENABLE/DELETE/UPDATE) - and every attempt (success
  *or failure*) is logged to the same audit trail, visibly tagged **LIVE**
  so it's never confused with a local-only change. None of these ever
  delete the Membership row itself: a real delete/disable only sets
  `nedarimDeletedAt`/`nedarimDisabledAt` timestamps and flips `status`
  locally to match reality - the record stays, just marked. A permanently
  deleted standing order can't be re-enabled (on NedarimPlus or here); the
  whole section hides itself once that's happened, since there's nothing
  left to safely act on.

## Notes

- Money is stored in agorot (integer) internally to avoid floating-point
  rounding on real payments.
- The webhook at `/api/webhooks/nedarimplus` verifies the request comes from
  NedarimPlus's documented IP addresses before trusting it.
- `npm run db:studio` opens Prisma Studio if you want to browse the database
  directly.

## Deploying (Vercel + Supabase)

**One Vercel project is all you need.** This is a single Next.js app — the
public site, the admin panel, and the API routes (auth + NedarimPlus webhook)
all live in the same app and deploy together as one Vercel deployment.
Supabase isn't something you deploy "to" — it's a separate hosted Postgres
database that this one app connects to over a connection string.

### 1. Create the Supabase database

In your Supabase project: **Connect** (top of the dashboard) → copy the
**Session pooler** connection string (port `5432`, host ending in
`pooler.supabase.com`), not the "Transaction pooler" (port `6543`) one.

Session pooler is the right choice here: it behaves like a normal persistent
connection (so Prisma's prepared statements just work, no extra config),
and it's IPv4-compatible, which Vercel's serverless functions need (Supabase's
plain "direct connection" is IPv6-only unless you pay for the IPv4 add-on).
This app's traffic is small enough that session pooler's connection limit is
plenty — if that ever changes, the transaction pooler (port 6543) supports far
more connections but requires appending `?pgbouncer=true` to disable prepared
statements, and a separate `DIRECT_URL` for running migrations.

Use that connection string as `DATABASE_URL`.

### 2. Push to GitHub, import into Vercel

Import the repo as a new Vercel project (framework auto-detected as Next.js,
no config needed). Don't deploy yet — set env vars first.

### 3. Set environment variables in Vercel (Project Settings → Environment Variables)

Every var from `.env.example`, with two changes for production:
- `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` → your real deployed URL (e.g.
  `https://kty-shul.vercel.app`, or your custom domain once attached). You'll
  know the `.vercel.app` URL only after the first deploy — deploy once with a
  placeholder, then come back and correct these two, then redeploy.
- `DATABASE_URL` → the Supabase session pooler string from step 1.

### 4. Apply the schema and seed the first admin

From your own machine, temporarily point `.env`'s `DATABASE_URL` at the same
Supabase connection string and run:
```bash
npx prisma migrate deploy   # applies existing migrations, safe for production
npm run db:seed              # creates the first admin login
```
(`migrate deploy`, not `migrate dev` — `dev` is only for creating new
migrations locally.) Switch `.env` back to your local database afterward.

### 5. Deploy, then connect NedarimPlus's webhook

Once live, set the webhook URL in NedarimPlus (**עוד → Webhook**) to
`https://your-real-domain/api/webhooks/nedarimplus` — see the section above.

Any future schema change: run `npx prisma migrate dev` locally to create the
migration, commit it, then run `npx prisma migrate deploy` against the
Supabase database (or wire it into a Vercel deploy hook) before/with that
deploy.

Sources: [Supabase + Prisma connection guide](https://supabase.com/docs/guides/database/prisma), [Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)
