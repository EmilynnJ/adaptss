import { Router } from "express";
import { and, asc, eq, or } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { checkJwt, loadUser, requireUser, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { sendMessageSchema, readerReplySchema } from "@soulseer/shared";
import { HttpError } from "../middleware/errors.js";
import { adjustBalance } from "../services/ledger.js";

// Premium messaging: clients message any reader free; readers choose free or charged
// replies. A charged reply requires the client to have sufficient funds to unlock.
const r = Router();
const auth = [checkJwt, loadUser, requireUser];

// POST /api/messages — client sends a free message to a reader
r.post("/", ...auth, requireRole("client"), validateBody(sendMessageSchema), asyncHandler(async (req, res) => {
  const client = req.userRecord!;
  const { readerId, body } = req.body as { readerId: number; body: string };
  const [reader] = await db.select().from(schema.users).where(and(eq(schema.users.id, readerId), eq(schema.users.role, "reader"))).limit(1);
  if (!reader) throw new HttpError(404, "Reader not found");
  const [m] = await db.insert(schema.messages).values({
    clientId: client.id, readerId, senderId: client.id, body, billing: "free", unlocked: true,
  }).returning();
  res.status(201).json(m);
}));

// POST /api/messages/reply — reader replies; may set a charge
r.post("/reply", ...auth, requireRole("reader"), validateBody(readerReplySchema), asyncHandler(async (req, res) => {
  const reader = req.userRecord!;
  const { clientId, body, billing, priceCents } = req.body as { clientId: number; body: string; billing: "free" | "charged"; priceCents?: number };
  if (billing === "charged" && (!priceCents || priceCents <= 0)) throw new HttpError(400, "Charged replies need a price");
  const [m] = await db.insert(schema.messages).values({
    clientId, readerId: reader.id, senderId: reader.id, body,
    billing, priceCents: billing === "charged" ? priceCents! : 0,
    unlocked: billing === "free",
  }).returning();
  res.status(201).json(billing === "charged" ? maskBody(m) : m);
}));

// POST /api/messages/:id/unlock — client pays from balance to read a charged reply
r.post("/:id/unlock", ...auth, requireRole("client"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const client = req.userRecord!;
  const [m] = await db.select().from(schema.messages).where(eq(schema.messages.id, id)).limit(1);
  if (!m || m.clientId !== client.id) throw new HttpError(404, "Message not found");
  if (m.unlocked) return res.json(m);
  if (client.accountBalance < m.priceCents) throw new HttpError(402, "Insufficient balance to unlock");
  await adjustBalance(client.id, -m.priceCents, `Unlock premium message #${id}`);
  await adjustBalance(m.readerId, Math.floor(m.priceCents * 0.7), `Premium message earnings #${id}`);
  const [updated] = await db.update(schema.messages).set({ unlocked: true }).where(eq(schema.messages.id, id)).returning();
  res.json(updated);
}));

// GET /api/messages/thread/:partnerId — conversation, masking locked charged bodies
r.get("/thread/:partnerId", ...auth, asyncHandler(async (req, res) => {
  const me = req.userRecord!;
  const partnerId = Number(req.params.partnerId);
  const rows = await db.select().from(schema.messages)
    .where(or(
      and(eq(schema.messages.clientId, me.id), eq(schema.messages.readerId, partnerId)),
      and(eq(schema.messages.clientId, partnerId), eq(schema.messages.readerId, me.id)),
    ))
    .orderBy(asc(schema.messages.createdAt));
  res.json(rows.map((m) => (m.unlocked || m.senderId === me.id ? m : maskBody(m))));
}));

function maskBody(m: typeof schema.messages.$inferSelect) {
  return { ...m, body: "[Locked — pay to unlock this reply]" };
}

export default r;
