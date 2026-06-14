# SoulSeer Launch Checklist

Repo: github.com/EmilynnJ/adaptss · Code is production-level, type-checks, builds, and was run end-to-end against the live Neon DB + Redis.

## DONE (verified live by Adapt)
- [x] Monorepo (shared/server/client), TypeScript strict, builds clean.
- [x] Neon connected. App tables live in a dedicated `soulseer` Postgres schema (isolated from the legacy tables already in that database). Migration: `server/drizzle/0000_init.sql`. Admin + 2 sample readers seeded.
- [x] Redis connected (active-session billing state; no cron jobs).
- [x] Stripe secret key verified (charges enabled). Top-up PaymentIntent + signature-verified webhook wired.
- [x] Agora token generation verified (App ID + certificate valid). RTC (voice/video) + RTM (chat) wired client-side.
- [x] Auth0 verified (JWKS reachable, domain dev-2x1dti3irhuz62jc.us.auth0.com). JWT validation on all protected routes; role in DB; user sync on first login.
- [x] Client build embeds real VITE config (Auth0, Stripe publishable, Agora App ID).
- [x] Production single-process: Express serves the built client + API on one PORT.
- [x] Admin create-reader generates an initial password and creates the Auth0 login (when M2M is configured) + Stripe Connect account + onboarding link.
- [x] Chat transcript persistence at session end; GDPR account-deletion endpoint + UI.

## REQUIRES YOUR DASHBOARD ACTION (not code — external accounts)
- [ ] **Stripe Connect**: enable Connect on your Stripe account (dashboard.stripe.com/connect). Until then reader creation still works but payout/onboarding is skipped. Code is ready.
- [ ] **Cloudinary**: set `CLOUDINARY_CLOUD_NAME` (only API key + secret are in env). Until then, upload reader images by pasting an image URL in the create/edit reader form.
- [ ] **Auth0 (full auto reader creation)**: provide an Auth0 M2M app with `create:users`/`delete:users` scopes as `AUTH0_MGMT_CLIENT_ID` / `AUTH0_MGMT_CLIENT_SECRET`. Without it, the app falls back: admin creates the reader's Auth0 login manually (auto-links by email on first login).
- [ ] **Auth0 config**: add Google + Apple social connections; set Allowed Callback/Logout/Web Origins to your deployed client URL(s).
- [ ] **Stripe webhook**: add endpoint -> POST /api/webhooks/stripe, event `payment_intent.succeeded`; confirm `STRIPE_WEBHOOK_SIGNING_SECRET`.
- [ ] **Community links**: set `VITE_DISCORD_INVITE_URL` and `VITE_FACEBOOK_GROUP_URL`.

## DEPLOY
- Build: `npm install && npm run build`  ·  Start: `NODE_ENV=production npm start`
- Server env: copy `.env.example`, fill values (use the Neon connection string; the app targets the `soulseer` schema automatically).
- Client build env: provide `VITE_*` vars (or a `client/.env`) at build time so Vite embeds them. For single-origin deploy leave `VITE_API_BASE_URL` empty.

## APP STORE (native wrapper — your stated final step)
- Wrap the built client with Capacitor (`@capacitor/ios`), configure Sign in with Apple, app icons/splash, privacy labels; submit via your Apple Developer account.
