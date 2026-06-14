import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { publicLimiter } from "./middleware/rateLimit.js";
import { notFound, errorHandler } from "./middleware/errors.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import readingRoutes from "./routes/readings.js";
import paymentRoutes, { stripeWebhookHandler } from "./routes/payments.js";
import forumRoutes from "./routes/forum.js";
import adminRoutes from "./routes/admin.js";
import messageRoutes from "./routes/messages.js";
import miscRoutes from "./routes/misc.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  // Helmet security headers on all routes.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // CORS — only the configured frontend origin.
  app.use(cors({ origin: env.clientOrigin, credentials: true }));

  app.use(pinoHttp({ logger }));

  // Stripe webhook FIRST with raw body (before json parser). Public (Stripe only).
  app.post("/api/webhooks/stripe", ...stripeWebhookHandler);

  app.use(express.json({ limit: "8mb" }));

  // Public rate limiter baseline on all /api.
  app.use("/api", publicLimiter);

  // Routes
  app.use("/api/auth", authRoutes);
  app.use("/api", userRoutes); // /api/readers*, /api/user/balance
  app.use("/api/readings", readingRoutes);
  app.use("/api", paymentRoutes); // /api/payments/*, /api/transactions
  app.use("/api/forum", forumRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api", miscRoutes); // /api/health, /api/newsletter, /api/events

  // In production, serve the built client (single deployable) with SPA fallback.
  if (env.isProd) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const clientDist = process.env.CLIENT_DIST || path.resolve(here, "../../client/dist");
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
