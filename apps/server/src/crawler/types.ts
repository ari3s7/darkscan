export interface CrawledPage {
  requestedUrl: string;
  finalUrl: string;
  title: string | null;
  statusCode: number | null;
}

export class CrawlError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CrawlError";
  }
}
