import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { readerShareCents } from "@soulseer/shared";
import { logFinancial } from "../utils/logger.js";
import { HttpError } from "../middleware/errors.js";

type TxType = "top_up" | "reading_charge" | "reader_credit" | "payout" | "adjustment";

// Low-level: apply a signed delta to a user's balance + write a ledger row,
// all inside a caller-provided transaction. Returns the new balance.
async function applyDelta(
  tx: typeof db,
  args: {
    userId: number;
    delta: number; // signed cents
    type: TxType;
    readingId?: number | null;
    stripeId?: string | null;
    note?: string;
  }
): Promise<number> {
  const [row] = await tx
    .select({ balance: schema.users.accountBalance })
    .from(schema.users)
    .where(eq(schema.users.id, args.userId))
    .for("update")
    .limit(1);
  if (!row) throw new HttpError(404, "User not found");

  const before = row.balance;
  const after = before + args.delta;
  if (after < 0) throw new HttpError(402, "Insufficient balance");

  await tx
    .update(schema.users)
    .set({ accountBalance: after })
    .where(eq(schema.users.id, args.userId));

  await tx.insert(schema.transactions).values({
    userId: args.userId,
    type: args.type,
    amount: args.delta,
    balanceBefore: before,
    balanceAfter: after,
    readingId: args.readingId ?? null,
    stripeId: args.stripeId ?? null,
    note: args.note ?? null,
  });

  logFinancial({
    op: args.type,
    userId: args.userId,
    type: args.type,
    amountCents: args.delta,
    balanceBefore: before,
    balanceAfter: after,
    readingId: args.readingId,
    stripeId: args.stripeId,
  });
  return after;
}

// Top-up from a VERIFIED Stripe webhook event only.
export async function creditTopUp(userId: number, amountCents: number, stripeId: string) {
  return db.transaction(async (tx) => {
    return applyDelta(tx as unknown as typeof db, {
      userId,
      delta: amountCents,
      type: "top_up",
      stripeId,
      note: "Stripe top-up",
    });
  });
}

// One billing tick: atomically deduct from client + credit reader 70%.
// Returns the new client balance, or throws 402 if insufficient.
export async function chargeBillingTick(args: {
  readingId: number;
  clientId: number;
  readerId: number;
  pricePerMinuteCents: number;
}): Promise<{ clientBalance: number; readerCredited: number }> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as typeof db;
    const readerCut = readerShareCents(args.pricePerMinuteCents);
    const clientBalance = await applyDelta(t, {
      userId: args.clientId,
      delta: -args.pricePerMinuteCents,
      type: "reading_charge",
      readingId: args.readingId,
      note: "Per-minute reading charge",
    });
    await applyDelta(t, {
      userId: args.readerId,
      delta: readerCut,
      type: "reader_credit",
      readingId: args.readingId,
      note: "Reader revenue share (70%)",
    });
    // accumulate totals on the reading row
    await t
      .update(schema.readings)
      .set({
        duration: sql`${schema.readings.duration} + 1`,
        totalPrice: sql`${schema.readings.totalPrice} + ${args.pricePerMinuteCents}`,
      })
      .where(eq(schema.readings.id, args.readingId));
    return { clientBalance, readerCredited: readerCut };
  });
}

// Admin manual adjustment (signed) with mandatory reason.
export async function adjustBalance(userId: number, amountCents: number, note: string) {
  return db.transaction(async (tx) =>
    applyDelta(tx as unknown as typeof db, {
      userId,
      delta: amountCents,
      type: "adjustment",
      note,
    })
  );
}

// Payout: move reader's full balance out, reset to 0. Caller does Stripe transfer.
export async function recordPayout(userId: number, amountCents: number, stripeId: string) {
  return db.transaction(async (tx) =>
    applyDelta(tx as unknown as typeof db, {
      userId,
      delta: -amountCents,
      type: "payout",
      stripeId,
      note: "Stripe Connect payout",
    })
  );
}
