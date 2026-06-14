import { Router } from "express";
import { desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { checkJwt, loadUser, requireUser, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createReaderSchema, editReaderSchema, balanceAdjustSchema, PAYOUT_THRESHOLD_CENTS } from "@soulseer/shared";
import { HttpError } from "../middleware/errors.js";
import { adjustBalance, recordPayout } from "../services/ledger.js";
import { stripe, createConnectAccount, createOnboardingLink } from "../integrations/stripe.js";
import { uploadReaderImage } from "../integrations/cloudinary.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const r = Router();
r.use(checkJwt, loadUser, requireUser, requireRole("admin"));

// GET /api/admin/users
r.get("/users", asyncHandler(async (_req, res) => {
  const rows = await db.select({
    id: schema.users.id, email: schema.users.email, username: schema.users.username, fullName: schema.users.fullName,
    role: schema.users.role, accountBalance: schema.users.accountBalance, isOnline: schema.users.isOnline, createdAt: schema.users.createdAt,
  }).from(schema.users).orderBy(desc(schema.users.createdAt));
  res.json(rows);
}));

// POST /api/admin/readers — create reader (image upload + Stripe Connect + onboarding link)
r.post("/readers", validateBody(createReaderSchema), asyncHandler(async (req, res) => {
  const body = req.body as import("zod").infer<typeof createReaderSchema>;
  let imageUrl = body.profileImage;
  // If a data URI was passed in profileImage, upload to Cloudinary.
  if (imageUrl && imageUrl.startsWith("data:")) imageUrl = await uploadReaderImage(imageUrl);

  // Create Stripe Connect Express account for payouts.
  let stripeAccountId: string | null = null;
  let onboardingUrl: string | null = null;
  try {
    stripeAccountId = await createConnectAccount(body.email);
    onboardingUrl = await createOnboardingLink(
      stripeAccountId,
      `${env.clientOrigin}/dashboard`,
      `${env.clientOrigin}/dashboard`
    );
  } catch (e) {
    logger.warn({ err: String(e) }, "stripe connect creation failed (continuing)");
  }

  const [reader] = await db.insert(schema.users).values({
    email: body.email, username: body.username, fullName: body.fullName, role: "reader",
    bio: body.bio ?? null, specialties: body.specialties ?? [], profileImage: imageUrl ?? null,
    pricingChat: body.pricingChat, pricingVoice: body.pricingVoice, pricingVideo: body.pricingVideo,
    stripeAccountId,
  }).returning();

  // NOTE: Admin must also create the Auth0 user (email + initial password) in the
  // Auth0 tenant; on first login the sub is auto-linked by email in /auth/sync.
  res.status(201).json({ reader: { ...reader, stripeAccountId: undefined }, stripeOnboardingUrl: onboardingUrl });
}));

// PATCH /api/admin/readers/:id
r.patch("/readers/:id", validateBody(editReaderSchema), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const body = { ...req.body } as Record<string, unknown>;
  if (typeof body.profileImage === "string" && body.profileImage.startsWith("data:")) {
    body.profileImage = await uploadReaderImage(body.profileImage as string);
  }
  const [updated] = await db.update(schema.users).set(body).where(eq(schema.users.id, id)).returning();
  if (!updated) throw new HttpError(404, "Reader not found");
  res.json({ ...updated, stripeAccountId: undefined, stripeCustomerId: undefined });
}));

// GET /api/admin/readings
r.get("/readings", asyncHandler(async (_req, res) => {
  const rows = await db.select().from(schema.readings).orderBy(desc(schema.readings.createdAt)).limit(500);
  res.json(rows);
}));

// GET /api/admin/transactions — full ledger
r.get("/transactions", asyncHandler(async (_req, res) => {
  const rows = await db.select().from(schema.transactions).orderBy(desc(schema.transactions.createdAt)).limit(1000);
  res.json(rows);
}));

// POST /api/admin/balance-adjust
r.post("/balance-adjust", validateBody(balanceAdjustSchema), asyncHandler(async (req, res) => {
  const newBalance = await adjustBalance(req.body.userId, req.body.amountCents, req.body.note);
  res.json({ userId: req.body.userId, accountBalance: newBalance });
}));

// POST /api/admin/payouts/:readerId — manual payout via Stripe Connect
r.post("/payouts/:readerId", asyncHandler(async (req, res) => {
  const readerId = Number(req.params.readerId);
  const [reader] = await db.select().from(schema.users).where(eq(schema.users.id, readerId)).limit(1);
  if (!reader || reader.role !== "reader") throw new HttpError(404, "Reader not found");
  if (reader.accountBalance < PAYOUT_THRESHOLD_CENTS) throw new HttpError(409, "Below $15 payout threshold");
  if (!reader.stripeAccountId) throw new HttpError(409, "Reader has no Stripe Connect account");

  const amount = reader.accountBalance;
  const transfer = await stripe.transfers.create({
    amount, currency: "usd", destination: reader.stripeAccountId,
    metadata: { readerId: String(readerId), purpose: "reader_payout" },
  });
  await recordPayout(readerId, amount, transfer.id);
  res.json({ readerId, paidOut: amount, transferId: transfer.id });
}));

// POST /api/admin/refund/:readingId — refund a disputed reading to the client
r.post("/refund/:readingId", asyncHandler(async (req, res) => {
  const readingId = Number(req.params.readingId);
  const [reading] = await db.select().from(schema.readings).where(eq(schema.readings.id, readingId)).limit(1);
  if (!reading) throw new HttpError(404, "Reading not found");
  if (reading.paymentStatus === "refunded") throw new HttpError(409, "Already refunded");
  await adjustBalance(reading.clientId, reading.totalPrice, `Refund for reading #${readingId}`);
  await db.update(schema.readings).set({ paymentStatus: "refunded" }).where(eq(schema.readings.id, readingId));
  res.json({ readingId, refunded: reading.totalPrice });
}));

// GET /api/admin/forum/flagged — review queue
r.get("/forum/flagged", asyncHandler(async (_req, res) => {
  const rows = await db.select().from(schema.forumFlags).where(isNull(schema.forumFlags.reviewedAt)).orderBy(desc(schema.forumFlags.createdAt));
  res.json(rows);
}));

// DELETE /api/admin/forum/posts/:id  &  comments/:id (soft delete)
r.delete("/forum/posts/:id", asyncHandler(async (req, res) => {
  await db.update(schema.forumPosts).set({ deleted: true }).where(eq(schema.forumPosts.id, Number(req.params.id)));
  res.json({ deleted: true });
}));
r.delete("/forum/comments/:id", asyncHandler(async (req, res) => {
  await db.update(schema.forumComments).set({ deleted: true }).where(eq(schema.forumComments.id, Number(req.params.id)));
  res.json({ deleted: true });
}));

export default r;
