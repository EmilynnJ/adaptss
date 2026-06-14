import { z } from "zod";
import { READING_TYPES, FORUM_CATEGORIES, MIN_TOPUP_CENTS } from "./constants.js";

// Reusable sanitized primitives
const safeStr = (max: number) =>
  z.string().trim().min(1).max(max);

const positiveCents = z
  .number()
  .int("Must be a whole number of cents")
  .nonnegative("Cannot be negative")
  .max(100_000_00, "Unreasonably large amount");

// ---- Auth ----
export const syncUserSchema = z.object({
  email: z.string().email().max(320),
  username: safeStr(64).optional(),
  fullName: safeStr(128).optional(),
});

// ---- Readers (self-service) ----
export const updateStatusSchema = z.object({ isOnline: z.boolean() });
export const updatePricingSchema = z.object({
  pricingChat: positiveCents,
  pricingVoice: positiveCents,
  pricingVideo: positiveCents,
});
export const updateProfileSchema = z.object({
  bio: z.string().trim().max(4000).optional(),
  specialties: z.array(safeStr(48)).max(20).optional(),
});

// ---- Readings ----
export const createReadingSchema = z.object({
  readerId: z.number().int().positive(),
  type: z.enum(READING_TYPES),
});
export const rateReadingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().trim().max(2000).optional(),
});

// ---- Payments ----
export const createIntentSchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(MIN_TOPUP_CENTS, `Minimum top-up is $${MIN_TOPUP_CENTS / 100}`)
    .max(100_000_00),
});

// ---- Forum ----
export const createPostSchema = z.object({
  title: safeStr(200),
  content: safeStr(20000),
  category: z.enum(FORUM_CATEGORIES),
});
export const createCommentSchema = z.object({ content: safeStr(5000) });
export const flagSchema = z.object({ reason: safeStr(500) });

// ---- Premium messaging ----
export const sendMessageSchema = z.object({
  readerId: z.number().int().positive(),
  body: safeStr(5000),
});
export const readerReplySchema = z.object({
  clientId: z.number().int().positive(),
  body: safeStr(5000),
  billing: z.enum(["free", "charged"]),
  priceCents: positiveCents.optional(),
});

// ---- Admin ----
export const createReaderSchema = z.object({
  email: z.string().email().max(320),
  username: safeStr(64),
  fullName: safeStr(128),
  bio: z.string().trim().max(4000).optional(),
  specialties: z.array(safeStr(48)).max(20).optional(),
  pricingChat: positiveCents,
  pricingVoice: positiveCents,
  pricingVideo: positiveCents,
  profileImage: z.string().url().optional(),
});
export const editReaderSchema = createReaderSchema.partial();
export const balanceAdjustSchema = z.object({
  userId: z.number().int().positive(),
  amountCents: z.number().int().refine((v) => v !== 0, "Amount cannot be zero"),
  note: safeStr(500),
});
export const newsletterSchema = z.object({ email: z.string().email().max(320) });
