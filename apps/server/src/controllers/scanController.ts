import type { Request, Response } from "express";
import { HttpError } from "../lib/httpError.js";
import { parseScanRequest } from "../lib/validateScanRequest.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { createScan, getScan } from "../services/scanService.js";

export const createScanHandler = asyncHandler(async (req: Request, res: Response) => {
  const { url } = parseScanRequest(req.body);
  const scan = await createScan(url);
  res.status(201).json(scan);
});

export const getScanHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!id) throw new HttpError(400, "scan id is required");
  const scan = await getScan(id);
  if (!scan) throw new HttpError(404, "Scan not found");
  res.json(scan);
});
