export interface PageResult {
  id: string;
  url: string;
  finalUrl: string | null;
  title: string | null;
  statusCode: number | null;
}

export interface ScanResult {
  id: string;
  url: string;
  status: string;
  pages: PageResult[];
}

function apiBase(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:3001";
}

function errorMessage(data: unknown): string {
  if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return "Scan failed";
}

function isScanResult(data: unknown): data is ScanResult {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  if (!("id" in data) || typeof data.id !== "string") {
    return false;
  }
  if (!("url" in data) || typeof data.url !== "string") {
    return false;
  }
  if (!("status" in data) || typeof data.status !== "string") {
    return false;
  }
  return "pages" in data && Array.isArray(data.pages);
}

export async function requestScan(url: string): Promise<ScanResult> {
  const response = await fetch(`${apiBase()}/api/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(errorMessage(data));
  }
  if (!isScanResult(data)) {
    throw new Error("Unexpected response from the server");
  }
  return data;
}
