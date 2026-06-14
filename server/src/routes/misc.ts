import { Router, type Request } from "express";
import { expressjwt, type GetVerificationKey } from "express-jwt";
import jwksRsa from "jwks-rsa";
import { db, schema } from "../db/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { loadUser, requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { newsletterSchema } from "@soulseer/shared";
import { subscribe } from "../services/notifier.js";
import { env } from "../config/env.js";

const r = Router();

// Health
r.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Newsletter signup (home page)
r.post("/newsletter", validateBody(newsletterSchema), asyncHandler(async (req, res) => {
  await db.insert(schema.newsletterSignups).values({ email: req.body.email }).onConflictDoNothing();
  res.status(201).json({ subscribed: true });
}));

// SSE auth accepts a token via ?access_token= (EventSource cannot set headers).
const checkJwtSse = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true, rateLimit: true, jwksRequestsPerMinute: 10,
    jwksUri: `https://${env.auth0.domain}/.well-known/jwks.json`,
  }) as GetVerificationKey,
  audience: env.auth0.audience,
  issuer: `https://${env.auth0.domain}/`,
  algorithms: ["RS256"],
  getToken: (req: Request) =>
    (req.query.access_token as string) ||
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined),
});

// SSE events stream for session/billing notifications (Agora handles all media).
r.get("/events", checkJwtSse, loadUser, requireUser, (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  res.write(": connected\n\n");
  const cleanup = subscribe(req.userRecord!.id, res);
  req.on("close", cleanup);
});


export default r;
