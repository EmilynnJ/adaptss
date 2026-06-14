import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { checkJwt, loadUser, requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { syncUserSchema } from "@soulseer/shared";
import { HttpError } from "../middleware/errors.js";

const r = Router();

// POST /api/auth/sync — create internal user on first login (role defaults to client).
r.post(
  "/sync",
  checkJwt,
  validateBody(syncUserSchema),
  asyncHandler(async (req, res) => {
    const sub = req.auth?.sub;
    if (!sub) throw new HttpError(401, "Unauthenticated");
    const { email, username, fullName } = req.body as {
      email: string;
      username?: string;
      fullName?: string;
    };

    const [existing] = await db.select().from(schema.users).where(eq(schema.users.auth0Id, sub)).limit(1);
    if (existing) return res.json(sanitize(existing));

    // Reader/admin accounts are pre-created by admin (matched by email) — link sub on first login.
    const [byEmail] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (byEmail) {
      const [linked] = await db
        .update(schema.users)
        .set({ auth0Id: sub })
        .where(eq(schema.users.id, byEmail.id))
        .returning();
      return res.json(sanitize(linked));
    }

    const baseUsername = (username || email.split("@")[0]).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 60) || "user";
    const uniqueUsername = `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`;
    const [created] = await db
      .insert(schema.users)
      .values({
        auth0Id: sub,
        email,
        username: uniqueUsername,
        fullName: fullName || baseUsername,
        role: "client",
      })
      .returning();
    res.status(201).json(sanitize(created));
  })
);

// GET /api/auth/me
r.get(
  "/me",
  checkJwt,
  loadUser,
  requireUser,
  asyncHandler(async (req, res) => {
    res.json(sanitize(req.userRecord!));
  })
);

// Never return Stripe ids / internal-only sensitive fields.
function sanitize(u: typeof schema.users.$inferSelect) {
  const { stripeAccountId, stripeCustomerId, ...safe } = u;
  return safe;
}

export default r;
