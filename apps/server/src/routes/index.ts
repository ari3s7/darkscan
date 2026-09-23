import { Router } from "express";
import { healthRouter } from "./health.js";

export const router = Router();

router.use(healthRouter);
