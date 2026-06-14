import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { checkJwt, loadUser, requireUser } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { createPostSchema, createCommentSchema, flagSchema, FORUM_PAGE_SIZE } from "@soulseer/shared";
import { HttpError } from "../middleware/errors.js";

const r = Router();
const auth = [checkJwt, loadUser, requireUser];

// GET /api/forum/posts — paginated, newest first (public)
r.get("/posts", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const category = req.query.category as string | undefined;
  const where = category
    ? and(eq(schema.forumPosts.deleted, false), eq(schema.forumPosts.category, category as never))
    : eq(schema.forumPosts.deleted, false);
  const rows = await db
    .select({
      id: schema.forumPosts.id,
      title: schema.forumPosts.title,
      content: schema.forumPosts.content,
      category: schema.forumPosts.category,
      createdAt: schema.forumPosts.createdAt,
      authorName: schema.users.fullName,
      commentCount: sql<number>`(select count(*) from ${schema.forumComments} c where c.post_id = ${schema.forumPosts.id} and c.deleted = false)`,
    })
    .from(schema.forumPosts)
    .innerJoin(schema.users, eq(schema.forumPosts.userId, schema.users.id))
    .where(where)
    .orderBy(desc(schema.forumPosts.createdAt))
    .limit(FORUM_PAGE_SIZE)
    .offset((page - 1) * FORUM_PAGE_SIZE);
  res.json({ page, pageSize: FORUM_PAGE_SIZE, posts: rows });
}));

// POST /api/forum/posts — create (Announcements admin-only)
r.post("/posts", ...auth, validateBody(createPostSchema), asyncHandler(async (req, res) => {
  if (req.body.category === "Announcements" && req.userRecord!.role !== "admin") {
    throw new HttpError(403, "Only admins can post announcements");
  }
  const [post] = await db.insert(schema.forumPosts).values({ ...req.body, userId: req.userRecord!.id }).returning();
  res.status(201).json(post);
}));

// GET /api/forum/posts/:id — single post with comments (public)
r.get("/posts/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const [post] = await db
    .select({
      id: schema.forumPosts.id, title: schema.forumPosts.title, content: schema.forumPosts.content,
      category: schema.forumPosts.category, createdAt: schema.forumPosts.createdAt, authorName: schema.users.fullName,
    })
    .from(schema.forumPosts).innerJoin(schema.users, eq(schema.forumPosts.userId, schema.users.id))
    .where(and(eq(schema.forumPosts.id, id), eq(schema.forumPosts.deleted, false))).limit(1);
  if (!post) throw new HttpError(404, "Post not found");
  const comments = await db
    .select({ id: schema.forumComments.id, content: schema.forumComments.content, createdAt: schema.forumComments.createdAt, authorName: schema.users.fullName })
    .from(schema.forumComments).innerJoin(schema.users, eq(schema.forumComments.userId, schema.users.id))
    .where(and(eq(schema.forumComments.postId, id), eq(schema.forumComments.deleted, false)))
    .orderBy(schema.forumComments.createdAt);
  res.json({ ...post, comments });
}));

// POST /api/forum/posts/:id/comments
r.post("/posts/:id/comments", ...auth, validateBody(createCommentSchema), asyncHandler(async (req, res) => {
  const postId = Number(req.params.id);
  const [post] = await db.select({ id: schema.forumPosts.id }).from(schema.forumPosts).where(and(eq(schema.forumPosts.id, postId), eq(schema.forumPosts.deleted, false))).limit(1);
  if (!post) throw new HttpError(404, "Post not found");
  const [c] = await db.insert(schema.forumComments).values({ postId, userId: req.userRecord!.id, content: req.body.content }).returning();
  res.status(201).json(c);
}));

// POST /api/forum/posts/:id/flag
r.post("/posts/:id/flag", ...auth, validateBody(flagSchema), asyncHandler(async (req, res) => {
  const postId = Number(req.params.id);
  await db.insert(schema.forumFlags).values({ postId, reporterId: req.userRecord!.id, reason: req.body.reason });
  await db.update(schema.forumPosts).set({ flagCount: sql`${schema.forumPosts.flagCount} + 1` }).where(eq(schema.forumPosts.id, postId));
  res.status(201).json({ flagged: true });
}));

// POST /api/forum/comments/:id/flag
r.post("/comments/:id/flag", ...auth, validateBody(flagSchema), asyncHandler(async (req, res) => {
  const commentId = Number(req.params.id);
  await db.insert(schema.forumFlags).values({ commentId, reporterId: req.userRecord!.id, reason: req.body.reason });
  await db.update(schema.forumComments).set({ flagCount: sql`${schema.forumComments.flagCount} + 1` }).where(eq(schema.forumComments.id, commentId));
  res.status(201).json({ flagged: true });
}));

export default r;

// Spec-documented admin deletes (DELETE /api/forum/posts/:id, /comments/:id)
import { requireRole } from "../middleware/auth.js";
r.delete("/posts/:id", ...auth, requireRole("admin"), asyncHandler(async (req, res) => {
  await db.update(schema.forumPosts).set({ deleted: true }).where(eq(schema.forumPosts.id, Number(req.params.id)));
  res.json({ deleted: true });
}));
r.delete("/comments/:id", ...auth, requireRole("admin"), asyncHandler(async (req, res) => {
  await db.update(schema.forumComments).set({ deleted: true }).where(eq(schema.forumComments.id, Number(req.params.id)));
  res.json({ deleted: true });
}));
