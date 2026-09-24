import { Router } from "express";
import { createScanHandler, getScanHandler, getScanReportHandler } from "../controllers/scanController.js";

export const scansRouter = Router();

scansRouter.post("/", createScanHandler);
scansRouter.get("/:id/report", getScanReportHandler);
scansRouter.get("/:id", getScanHandler);
