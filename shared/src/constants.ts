// Business constants (per build guide).
export const MIN_BALANCE_TO_START_CENTS = 500; // $5 minimum to start a reading
export const MIN_TOPUP_CENTS = 500; // $5 minimum top-up
export const PRESET_TOPUP_CENTS = [1000, 2500, 5000, 10000]; // $10/$25/$50/$100
export const READER_REVENUE_SHARE = 0.7; // 70% to reader
export const PLATFORM_REVENUE_SHARE = 0.3; // 30% platform
export const PAYOUT_THRESHOLD_CENTS = 1500; // $15 minimum to pay out
export const GRACE_PERIOD_SECONDS = 120; // 2-minute disconnect grace
export const BILLING_INTERVAL_SECONDS = 60; // server-side tick cadence
export const AGORA_TOKEN_TTL_SECONDS = 3600; // 1 hour
export const FORUM_PAGE_SIZE = 10;
export const READER_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const READER_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];

export const FORUM_CATEGORIES = [
  "General",
  "Readings",
  "Spiritual Growth",
  "Ask a Reader",
  "Announcements",
] as const;

export const READING_TYPES = ["chat", "voice", "video"] as const;

// Reader share using integer math only (cents in -> cents out).
export function readerShareCents(amountCents: number): number {
  return Math.floor(amountCents * READER_REVENUE_SHARE);
}
export function platformShareCents(amountCents: number): number {
  return amountCents - readerShareCents(amountCents);
}
