import { Router } from "express";
import { createScanHandler, getScanHandler } from "../controllers/scanController.js";

export const scansRouter = Router();

scansRouter.post("/", createScanHandler);
scansRouter.get("/:id", getScanHandler);
