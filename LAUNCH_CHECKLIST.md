# SoulSeer Launch Checklist

Code is complete and builds. These items require your accounts / external dashboards.

## 1. Database (Neon)
- [ ] Create a CLEAN Neon database or branch for this build (do not reuse the old one with leftover tables).
- [ ] Put its connection string in `server/.env` as `NEON_DB_CONNECTION_STRING`.
- [ ] Run `npm run db:push` then `npm run db:seed`.

## 2. Auth0
- [ ] Create a Single Page Application + an API (audience) in your Auth0 tenant.
- [ ] Enable Google and Apple social connections (Apple is required for App Store).
- [ ] Enable email/password database connection.
- [ ] Allowed Callback/Logout/Web Origins must include your client URL(s).
- [ ] Set `VITE_AUTH0_DOMAIN_URL`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_AUTH0_REDIRECT_URI` (client) and `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` (server).
- [ ] For admin-created readers: create their Auth0 user (email + initial password). On first login the account auto-links by email.

## 3. Stripe
- [ ] Use live keys: `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`.
- [ ] Enable Stripe Connect (Express) on your platform account for reader payouts.
- [ ] Add a webhook endpoint -> `POST /api/webhooks/stripe`, subscribe to `payment_intent.succeeded`, and set `STRIPE_WEBHOOK_SIGNING_SECRET`.

## 4. Agora
- [ ] One Agora project with the App Certificate enabled (token auth).
- [ ] Set `AGORA_APP_ID` / `VITE_AGORA_APP_ID` and `AGORA_SECURITY_CERTIFICATE`.

## 5. Cloudinary
- [ ] Set `CLOUDINARY_CLOUD_NAME` (missing from current env), `CLOUDINARY_API_KEY`, `CLOUDINARY_SECRET`.

## 6. Redis
- [ ] Provide `REDIS_DB_HOST/PORT/USERNAME/PASSWORD` (managed Redis recommended in prod).

## 7. Community links
- [ ] Set `VITE_DISCORD_INVITE_URL` and `VITE_FACEBOOK_GROUP_URL` to the real SoulSeer communities.

## 8. App Store submission (native wrapper)
This is a React web app. The Apple App Store needs a native binary. Recommended path:
- [ ] Wrap with **Capacitor** (`@capacitor/ios`), point it at the built client.
- [ ] Configure Sign in with Apple in the native shell + Auth0.
- [ ] Apple Developer account, app icons/splash, privacy nutrition labels, and review submission.
- [ ] Note: pay-per-minute readings are services, not digital goods, so Stripe (not Apple IAP) is generally acceptable — confirm against current App Store Review Guidelines for your category before submission.

## 9. Pre-launch hardening (build guide §16.12-13)
- [ ] Set production CORS origin, rotate any test secrets.
- [ ] Load/penetration test billing, disconnect, and low-balance edge cases.
- [ ] QA mobile responsiveness at 375 / 768 / 1280 px.
