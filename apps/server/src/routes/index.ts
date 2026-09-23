import { Router } from "express";
import { healthRouter } from "./health.js";
import { scansRouter } from "./scans.js";

export const router = Router();

router.use(healthRouter);
router.use("/api/scans", scansRouter);
