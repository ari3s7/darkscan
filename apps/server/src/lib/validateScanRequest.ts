import { HttpError } from "./httpError.js";

export interface ScanRequest {
  url: string;
}

export function parseScanRequest(body: unknown): ScanRequest {
  if (typeof body !== "object" || body === null) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  if (!("url" in body)) {
    throw new HttpError(400, "url is required");
  }

  const url = body.url;
  if (typeof url !== "string" || url.trim() === "") {
    throw new HttpError(400, "url is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new HttpError(400, "url must be a valid absolute URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpError(400, "url must use http or https");
  }

  return { url: parsed.toString() };
}
