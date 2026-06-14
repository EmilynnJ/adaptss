import pino from "pino";
import { env } from "../config/env.js";

// Structured logging (pino) — never raw console.log in production.
export const logger = pino({
  level: env.isProd ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "*.password",
      "*.secret",
      "*.stripeId",
      "STRIPE_SECRET_KEY",
      "AGORA_SECURITY_CERTIFICATE",
    ],
    censor: "[REDACTED]",
  },
  transport: env.isProd ? undefined : { target: "pino-pretty", options: { colorize: true } },
});

// Dedicated financial audit logger — every money operation passes through here.
export function logFinancial(event: {
  op: string;
  userId: number;
  type: string;
  amountCents: number;
  balanceBefore?: number;
  balanceAfter?: number;
  readingId?: number | null;
  stripeId?: string | null;
}) {
  logger.info({ audit: "financial", ...event }, `financial:${event.op}`);
}
