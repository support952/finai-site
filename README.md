# finaisolutions.co — Next.js replacement

Code replacement for the WordPress/WooCommerce site at finaisolutions.co / pay.finaisolutions.co.

- **Stack:** Next.js 15 (App Router, TypeScript) · Tailwind v4 · Supabase (Postgres + Auth + Storage, RLS on every table) · Authorize.Net Accept Hosted · Mailgun
- **Areas:** public site · checkout · customer area (`/my-account/`) · admin panel (`/admin/`) · affiliate panel (`/partners/`)
- **Status:** built and unit/RLS-tested. Site copy, policies and per-course data are **placeholders** (see [Content checklist](docs/CONTENT_CHECKLIST.md)). It has not yet run against a live Supabase project or the Authorize.Net sandbox; follow [End-to-end sandbox test](#end-to-end-sandbox-payment-test).

---

## Contents
1. [How a payment works](#how-a-payment-works)
2. [URL map](#url-map)
3. [Setup](#setup)
4. [Environment variables](#environment-variables)
5. [End-to-end sandbox payment test](#end-to-end-sandbox-payment-test)
6. [Tests](#tests)
7. [Security model](#security-model)
8. [AVS / CVV reference](#avs--cvv-reference)
9. [Known limitations](#known-limitations)

---

## How a payment works

```
Customer form (our page) ──POST /api/checkout/──▶ server
   validates every field (zod), resolves offer & PRICE FROM DB (never from client/link),
   checks card blocks, creates pending order (invoiceNumber),
   getHostedPaymentPageRequest: authCaptureTransaction + amount + invoiceNumber + description
     + lineItems + customer.email + customerIP + FULL billTo from the customer's input
     (hosted billing-address fields hidden → can't be overwritten with blanks; CVV required)
   ◀── token
Browser posts token into embedded Authorize.Net iframe → customer types card there only
iframe → /anet/iframe-communicator.html → our page gets transactResponse(transId)
Browser → POST /api/checkout/confirm/ {publicId, transId}
   server calls getTransactionDetailsRequest, checks invoiceNumber + amount, stores result
Authorize.Net → POST /api/webhooks/authorize-net/ (X-ANET-Signature HMAC-SHA512 verified)
   same getTransactionDetailsRequest → same idempotent recordTransaction()
Approved → create customer account, grant course access, Mailgun invoice + welcome (magic link)
Result page /checkout/result/<publicId>/ reads the STORED status only.
```

Stored per transaction: `transId`, status, response code/reason, **avsResultCode**, **cvvResultCode**, card type and last 4, **billTo as recorded by Authorize.Net**, amount, customer IP, submit time. The order holds what the customer typed and the affiliate ID. The admin transactions view flags any difference between the two addresses.

Key files:

| Concern | File |
|---|---|
| billTo mapping (no defaults) | `src/lib/authnet/billto.ts` |
| Hosted page request | `src/lib/authnet/hosted.ts` |
| API client / getTransactionDetails | `src/lib/authnet/client.ts` |
| Webhook signature | `src/lib/authnet/webhook-signature.ts` |
| Webhook route | `src/app/api/webhooks/authorize-net/route.ts` |
| Checkout route | `src/app/api/checkout/route.ts` |
| Store + fulfill + block logic | `src/lib/payments/record.ts`, `fulfill.ts`, `status.ts` |
| Affiliate link signing | `src/lib/links.ts` |
| Schema + RLS | `supabase/migrations/0001_schema.sql`, `0002_storage.sql` |
| Seed (courses, bundles) | `supabase/seed.sql` |
| Company details / card descriptor | `src/config/site.ts` |

## URL map

Kept identical to WordPress (all with a trailing slash):

| Path | Page |
|---|---|
| `/` | Home |
| `/courses/` | Courses (with category filter) |
| `/product/<slug>/` | Course page (WooCommerce product URL) |
| `/product-category/<slug>/` | Category (WooCommerce category URL) |
| `/pricing/` | Bundles |
| `/about/`, `/contact/` | |
| `/terms-conditions/`, `/privacy-policy/`, `/refund-policy/` | Policies (also linked in the footer of every page and on checkout) |
| `/checkout/?offer=<slug>` / `?course=<slug>` | Checkout |
| `/pay/<signed-token>/` | Affiliate payment link |
| `/checkout/result/<publicId>/` | Order result |
| `/my-account/` (+ `/login/`) | Customer "My courses" (WooCommerce My Account path) |
| `/admin/` (+ `/login/`) | Admin panel |
| `/partners/` (+ `/login/`) | Affiliate panel |

Redirects: `/shop/`→`/courses/`, `/cart/`→`/pricing/`, `/my-courses/`→`/my-account/`, `/wp-login.php`→`/my-account/login/`, `/wp-admin/*`→`/admin/`. **Compare against the live sitemap before go-live** (`/sitemap_index.xml` or `/wp-sitemap.xml`) and add any missing paths to `redirects()` in `next.config.ts`.

## Setup

### 1. Install
```bash
npm install
cp .env.example .env.local   # fill in values; never commit .env.local
```

### 2. Supabase
1. Create a project, then link it and apply the migrations (or paste the SQL files into the SQL editor in order):
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   psql "$SUPABASE_DB_URL" -f supabase/seed.sql   # or paste into SQL editor
   ```
2. **Auth → Providers → Email:** keep Email enabled and **turn off "Allow new users to sign up"**. Customer accounts are created by the server after payment, and affiliates by an admin.
3. **Auth → URL Configuration:** Site URL = `NEXT_PUBLIC_SITE_URL`. Add `https://<domain>/auth/confirm/` (and `http://localhost:3000/auth/confirm/`) to Redirect URLs.
4. **Create the first admin:** Auth → Users → *Add user* (email + password, auto-confirm), then in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
5. Storage buckets (`course-files` **private**, `course-images` public) are created by `0002_storage.sql`.
6. Optional: `npm run db:types` generates typed DB rows (then the `any` lint warnings can be cleaned up).

### 3. Authorize.Net sandbox
1. Create a sandbox account at developer.authorize.net.
2. In the sandbox merchant interface (sandbox.authorize.net):
   - **Account → Settings → API Credentials & Keys:** get the API Login ID and a Transaction Key, and generate a **Signature Key**.
   - **Account → Settings → Transaction Details API:** **enable it**. `getTransactionDetailsRequest` fails without it.
   - **Account → Webhooks → Add Endpoint:** URL `https://<your-host>/api/webhooks/authorize-net/` (**with the trailing slash**), JSON, events: `authcapture.created`, `refund.created`, `void.created`, `fraud.held`, `fraud.approved`, `fraud.declined`. Webhooks need a public HTTPS URL; for local testing use a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`).
3. Check your credentials (no charge is made):
   ```bash
   npm run sandbox:check
   ```

### 4. Mailgun
Verify the sending domain, then set `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_API_BASE` (US/EU) and `MAIL_FROM`.

### 5. Run
```bash
npm run dev           # http://localhost:3000
npm run build && npm start
```

## Environment variables

All secrets come from env vars only. Nothing is hardcoded, and the logger redacts secret-looking keys and card-like numbers (`src/lib/log.ts`).

| Name | Secret? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | no | Absolute site URL (links, return URLs, emails) |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no (public) | Browser/RLS client |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Server-only: checkout, webhook, fulfillment, signed URLs |
| `AUTHNET_ENV` | no | `sandbox` (default) or `production` |
| `AUTHNET_ALLOW_PRODUCTION` | no | Must be `true` for production (second safety switch) |
| `AUTHNET_API_LOGIN_ID` | **yes** | API login |
| `AUTHNET_TRANSACTION_KEY` | **yes** | API transaction key |
| `AUTHNET_SIGNATURE_KEY` | **yes** | Verifies `X-ANET-Signature` |
| `LINK_SIGNING_SECRET` | **yes** | HMAC for affiliate links (≥ 32 chars) |
| `MAILGUN_API_KEY` | **yes** | Mailgun |
| `MAILGUN_DOMAIN` | no | Mailgun sending domain |
| `MAILGUN_API_BASE` | no | `https://api.mailgun.net` or `https://api.eu.mailgun.net` |
| `MAIL_FROM` | no | From header |

## End-to-end sandbox payment test

Prerequisites: steps 1–5 of [Setup](#setup) done with **sandbox** credentials, the app reachable over HTTPS (deployed preview or tunnel), and the webhook endpoint registered.

1. `npm run sandbox:check` prints two `OK` lines.
2. Open `/pricing/` and click **Buy Starter**.
3. Fill in the billing form with a real-looking US address (e.g. `1 Main St, Louisa, VA 23093`), your own email and a phone number. Tick the terms box and click **Continue to secure payment**.
4. The Authorize.Net form loads inside the page. It shows the order (Starter bundle, $250.00) and asks only for card number, expiry and CVV.
5. Pay with sandbox card `4111 1111 1111 1111`, any future expiry, CVV `900`.
6. You land on `/checkout/result/<id>/`. It shows **Thank you** once the stored status is `approved`, and auto-refreshes while `pending`.
7. Check:
   - **Admin → Transactions:** the row shows status `approved`, `Visa •••• 1111`, an AVS code, CVV `M`, the transId, and "billTo matches Authorize.Net".
   - **sandbox.authorize.net → Transaction Search:** the transaction shows invoice number, description, line item, customer email, IP and the full billing address you typed.
   - Your inbox has the invoice and the welcome email with a sign-in link. The link opens `/my-account/` with exactly the 3 Starter courses.
   - Re-sending the webhook from the Authorize.Net webhook screen changes nothing (idempotent).
8. **Decline + card block:** start two more checkouts with the **same email** and pay with `4111 1111 1111 1111` using ZIP **46282**, which the sandbox declines (see Authorize.Net's testing guide). After the second decline, **Admin → Card blocks** shows an active block and a new checkout for that email is refused. Click **Release** to unblock.
9. **Affiliate flow:** Admin → Affiliates → *New affiliate* (use an email you control), tick an offer, and set the password from the email. Sign in at `/partners/`, generate a link and pay through it. The sale appears in the partner panel (date, offer, amount, status, last 4, email, phone) and in Admin → Reports under that affiliate. Tamper with any character of the link and it is rejected.
10. **Refund:** refund the transaction in the sandbox (after settlement) or click *Mark refunded* in admin. The order becomes `refunded` and the courses disappear from `/my-account/`.

Use the CVV and ZIP triggers in Authorize.Net's testing guide (developer.authorize.net → Testing Guide) to produce specific AVS/CVV codes. The CVV values above follow that guide; double-check them against the current version.

## Tests

```bash
npm test          # all tests (72)
npm run typecheck
npm run lint
```

| File | Proves |
|---|---|
| `tests/links.test.ts` | Signed links verify; changed affiliate/offer, injected price, wrong secret, truncated/malformed tokens are all rejected; tokens contain no price |
| `tests/billto.test.ts` | **Every billTo field comes from customer input** (each input change shows up, empty values throw instead of defaulting, no invented company, XSD order); request has authCapture, amount, invoice, description, line item, email, IP; hosted billing address hidden; CVV required |
| `tests/webhook-signature.test.ts` | HMAC-SHA512 verification (good / tampered body / wrong key / malformed header), and the route returns 401 **without touching DB or Authorize.Net** |
| `tests/rls.test.ts` | Against a **real PostgreSQL** running these migrations: affiliate A can't read B's sales/links/offers/affiliate record even with explicit filters; affiliates can't read orders/transactions/blocks; can't modify sales or links; can't promote themselves; can't run admin reports; disabled affiliates see nothing; customers see only their own orders/files (and lose them on revocation); anonymous users see only the public catalogue; every public table has RLS enabled |
| `tests/status-and-validation.test.ts` | Status mapping, approved never downgraded by a retry, server-side field validation, log redaction |

The RLS tests start a throwaway Postgres automatically if server binaries are installed (`/usr/lib/postgresql/*/bin`, or set `PG_BIN`). Alternatively, point `TEST_DATABASE_URL` at an empty database. A small stub (`tests/db/supabase-stub.sql`) provides Supabase's `auth.uid()`, roles and default privileges.

## Security model

- **RLS everywhere.** Affiliates can read only: their `affiliates` row, their `affiliate_offers`, offers assigned to them, their `payment_links`, and their rows in `affiliate_sales`, a minimal table with exactly the columns they may see. They have **no** access to `orders` or `transactions`. Admin pages also query with the admin's own session (admin policies); only checkout, webhook and fulfillment use the service role, on the server.
- **No export** exists anywhere in the affiliate panel.
- **Price integrity:** price always comes from the offer or course row in the DB. Links carry only IDs and an HMAC. On confirmation the charged amount must equal the order amount, otherwise the order is marked `error` and not fulfilled.
- **Card data** is entered only in Authorize.Net's iframe and never reaches our server. We store only last 4 and card type, as returned by Authorize.Net.
- **Webhook:** HMAC-SHA512 is verified before anything else, data is re-fetched via `getTransactionDetailsRequest`, and events are de-duplicated by `notificationId` (idempotent). Returns 500 on processing errors so Authorize.Net retries.
- **Rate limits** (Postgres-backed, work on serverless): checkout 10 per 10 min per IP, confirm 30 per 10 min, webhook 300 per min per IP, magic link 5 per 15 min per IP and 3 per 15 min per email.
- **Headers:** CSP (frames/forms only to Authorize.Net), HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options; `no-store` and `noindex` on account, admin, checkout and API paths.
- **Production guard:** live Authorize.Net requires both `AUTHNET_ENV=production` and `AUTHNET_ALLOW_PRODUCTION=true`.

## AVS / CVV reference

| AVS | Meaning | Match |
|---|---|---|
| **Y** | Street address and 5-digit ZIP match | full |
| **X** | Street address and 9-digit ZIP match | full |
| **A** | Street address matches, ZIP does not | partial |
| **Z** | 5-digit ZIP matches, street address does not | partial |
| **W** | 9-digit ZIP matches, street address does not | partial |
| **N** | Neither street address nor ZIP match | none |
| **B** | Address information not provided for AVS check | n/a, usually a missing billTo |
| **E** | AVS error | n/a |
| **G** | Non-U.S. card issuing bank | n/a |
| **P** | AVS not applicable for this transaction | n/a |
| **R** | Retry: system unavailable or timed out | n/a |
| **S** | AVS not supported by card issuing bank | n/a |
| **U** | Address information unavailable | n/a |

| CVV | Meaning |
|---|---|
| **M** | Match |
| **N** | No match |
| **P** | Not processed |
| **S** | Should be on card but not indicated |
| **U** | Issuer not certified / no key |

Many **B** results mean the billing address isn't reaching Authorize.Net. This code always sends a full billTo and hides the hosted form's address fields so they can't blank it. The admin transactions page shows AVS and CVV per transaction and the AVS mix for the current filter.

## Known limitations

- **Card block timing.** The card number is typed into Authorize.Net's iframe, so last 4 isn't known before payment. A block (last 4 + email, after 2 declines in 24 h) therefore stops **new checkouts for that email**. Accept Hosted may also let a customer retry inside the same iframe session (token valid about 15 minutes). For harder limits, also enable Authorize.Net's **Velocity / Hourly Velocity** fraud filters.
- **IPv6.** Authorize.Net's `customerIP` accepts IPv4 only. IPv6 visitors are sent without `customerIP`; the full IP is still stored on the order.
- **Chargebacks** don't arrive via webhook. Mark them in admin, which revokes access.
- **Admin "Mark refunded"** records the refund and revokes access but does **not** call Authorize.Net. Issue the refund in the merchant interface; the `refund.created` webhook then updates the order too.
- **Postal code** is required for every country, as specified.
- **Types:** Supabase rows are untyped until `npm run db:types` is run (lint shows `any` warnings).
