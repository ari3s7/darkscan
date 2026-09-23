function readPort(): number {
  const raw = process.env.PORT ?? "3001";
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

export const env = {
  port: readPort(),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  nodeEnv: process.env.NODE_ENV ?? "development",
};
