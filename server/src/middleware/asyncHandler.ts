import type { Request, Response, NextFunction, RequestHandler } from "express";

// Wrap async route handlers so rejections hit the global error handler.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
