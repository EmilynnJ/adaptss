# SoulSeer

**A Community of Gifted Psychics** — pay-per-minute spiritual readings (chat, voice, video) and an on-platform community hub.

This is the **Initial Launch Build** per the SoulSeer build guide. Live streaming, marketplace/shop, virtual gifting, scheduled bookings, and DMs are intentionally deferred to a future phase. The codebase is modular so those can be added without rewriting core systems.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + TypeScript (strict) |
| Backend | Node.js + Express + TypeScript (strict) |
| Shared | `/shared` — Drizzle schema, Zod validation, types |
| Database | Neon (serverless Postgres) via Drizzle ORM |
| Auth | Auth0 (Universal Login, Google + Apple + email) |
| Real-time media | Agora RTC (voice/video) + RTM (chat) |
| Payments | Stripe (top-ups) + Stripe Connect (reader payouts) |
| Session state | Redis (active-session billing — no cron jobs) |
| Images | Cloudinary (reader profile photos) |

## Monorepo layout

```
shared/   Drizzle schema, Zod schemas, constants, shared types
server/   Express API, billing engine, integrations, migrations
client/   Vite React app, theme, pages, Agora/Stripe wiring
```

## Quick start

```bash
npm install
cp .env.example server/.env      # fill in real values
cp .env.example client/.env      # VITE_* vars for the client
npm run build:shared
npm run db:push                  # apply schema to a CLEAN Neon database
npm run db:seed                  # seed admin + sample readers
npm run dev:server               # API on :8080
npm run dev:client               # client on :5173
```

> The migration in `server/drizzle/0000_init.sql` should be applied to a **fresh** Neon database/branch. The existing connected Neon DB contains tables from a prior build attempt; mixing them is unsafe.

## Production (single process)

```bash
npm run build                    # builds shared, server, client
NODE_ENV=production npm start     # Express serves API + client/dist on PORT
```

## Key implementation notes

- **Server-side billing** (`server/src/services/billing.ts`): an in-process interval drives per-minute charges; Redis holds authoritative active-session state. Each tick atomically deducts the client and credits the reader 70% inside a single DB transaction (`services/ledger.ts`). Integer cents only. 2-minute disconnect grace period. Low-balance auto-end.
- **Money safety**: every balance change writes a `transactions` ledger row + structured audit log; Stripe webhook signature verified; balances only credited from verified webhook events; idempotent top-ups; double-deduction guarded by reading status.
- **Auth**: Auth0 RS256 JWT validated on every protected route via JWKS; role stored in our DB (never trusted from client); participant checks on all reading + Agora-token routes.
- **Security**: Helmet, CORS locked to client origin, express-rate-limit (stricter on auth/payment/reading-create), Zod validation on every body, no secrets in logs/responses.
- **Real-time events**: SSE channel (`/api/events`) pushes billing ticks, low-balance, disconnect/reconnect, and session-end. Agora handles ALL reading media.

## What still requires your accounts/config

See `LAUNCH_CHECKLIST.md`.
