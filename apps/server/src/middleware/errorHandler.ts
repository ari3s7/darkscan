import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/httpError.js";

function isInvalidJson(error: unknown): error is SyntaxError {
  return (
    error instanceof SyntaxError &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (isInvalidJson(error)) {
    res.status(400).json({ error: "Request body must be valid JSON" });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}
