import type { Request, Response, NextFunction } from "express";
import { expressjwt, type GetVerificationKey } from "express-jwt";
import jwksRsa from "jwks-rsa";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { env } from "../config/env.js";
import { HttpError } from "./errors.js";
import type { User } from "@soulseer/shared/schema";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { sub?: string; [k: string]: unknown };
      userRecord?: User;
    }
  }
}

// Validates Auth0 JWT (RS256) against the tenant JWKS. No exceptions.
export const checkJwt = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    jwksUri: `https://${env.auth0.domain}/.well-known/jwks.json`,
  }) as GetVerificationKey,
  audience: env.auth0.audience,
  issuer: `https://${env.auth0.domain}/`,
  algorithms: ["RS256"],
});

// Loads the internal user record linked via Auth0 sub. Role lives in our DB.
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const sub = req.auth?.sub;
    if (!sub) throw new HttpError(401, "Unauthenticated");
    const [user] = await db.select().from(schema.users).where(eq(schema.users.auth0Id, sub)).limit(1);
    if (user) req.userRecord = user;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.userRecord) return next(new HttpError(401, "User not synced. Call /api/auth/sync first."));
  next();
}

// Role guard — checked server-side, never trusts client claims.
export function requireRole(...roles: Array<User["role"]>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userRecord) return next(new HttpError(401, "Unauthenticated"));
    if (!roles.includes(req.userRecord.role)) return next(new HttpError(403, "Forbidden"));
    next();
  };
}
