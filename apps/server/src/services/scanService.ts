import { join } from "node:path";
import type { Prisma, Scan } from "@prisma/client";
import { CRAWL_MAX_DEPTH, CRAWL_MAX_PAGES, crawlSite } from "../crawler/crawler.js";
import { CrawlError, type CrawledPage, type Interaction } from "../crawler/types.js";
import { prisma } from "../prisma/client.js";
import { env } from "../config/env.js";

const scanWithPages = {
  pages: {
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.ScanInclude;

type ScanWithPages = Prisma.ScanGetPayload<{ include: typeof scanWithPages }>;

export interface PageResponse {
  id: string;
  url: string;
  finalUrl: string | null;
  title: string | null;
  statusCode: number | null;
  screenshotPath: string | null;
  error: string | null;
  metadata: Prisma.JsonValue;
}

export interface ScanResponse {
  id: string;
  url: string;
  status: Scan["status"];
  errors: string[];
  createdAt: string;
  updatedAt: string;
  pages: PageResponse[];
}

function errorList(error: string | null): string[] {
  if (!error) return [];
  return error
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function readIndex(metadata: Prisma.JsonValue): number {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return 0;
  const index = "index" in metadata ? metadata.index : undefined;
  return typeof index === "number" ? index : 0;
}

function toScanResponse(scan: ScanWithPages): ScanResponse {
  const pages = [...scan.pages].sort((a, b) => readIndex(a.metadata) - readIndex(b.metadata));
  return {
    id: scan.id,
    url: scan.url,
    status: scan.status,
    errors: errorList(scan.error),
    createdAt: scan.createdAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString(),
    pages: pages.map((page) => ({
      id: page.id,
      url: page.url,
      finalUrl: page.finalUrl,
      title: page.title,
      statusCode: page.statusCode,
      screenshotPath: page.screenshotPath,
      error: page.error,
      metadata: page.metadata,
    })),
  };
}

function interactionsJson(interactions: Interaction[]): Prisma.InputJsonValue {
  return interactions.map((item) => {
    const json: Record<string, Prisma.InputJsonValue> = { type: item.type };
    if (item.text) json.text = item.text;
    if (item.name) json.name = item.name;
    if (item.value) json.value = item.value;
    if (typeof item.checked === "boolean") json.checked = item.checked;
    if (item.disabled) json.disabled = true;
    if (item.hidden) json.hidden = true;
    return json;
  });
}

function pageData(scanId: string, crawled: CrawledPage): Prisma.PageCreateInput {
  return {
    scan: { connect: { id: scanId } },
    url: crawled.requestedUrl,
    finalUrl: crawled.finalUrl,
    title: crawled.title,
    statusCode: crawled.statusCode,
    screenshotPath: crawled.screenshotPath,
    error: crawled.error,
    metadata: {
      contentType: crawled.contentType,
      language: crawled.language,
      description: crawled.description,
      depth: crawled.depth,
      index: crawled.index,
      visibleText: crawled.visibleText,
      interactions: interactionsJson(crawled.interactions),
    },
  };
}

function screenshotDir(scanId: string): { directory: string; prefix: string } {
  const prefix = join("storage", "screenshots", scanId);
  return {
    directory: join(process.cwd(), prefix),
    prefix: prefix.split("\\").join("/"),
  };
}

async function failedScan(id: string, message: string): Promise<ScanResponse | null> {
  await prisma.scan
    .update({
      where: { id },
      data: { status: "FAILED", error: message },
    })
    .catch((updateError: unknown) => {
      console.error("Failed to mark scan as FAILED", updateError);
    });
  const scan = await prisma.scan.findUnique({
    where: { id },
    include: scanWithPages,
  });
  return scan ? toScanResponse(scan) : null;
}

export async function createScan(url: string): Promise<ScanResponse> {
  const scan = await prisma.scan.create({
    data: { url, status: "RUNNING" },
  });
  const shots = screenshotDir(scan.id);

  try {
    const result = await crawlSite(url, {
      maxPages: CRAWL_MAX_PAGES,
      maxDepth: CRAWL_MAX_DEPTH,
      timeoutMs: env.crawlTimeoutMs,
      screenshotDir: shots.directory,
      screenshotPathPrefix: shots.prefix,
    });

    if (result.pages.length === 0) {
      const failed = await failedScan(scan.id, result.errors.join("\n") || "Unable to load the page");
      if (!failed) throw new CrawlError("Unable to load the page");
      return failed;
    }

    for (const crawled of result.pages) {
      await prisma.page.create({ data: pageData(scan.id, crawled) });
    }

    const completed = await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "COMPLETED",
        error: result.errors.length > 0 ? result.errors.join("\n") : null,
      },
      include: scanWithPages,
    });
    return toScanResponse(completed);
  } catch (error) {
    console.error(error);
    const message = error instanceof CrawlError ? error.message : "Unable to crawl the site";
    const failed = await failedScan(scan.id, message);
    if (error instanceof CrawlError && failed) return failed;
    throw error;
  }
}
