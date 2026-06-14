import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export class HttpError extends Error {
  status: number;
  expose: boolean;
  constructor(status: number, message: string, expose = true) {
    super(message);
    this.status = status;
    this.expose = expose;
  }
}

export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
};

// Global error handler — structured JSON, never leak stack traces in prod.
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let status = 500;
  let message = "Internal server error";

  if (err instanceof ZodError) {
    status = 400;
    message = "Validation failed";
    logger.warn({ route: req.path, issues: err.issues }, "validation error");
    return res.status(status).json({ error: message, issues: err.issues });
  }
  if (err instanceof HttpError) {
    status = err.status;
    message = err.expose ? err.message : "Request failed";
  } else if ((err as { name?: string })?.name === "UnauthorizedError") {
    status = 401;
    message = "Invalid or missing token";
  }

  const userId = (req as Request & { userRecord?: { id: number } }).userRecord?.id;
  logger.error(
    { route: req.path, userId, err: err instanceof Error ? err.message : String(err) },
    "request error"
  );

  res.status(status).json({
    error: message,
    ...(env.isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
};
