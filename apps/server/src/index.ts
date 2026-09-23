import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { router } from "./routes/index.js";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use(router);
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`DarkScan server listening on port ${env.port}`);
});
