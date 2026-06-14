import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { startBillingEngine, stopBillingEngine } from "./services/billing.js";
import { getRedis } from "./integrations/redis.js";

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`SoulSeer API listening on :${env.port} (${env.nodeEnv})`);
  // Warm Redis + start the server-side billing engine (no cron jobs).
  getRedis();
  startBillingEngine();
});

function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  stopBillingEngine();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error({ reason: String(reason) }, "unhandledRejection"));
