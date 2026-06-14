import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "../shared/src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEON_DB_CONNECTION_STRING!,
  },
} satisfies Config;
