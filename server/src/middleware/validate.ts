import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

// Validates and replaces req.body with the parsed, sanitized result.
export const validateBody =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);
    req.body = parsed.data;
    next();
  };
