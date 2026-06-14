import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { checkJwt, loadUser, requireUser, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { updateStatusSchema, updatePricingSchema, updateProfileSchema } from "@soulseer/shared";
import { HttpError } from "../middleware/errors.js";
import { deleteAuth0User } from "../integrations/auth0Mgmt.js";

const r = Router();

const publicReaderCols = {
  id: schema.users.id,
  username: schema.users.username,
  fullName: schema.users.fullName,
  bio: schema.users.bio,
  specialties: schema.users.specialties,
  profileImage: schema.users.profileImage,
  pricingChat: schema.users.pricingChat,
  pricingVoice: schema.users.pricingVoice,
  pricingVideo: schema.users.pricingVideo,
  isOnline: schema.users.isOnline,
};

// GET /api/readers — all readers, online first
r.get(
  "/readers",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select(publicReaderCols)
      .from(schema.users)
      .where(eq(schema.users.role, "reader"))
      .orderBy(desc(schema.users.isOnline), desc(schema.users.id));
    res.json(await withRatings(rows));
  })
);

// GET /api/readers/online
r.get(
  "/readers/online",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select(publicReaderCols)
      .from(schema.users)
      .where(and(eq(schema.users.role, "reader"), eq(schema.users.isOnline, true)));
    res.json(await withRatings(rows));
  })
);

// GET /api/readers/:id — single profile with recent reviews
r.get(
  "/readers/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [reader] = await db.select(publicReaderCols).from(schema.users).where(and(eq(schema.users.id, id), eq(schema.users.role, "reader"))).limit(1);
    if (!reader) throw new HttpError(404, "Reader not found");
    const reviews = await db
      .select({
        rating: schema.readings.rating,
        review: schema.readings.review,
        date: schema.readings.completedAt,
        reviewerName: schema.users.fullName,
      })
      .from(schema.readings)
      .innerJoin(schema.users, eq(schema.readings.clientId, schema.users.id))
      .where(and(eq(schema.readings.readerId, id), eq(schema.readings.status, "completed")))
      .orderBy(desc(schema.readings.completedAt))
      .limit(20);
    const rated = reviews.filter((x) => x.rating != null);
    const avg = rated.length ? rated.reduce((s, x) => s + (x.rating ?? 0), 0) / rated.length : 0;
    res.json({ ...reader, rating: Number(avg.toFixed(2)), reviewCount: rated.length, reviews: reviews.filter((x) => x.review) });
  })
);

// PATCH /api/readers/status — toggle online/offline
r.patch(
  "/readers/status",
  checkJwt, loadUser, requireUser, requireRole("reader"),
  validateBody(updateStatusSchema),
  asyncHandler(async (req, res) => {
    const [u] = await db.update(schema.users).set({ isOnline: req.body.isOnline }).where(eq(schema.users.id, req.userRecord!.id)).returning();
    res.json({ isOnline: u.isOnline });
  })
);

// PATCH /api/readers/pricing
r.patch(
  "/readers/pricing",
  checkJwt, loadUser, requireUser, requireRole("reader"),
  validateBody(updatePricingSchema),
  asyncHandler(async (req, res) => {
    const [u] = await db.update(schema.users).set(req.body).where(eq(schema.users.id, req.userRecord!.id)).returning();
    res.json({ pricingChat: u.pricingChat, pricingVoice: u.pricingVoice, pricingVideo: u.pricingVideo });
  })
);

// PATCH /api/readers/profile
r.patch(
  "/readers/profile",
  checkJwt, loadUser, requireUser, requireRole("reader"),
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const [u] = await db.update(schema.users).set(req.body).where(eq(schema.users.id, req.userRecord!.id)).returning();
    res.json({ bio: u.bio, specialties: u.specialties });
  })
);

// GET /api/user/balance
r.get(
  "/user/balance",
  checkJwt, loadUser, requireUser,
  asyncHandler(async (req, res) => {
    res.json({ accountBalance: req.userRecord!.accountBalance });
  })
);

// DELETE /api/user/account — GDPR/CCPA account deletion (anonymize, keep audit ledger)
r.delete(
  "/user/account",
  checkJwt, loadUser, requireUser,
  asyncHandler(async (req, res) => {
    const u = req.userRecord!;
    if (u.role === "admin") throw new HttpError(403, "Admin accounts cannot self-delete");
    if (u.auth0Id) await deleteAuth0User(u.auth0Id);
    await db.update(schema.users).set({
      email: `deleted_${u.id}@soulseer.invalid`,
      username: `deleted_${u.id}`,
      fullName: "Deleted User",
      bio: null,
      profileImage: null,
      auth0Id: null,
      isOnline: false,
    }).where(eq(schema.users.id, u.id));
    res.json({ deleted: true });
  })
);

async function withRatings(readers: Array<{ id: number }>) {
  const result = [];
  for (const reader of readers) {
    const rows = await db
      .select({ rating: schema.readings.rating })
      .from(schema.readings)
      .where(and(eq(schema.readings.readerId, reader.id), eq(schema.readings.status, "completed")));
    const rated = rows.filter((x) => x.rating != null);
    const avg = rated.length ? rated.reduce((s, x) => s + (x.rating ?? 0), 0) / rated.length : 0;
    result.push({ ...reader, rating: Number(avg.toFixed(2)), reviewCount: rated.length });
  }
  return result;
}

export default r;
