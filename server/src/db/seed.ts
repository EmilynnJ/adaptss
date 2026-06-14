import { db, schema, pool } from "./index.js";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger.js";

// Manual admin seed + a couple of sample readers (per build guide: admins are
// created by manual DB seed; readers are normally created via admin dashboard).
async function seed() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "emilynn@soulseerpsychics.online";

  const [existingAdmin] = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail)).limit(1);
  if (!existingAdmin) {
    await db.insert(schema.users).values({
      email: adminEmail, username: "emilynn", fullName: "Emilynn", role: "admin",
      bio: "Founder of SoulSeer.",
    });
    logger.info(`seeded admin: ${adminEmail}`);
  } else {
    await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, existingAdmin.id));
    logger.info(`admin already present: ${adminEmail}`);
  }

  const sampleReaders = [
    { email: "luna@soulseerpsychics.online", username: "luna_seer", fullName: "Luna Moonchild", bio: "Tarot & clairvoyance.", specialties: ["Tarot", "Clairvoyance"], pricingChat: 199, pricingVoice: 299, pricingVideo: 399 },
    { email: "orion@soulseerpsychics.online", username: "orion_stars", fullName: "Orion Vale", bio: "Astrology & mediumship.", specialties: ["Astrology", "Mediumship"], pricingChat: 249, pricingVoice: 349, pricingVideo: 499 },
  ];
  for (const reader of sampleReaders) {
    const [exists] = await db.select().from(schema.users).where(eq(schema.users.email, reader.email)).limit(1);
    if (!exists) {
      await db.insert(schema.users).values({ ...reader, role: "reader", isOnline: true });
      logger.info(`seeded reader: ${reader.email}`);
    }
  }
  await pool.end();
}

seed().catch((e) => {
  logger.error({ err: String(e) }, "seed failed");
  process.exit(1);
});
