import {
  pgSchema,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// All SoulSeer tables live in a dedicated Postgres schema to isolate them
// from legacy tables in this Neon database.
export const ss = pgSchema("soulseer");

// ----------------------------- Enums -----------------------------
export const userRoleEnum = ss.enum("user_role", ["client", "reader", "admin"]);
export const readingTypeEnum = ss.enum("reading_type", ["chat", "voice", "video"]);
export const readingStatusEnum = ss.enum("reading_status", [
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
]);
export const paymentStatusEnum = ss.enum("payment_status", ["pending", "paid", "refunded"]);
export const transactionTypeEnum = ss.enum("transaction_type", [
  "top_up",
  "reading_charge",
  "reader_credit",
  "payout",
  "adjustment",
]);
export const forumCategoryEnum = ss.enum("forum_category", [
  "General",
  "Readings",
  "Spiritual Growth",
  "Ask a Reader",
  "Announcements",
]);
// Premium messaging (per build guide addendum)
export const messageBillingEnum = ss.enum("message_billing", ["free", "charged"]);

// ----------------------------- Users -----------------------------
// Monetary values stored as integers (cents). Timestamps with timezone.
export const users = ss.table(
  "users",
  {
    id: serial("id").primaryKey(),
    auth0Id: varchar("auth0_id", { length: 128 }).unique(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    username: varchar("username", { length: 64 }).notNull().unique(),
    fullName: varchar("full_name", { length: 128 }).notNull(),
    role: userRoleEnum("role").notNull().default("client"),
    bio: text("bio"),
    // stored as JSON array of specialty strings
    specialties: jsonb("specialties").$type<string[]>().default([]).notNull(),
    profileImage: text("profile_image"),
    // per-minute rates in cents, per reading type
    pricingChat: integer("pricing_chat").notNull().default(0),
    pricingVoice: integer("pricing_voice").notNull().default(0),
    pricingVideo: integer("pricing_video").notNull().default(0),
    // prepaid balance (clients) / pending payout balance (readers), in cents
    accountBalance: integer("account_balance").notNull().default(0),
    isOnline: boolean("is_online").notNull().default(false),
    stripeAccountId: varchar("stripe_account_id", { length: 128 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    roleIdx: index("users_role_idx").on(t.role),
    onlineIdx: index("users_online_idx").on(t.isOnline),
  })
);

// ----------------------------- Readings -----------------------------
export const readings = ss.table(
  "readings",
  {
    id: serial("id").primaryKey(),
    readerId: integer("reader_id")
      .notNull()
      .references(() => users.id),
    clientId: integer("client_id")
      .notNull()
      .references(() => users.id),
    type: readingTypeEnum("type").notNull(),
    status: readingStatusEnum("status").notNull().default("pending"),
    pricePerMinute: integer("price_per_minute").notNull(), // cents
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    duration: integer("duration").notNull().default(0), // billed minutes
    totalPrice: integer("total_price").notNull().default(0), // cents
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
    chatTranscript: jsonb("chat_transcript").$type<ChatMessage[]>().default([]),
    rating: integer("rating"), // 1-5 nullable
    review: text("review"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    readerIdx: index("readings_reader_idx").on(t.readerId),
    clientIdx: index("readings_client_idx").on(t.clientId),
    statusIdx: index("readings_status_idx").on(t.status),
  })
);

export type ChatMessage = {
  senderId: number;
  senderName: string;
  text: string;
  ts: string; // ISO timestamp
};

// ----------------------------- Transactions -----------------------------
export const transactions = ss.table(
  "transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    type: transactionTypeEnum("type").notNull(),
    amount: integer("amount").notNull(), // cents, signed
    balanceBefore: integer("balance_before").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    readingId: integer("reading_id").references(() => readings.id),
    stripeId: varchar("stripe_id", { length: 128 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("transactions_user_idx").on(t.userId),
    typeIdx: index("transactions_type_idx").on(t.type),
  })
);

// ----------------------------- Premium Messaging -----------------------------
// Client can message any reader for free. Reader decides if their reply is free
// or charged; charged replies require the client to have sufficient funds to open.
export const messages = ss.table(
  "messages",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => users.id),
    readerId: integer("reader_id")
      .notNull()
      .references(() => users.id),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    // For reader replies: free or charged
    billing: messageBillingEnum("billing").notNull().default("free"),
    priceCents: integer("price_cents").notNull().default(0),
    // whether client has paid to unlock (for charged reader replies)
    unlocked: boolean("unlocked").notNull().default(true),
    readingId: integer("reading_id").references(() => readings.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index("messages_thread_idx").on(t.clientId, t.readerId),
  })
);

// ----------------------------- Forum -----------------------------
export const forumPosts = ss.table(
  "forum_posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    category: forumCategoryEnum("category").notNull().default("General"),
    flagCount: integer("flag_count").notNull().default(0),
    deleted: boolean("deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    categoryIdx: index("forum_posts_category_idx").on(t.category),
    createdIdx: index("forum_posts_created_idx").on(t.createdAt),
  })
);

export const forumComments = ss.table("forum_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => forumPosts.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  flagCount: integer("flag_count").notNull().default(0),
  deleted: boolean("deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const forumFlags = ss.table("forum_flags", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => forumPosts.id),
  commentId: integer("comment_id").references(() => forumComments.id),
  reporterId: integer("reporter_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Newsletter signups (home page)
export const newsletterSignups = ss.table("newsletter_signups", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ----------------------------- Relations -----------------------------
export const usersRelations = relations(users, ({ many }) => ({
  readingsAsReader: many(readings, { relationName: "reader" }),
  readingsAsClient: many(readings, { relationName: "client" }),
  transactions: many(transactions),
}));

export const readingsRelations = relations(readings, ({ one }) => ({
  reader: one(users, {
    fields: [readings.readerId],
    references: [users.id],
    relationName: "reader",
  }),
  client: one(users, {
    fields: [readings.clientId],
    references: [users.id],
    relationName: "client",
  }),
}));

export const forumPostsRelations = relations(forumPosts, ({ one, many }) => ({
  author: one(users, { fields: [forumPosts.userId], references: [users.id] }),
  comments: many(forumComments),
}));

export const forumCommentsRelations = relations(forumComments, ({ one }) => ({
  post: one(forumPosts, { fields: [forumComments.postId], references: [forumPosts.id] }),
  author: one(users, { fields: [forumComments.userId], references: [users.id] }),
}));

// ----------------------------- Inferred types -----------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Reading = typeof readings.$inferSelect;
export type NewReading = typeof readings.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type ForumPost = typeof forumPosts.$inferSelect;
export type ForumComment = typeof forumComments.$inferSelect;
export type ForumFlag = typeof forumFlags.$inferSelect;
