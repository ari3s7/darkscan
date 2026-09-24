function readPort(): number {
  const raw = process.env.PORT ?? "3001";
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

function readTimeout(): number {
  const raw = process.env.CRAWL_TIMEOUT_MS ?? "30000";
  const timeout = Number(raw);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error("CRAWL_TIMEOUT_MS must be a positive number");
  }
  return timeout;
}

function readDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return databaseUrl;
}

const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim() || undefined;
const configuredModel = process.env.OPENAI_MODEL?.trim();

function readModel(): string {
  if (openRouterApiKey) {
    if (!configuredModel) return "openai/gpt-4o-mini";
    return configuredModel.includes("/") ? configuredModel : `openai/${configuredModel}`;
  }
  return configuredModel || "gpt-4o-mini";
}

export const env = {
  port: readPort(),
  databaseUrl: readDatabaseUrl(),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  crawlTimeoutMs: readTimeout(),
  crawlAllowPrivate: process.env.CRAWL_ALLOW_PRIVATE === "true",
  nodeEnv: process.env.NODE_ENV ?? "development",
  openAiApiKey: openRouterApiKey || process.env.OPENAI_API_KEY?.trim() || undefined,
  openAiBaseUrl: openRouterApiKey ? "https://openrouter.ai/api/v1" : undefined,
  openAiModel: readModel(),
};
