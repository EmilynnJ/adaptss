import { Router, raw } from "express";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { checkJwt, loadUser, requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { strictLimiter } from "../middleware/rateLimit.js";
import { createIntentSchema } from "@soulseer/shared";
import { stripe, ensureCustomer } from "../integrations/stripe.js";
import { creditTopUp } from "../services/ledger.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { HttpError } from "../middleware/errors.js";

const r = Router();

// POST /api/payments/createintent — create Stripe PaymentIntent for a top-up
r.post(
  "/payments/createintent",
  checkJwt, loadUser, requireUser, strictLimiter,
  validateBody(createIntentSchema),
  asyncHandler(async (req, res) => {
    const user = req.userRecord!;
    const customerId = await ensureCustomer(user.email, user.stripeCustomerId);
    if (customerId !== user.stripeCustomerId) {
      await db.update(schema.users).set({ stripeCustomerId: customerId }).where(eq(schema.users.id, user.id));
    }
    const intent = await stripe.paymentIntents.create({
      amount: req.body.amountCents,
      currency: "usd",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { userId: String(user.id), purpose: "balance_topup" },
    });
    res.json({ clientSecret: intent.client_secret });
  })
);

// POST /api/webhooks/stripe — raw body, signature verified. Public (Stripe only).
export const stripeWebhookHandler = [
  raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) throw new HttpError(400, "Missing signature");
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig as string, env.stripe.webhookSecret);
    } catch (err) {
      logger.warn({ err: String(err) }, "stripe webhook signature verification failed");
      return res.status(400).send("Invalid signature");
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as import("stripe").Stripe.PaymentIntent;
      const userId = Number(pi.metadata?.userId);
      if (userId && pi.metadata?.purpose === "balance_topup") {
        // Idempotency: skip if this stripe id is already recorded.
        const [seen] = await db.select({ id: schema.transactions.id }).from(schema.transactions).where(eq(schema.transactions.stripeId, pi.id)).limit(1);
        if (!seen) {
          await creditTopUp(userId, pi.amount_received, pi.id);
        }
      }
    }
    res.json({ received: true });
  }),
];

// GET /api/transactions — current user's transaction history
r.get(
  "/transactions",
  checkJwt, loadUser, requireUser,
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, req.userRecord!.id))
      .orderBy(desc(schema.transactions.createdAt))
      .limit(200);
    res.json(rows);
  })
);

export default r;
