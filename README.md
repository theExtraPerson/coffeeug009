# CoffeeUG

Coffee processing plants you activate with your wallet. Every active plant pays
**10% of its price per day for 30 days**, credited at **10PM Africa/Kampala**.
Referrals pay **6%** on level 1 and **1%** on level 2 of every plant a downline
member activates. Withdrawals carry a **10% fee** and start at **UGX 3,000**.
New members get a **UGX 500** signup bonus.

Deposits are automatic through MarzPay mobile money. Withdrawals can be sent
automatically through MarzPay or held for an admin to pay by hand.

Built by CoffeeUG Ltd (`coffeeugltd`), founded October 2026.
Support: [@coffeeug](https://t.me/coffeeug).

## The money model

Every shilling lives in one append-only table, `public.ledger_entries`. A
member's balance is *always* `SUM(amount)` over their entries — there is no
mutable balance column anywhere in the schema. Every credit carries a unique
`key`, so a replayed webhook, a double-clicked button, and a status poll racing
a callback all collapse into the same single entry.

Money only moves through security-definer SQL functions:

| Function | What it does |
| --- | --- |
| `purchase_product` | Debits the wallet, opens the plant, pays both commission levels |
| `claim_daily_income` | Credits one entry per plant per payout day |
| `request_withdrawal` | Creates the PENDING payment that *is* the reservation |
| `settle_payment` | The only place a payment becomes final and writes the ledger |
| `admin_adjust_wallet` | Appends a signed correction, never edits history |

`ledger_append` and `settle_payment` are revoked from `anon` and
`authenticated`, so only the service role and other SQL functions can reach
them. Members hold no insert, update, or delete policy on any money table.

Payments follow `PENDING → PROCESSING → SUCCESS | FAILED | CANCELLED`. Terminal
states are no-ops. A failed withdrawal releases its reservation and touches no
ledger entry, so the member's balance is untouched.

## Setup

### 1. Install

```bash
npm install
```

### 2. Create the database

Run `supabase/migrations/0001_coffeeug_core.sql` against your Supabase project
(SQL Editor, or `supabase db push`). It creates the schema, the RLS policies,
every money function, and seeds the six plants.

### 3. Environment

Copy `.env.example` to `.env.local` and fill it in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MARZPAY_API_USER=
MARZPAY_API_KEY=
NEXT_PUBLIC_SITE_URL=https://your-domain
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. It is what registration, the
webhook, and the admin panel run as.

### 4. Point MarzPay at the webhook

Set the callback to `https://your-domain/api/payments/webhooks/marzpay`. The
route always answers `200` so MarzPay stops retrying, and it settles through
`settle_payment`, so duplicate deliveries are harmless.

### 5. Make yourself an admin

Register through the app, then run:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from public.profiles where username = 'your-username'
on conflict do nothing;
```

After that, `/admin` is reachable from the **Me** tab and you can grant admin to
anyone else by username.

### 6. Run it

```bash
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

## Auth

Members sign in with a username, not an email. Supabase Auth is email-keyed, so
each username is mapped to a deterministic synthetic address
`username@coffeeugltd.app` (`src/lib/username.ts`). Registration happens
server-side in `/api/auth/register` so the account, the profile, the invite
link, the UGX 500 bonus, and the credential mirror all land in one step.

> **Stored passwords.** `public.user_secrets` keeps each member's login password
> in recoverable form so support can read it back, which the admin panel does.
> The table has *no* RLS policies at all — `anon` and `authenticated` cannot
> reach it — and it is only ever read through the service-role client. It is
> still a deliberate tradeoff: a leaked service-role key exposes live
> credentials, so keep that key out of the client bundle and rotate it if it is
> ever exposed.

## Admin panel

`/admin`, tabbed:

- **Overview** — signups today and yesterday, queues needing attention, deposits
  in, withdrawals out, fees collected, and the total wallet liability.
- **Deposits** / **Withdrawals** — approve, reject, or hand a held withdrawal to
  MarzPay. Rejection releases the reservation.
- **Members** — search, then expand for the registration date, first and latest
  deposit dates, the full wallet breakdown, who invited them, their whole
  downline, every activation with both notes, the recent ledger, a signed wallet
  adjustment, ban/unban, and the stored password behind a tap-to-reveal.
- **Activations** — every plant purchase with the member's note and an editable
  private admin note.
- **Plants** — edit price, daily return, days, and visibility, optionally
  applying the change to already-running activations.
- **Admins** — grant or revoke admin by username.
- **Settings** — daily rate, term, payout hour, signup bonus, deposit and
  withdrawal limits, fee rate, withdrawal window, auto-send toggle, Telegram
  links, welcome copy, and a platform freeze.

## Install as an app

`public/manifest.json` plus `public/sw.js` make the site installable. The **App**
button in the bottom nav fires `beforeinstallprompt` on Android and Chrome, and
falls back to Safari's *Add to Home Screen* instructions on iOS.
