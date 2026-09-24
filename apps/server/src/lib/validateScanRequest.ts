import { normalizeUrl } from "../crawler/crawler.js";
import { HttpError } from "./httpError.js";
import { publicUrlProblem } from "./urlSafety.js";

export interface ScanRequest {
  url: string;
}

export async function parseScanRequest(
  body: unknown,
  options?: { allowPrivateHosts?: boolean },
): Promise<ScanRequest> {
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
  if (parsed.username || parsed.password) {
    throw new HttpError(400, "url must not include credentials");
  }

  const normalized = normalizeUrl(parsed.toString());
  if (!normalized) throw new HttpError(400, "url must be a valid absolute URL");
  const problem = await publicUrlProblem(normalized, options?.allowPrivateHosts === true);
  if (problem) throw new HttpError(400, problem);
  return { url: normalized };
}
