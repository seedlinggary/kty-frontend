# Kehilat Tiferet Yisrael (KTY) — Website

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
