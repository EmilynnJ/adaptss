import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { getRedis } from "../integrations/redis.js";
import { chargeBillingTick } from "./ledger.js";
import { emitToUser } from "./notifier.js";
import { logger } from "../utils/logger.js";
import { BILLING_INTERVAL_SECONDS, GRACE_PERIOD_SECONDS } from "@soulseer/shared";

// Active session billing — no cron jobs. An in-process interval drives ticks;
// Redis holds authoritative session state so it is durable and shareable.
const ACTIVE_SET = "billing:active";
const sessKey = (id: number) => `billing:session:${id}`;

type SessionState = {
  readingId: number;
  clientId: number;
  readerId: number;
  pricePerMinute: number;
  // epoch seconds of next scheduled tick
  nextTickAt: number;
  // if paused (disconnect), epoch seconds when grace expires
  graceUntil?: number;
};

export async function startSession(s: Omit<SessionState, "nextTickAt">) {
  const redis = getRedis();
  const state: SessionState = { ...s, nextTickAt: nowSec() + BILLING_INTERVAL_SECONDS };
  await redis.set(sessKey(s.readingId), JSON.stringify(state));
  await redis.sadd(ACTIVE_SET, String(s.readingId));
  await db
    .update(schema.readings)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(eq(schema.readings.id, s.readingId));
  logger.info({ readingId: s.readingId }, "billing session started");
}

export async function pauseForDisconnect(readingId: number) {
  const redis = getRedis();
  const raw = await redis.get(sessKey(readingId));
  if (!raw) return;
  const state: SessionState = JSON.parse(raw);
  state.graceUntil = nowSec() + GRACE_PERIOD_SECONDS;
  await redis.set(sessKey(readingId), JSON.stringify(state));
  emitToUser(state.clientId, { kind: "partner_disconnected", readingId, graceSeconds: GRACE_PERIOD_SECONDS });
  emitToUser(state.readerId, { kind: "partner_disconnected", readingId, graceSeconds: GRACE_PERIOD_SECONDS });
}

export async function resumeSession(readingId: number) {
  const redis = getRedis();
  const raw = await redis.get(sessKey(readingId));
  if (!raw) return;
  const state: SessionState = JSON.parse(raw);
  delete state.graceUntil;
  state.nextTickAt = nowSec() + BILLING_INTERVAL_SECONDS;
  await redis.set(sessKey(readingId), JSON.stringify(state));
  emitToUser(state.clientId, { kind: "partner_reconnected", readingId });
  emitToUser(state.readerId, { kind: "partner_reconnected", readingId });
}

export async function endSession(readingId: number, reason: string) {
  const redis = getRedis();
  const raw = await redis.get(sessKey(readingId));
  await redis.srem(ACTIVE_SET, String(readingId));
  await redis.del(sessKey(readingId));

  // Finalize the reading row (idempotent — skip if already paid).
  const [reading] = await db.select().from(schema.readings).where(eq(schema.readings.id, readingId)).limit(1);
  if (!reading || reading.paymentStatus === "paid") return;

  await db
    .update(schema.readings)
    .set({ status: "completed", paymentStatus: "paid", completedAt: new Date() })
    .where(and(eq(schema.readings.id, readingId), eq(schema.readings.paymentStatus, "pending")));

  if (raw) {
    const state: SessionState = JSON.parse(raw);
    const payload = { kind: "session_ended" as const, readingId, reason, totalPrice: reading.totalPrice, duration: reading.duration };
    emitToUser(state.clientId, payload);
    emitToUser(state.readerId, payload);
  }
  logger.info({ readingId, reason }, "billing session ended");
}

async function tick(readingId: number) {
  const redis = getRedis();
  const raw = await redis.get(sessKey(readingId));
  if (!raw) return;
  const state: SessionState = JSON.parse(raw);
  const now = nowSec();

  // Paused for disconnect grace.
  if (state.graceUntil) {
    if (now >= state.graceUntil) {
      await endSession(readingId, "grace_period_expired");
    }
    return;
  }
  if (now < state.nextTickAt) return;

  // Pre-check + atomic charge. On insufficient funds, end immediately.
  try {
    const result = await chargeBillingTick({
      readingId,
      clientId: state.clientId,
      readerId: state.readerId,
      pricePerMinuteCents: state.pricePerMinute,
    });
    state.nextTickAt = now + BILLING_INTERVAL_SECONDS;
    await redis.set(sessKey(readingId), JSON.stringify(state));

    const [reading] = await db.select().from(schema.readings).where(eq(schema.readings.id, readingId)).limit(1);
    const evt = {
      kind: "billing_tick" as const,
      readingId,
      clientBalance: result.clientBalance,
      totalPrice: reading?.totalPrice ?? 0,
      duration: reading?.duration ?? 0,
    };
    emitToUser(state.clientId, evt);
    emitToUser(state.readerId, evt);

    // Low-balance warning when < 2 minutes of runway remains.
    if (result.clientBalance < state.pricePerMinute * 2) {
      emitToUser(state.clientId, { kind: "low_balance", readingId, remaining: result.clientBalance });
    }
  } catch (err) {
    // Insufficient balance (402) or any tick error -> end session, do not lose money silently.
    logger.warn({ readingId, err: err instanceof Error ? err.message : String(err) }, "billing tick ended session");
    await endSession(readingId, "insufficient_balance");
  }
}

let interval: NodeJS.Timeout | null = null;

// Drive all active sessions. Runs every 5s; each session ticks on its own minute boundary.
export function startBillingEngine() {
  if (interval) return;
  interval = setInterval(async () => {
    try {
      const redis = getRedis();
      const ids = await redis.smembers(ACTIVE_SET);
      for (const id of ids) {
        await tick(Number(id)).catch((e) =>
          logger.error({ readingId: id, err: String(e) }, "tick failure")
        );
      }
    } catch (e) {
      logger.error({ err: String(e) }, "billing engine loop error");
    }
  }, 5000);
  logger.info("billing engine started");
}

export function stopBillingEngine() {
  if (interval) clearInterval(interval);
  interval = null;
}

const nowSec = () => Math.floor(Date.now() / 1000);
