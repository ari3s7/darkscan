import type { NextFunction, Request, Response } from "express";

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(handler: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
