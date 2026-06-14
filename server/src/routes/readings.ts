import { Router } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { checkJwt, loadUser, requireUser, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { strictLimiter } from "../middleware/rateLimit.js";
import { createReadingSchema, rateReadingSchema, MIN_BALANCE_TO_START_CENTS } from "@soulseer/shared";
import { HttpError } from "../middleware/errors.js";
import { buildRtcToken, buildRtmToken, channelForReading } from "../integrations/agora.js";
import { env } from "../config/env.js";
import { startSession, endSession } from "../services/billing.js";
import { emitToUser } from "../services/notifier.js";

const r = Router();
const auth = [checkJwt, loadUser, requireUser];

// Ensure requesting user is a participant of the reading.
async function getParticipantReading(req: import("express").Request, readingId: number) {
  const [reading] = await db.select().from(schema.readings).where(eq(schema.readings.id, readingId)).limit(1);
  if (!reading) throw new HttpError(404, "Reading not found");
  const uid = req.userRecord!.id;
  if (reading.clientId !== uid && reading.readerId !== uid) throw new HttpError(403, "Not a participant");
  return reading;
}

// POST /api/readings/on-demand — client creates a request
r.post(
  "/on-demand",
  ...auth, requireRole("client"), strictLimiter,
  validateBody(createReadingSchema),
  asyncHandler(async (req, res) => {
    const client = req.userRecord!;
    const { readerId, type } = req.body as { readerId: number; type: "chat" | "voice" | "video" };

    const [reader] = await db.select().from(schema.users).where(and(eq(schema.users.id, readerId), eq(schema.users.role, "reader"))).limit(1);
    if (!reader) throw new HttpError(404, "Reader not found");
    if (!reader.isOnline) throw new HttpError(409, "Reader is offline");

    const price = type === "chat" ? reader.pricingChat : type === "voice" ? reader.pricingVoice : reader.pricingVideo;
    if (price <= 0) throw new HttpError(409, "Reader does not offer this reading type");

    // Minimum balance check before creating session.
    if (client.accountBalance < MIN_BALANCE_TO_START_CENTS) {
      throw new HttpError(402, "Minimum $5 balance required. Please add funds.");
    }

    const [reading] = await db
      .insert(schema.readings)
      .values({ readerId, clientId: client.id, type, pricePerMinute: price, status: "pending" })
      .returning();

    emitToUser(readerId, { kind: "reading_request", readingId: reading.id, clientName: client.fullName, type });
    res.status(201).json(reading);
  })
);

// POST /api/readings/:id/accept — reader accepts
r.post(
  "/:id/accept",
  ...auth, requireRole("reader"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const reading = await getParticipantReading(req, id);
    if (reading.readerId !== req.userRecord!.id) throw new HttpError(403, "Not your reading");
    if (reading.status !== "pending") throw new HttpError(409, "Reading is not pending");
    const [updated] = await db.update(schema.readings).set({ status: "accepted" }).where(eq(schema.readings.id, id)).returning();
    emitToUser(reading.clientId, { kind: "reading_accepted", readingId: id });
    res.json(updated);
  })
);

// POST /api/readings/:id/agora-token — participants only
r.post(
  "/:id/agora-token",
  ...auth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const reading = await getParticipantReading(req, id);
    const channel = channelForReading(id);
    const uid = req.userRecord!.id;
    const token = reading.type === "chat" ? buildRtmToken(uid) : buildRtcToken(channel, uid);
    res.json({ appId: env.agora.appId, channel, uid, token, type: reading.type });
  })
);

// POST /api/readings/:id/start — mark both joined, start server-side billing
r.post(
  "/:id/start",
  ...auth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const reading = await getParticipantReading(req, id);
    if (reading.status === "in_progress") return res.json(reading);
    if (reading.status !== "accepted") throw new HttpError(409, "Reading not accepted yet");

    // Re-check client funds before any billing begins.
    const [client] = await db.select().from(schema.users).where(eq(schema.users.id, reading.clientId)).limit(1);
    if (!client || client.accountBalance < reading.pricePerMinute) {
      await db.update(schema.readings).set({ status: "cancelled" }).where(eq(schema.readings.id, id));
      throw new HttpError(402, "Insufficient balance to start session");
    }

    await startSession({
      readingId: id,
      clientId: reading.clientId,
      readerId: reading.readerId,
      pricePerMinute: reading.pricePerMinute,
    });
    const [updated] = await db.select().from(schema.readings).where(eq(schema.readings.id, id)).limit(1);
    res.json(updated);
  })
);

// POST /api/readings/:id/end — either party ends; finalize billing
r.post(
  "/:id/end",
  ...auth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const reading = await getParticipantReading(req, id);
    // For chat sessions, persist the transcript sent by the client (content only;
    // never trusted for billing). Billing duration is always server-side.
    if (reading.type === "chat" && Array.isArray(req.body?.transcript)) {
      const transcript = (req.body.transcript as unknown[]).slice(0, 2000);
      await db.update(schema.readings).set({ chatTranscript: transcript as never }).where(eq(schema.readings.id, id));
    }
    await endSession(id, "ended_by_participant");
    const [updated] = await db.select().from(schema.readings).where(eq(schema.readings.id, id)).limit(1);
    res.json(updated);
  })
);

// POST /api/readings/:id/rate — client submits rating + review
r.post(
  "/:id/rate",
  ...auth, requireRole("client"),
  validateBody(rateReadingSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const reading = await getParticipantReading(req, id);
    if (reading.clientId !== req.userRecord!.id) throw new HttpError(403, "Only the client can rate");
    if (reading.status !== "completed") throw new HttpError(409, "Reading not completed");
    const [updated] = await db
      .update(schema.readings)
      .set({ rating: req.body.rating, review: req.body.review ?? null })
      .where(eq(schema.readings.id, id))
      .returning();
    res.json(updated);
  })
);

// GET /api/readings/client — client history
r.get("/client", ...auth, requireRole("client"), asyncHandler(async (req, res) => {
  const rows = await db
    .select()
    .from(schema.readings)
    .where(eq(schema.readings.clientId, req.userRecord!.id))
    .orderBy(desc(schema.readings.createdAt));
  res.json(rows);
}));

// GET /api/readings/reader — reader session history (clients anonymized in client)
r.get("/reader", ...auth, requireRole("reader"), asyncHandler(async (req, res) => {
  const rows = await db
    .select()
    .from(schema.readings)
    .where(eq(schema.readings.readerId, req.userRecord!.id))
    .orderBy(desc(schema.readings.createdAt));
  res.json(rows);
}));

// GET /api/readings/active — current pending/accepted/in_progress for either party
r.get("/active", ...auth, asyncHandler(async (req, res) => {
  const uid = req.userRecord!.id;
  const rows = await db
    .select()
    .from(schema.readings)
    .where(
      and(
        or(eq(schema.readings.clientId, uid), eq(schema.readings.readerId, uid)),
        or(eq(schema.readings.status, "pending"), eq(schema.readings.status, "accepted"), eq(schema.readings.status, "in_progress"))
      )
    )
    .orderBy(desc(schema.readings.createdAt));
  res.json(rows);
}));

// GET /api/readings/:id — single reading detail (participants only)
r.get("/:id", ...auth, asyncHandler(async (req, res) => {
  const reading = await getParticipantReading(req, Number(req.params.id));
  res.json(reading);
}));

export default r;
