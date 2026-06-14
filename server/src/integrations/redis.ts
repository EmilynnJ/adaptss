import Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Redis holds ephemeral active-session billing state (no cron jobs).
let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  if (!env.redis.host) {
    logger.warn("[redis] no host configured; using in-memory fallback is NOT enabled");
  }
  client = new Redis({
    host: env.redis.host,
    port: env.redis.port,
    username: env.redis.username || undefined,
    password: env.redis.password || undefined,
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
  client.on("error", (err) => logger.error({ err }, "redis error"));
  client.on("connect", () => logger.info("redis connected"));
  return client;
}
