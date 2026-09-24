import { join } from "node:path";
import type { Prisma, Scan } from "@prisma/client";
import { CRAWL_MAX_DEPTH, CRAWL_MAX_PAGES, normalizeUrl } from "../crawler/crawler.js";
import { CrawlError, type CrawledPage, type Interaction } from "../crawler/types.js";
import { runDetection } from "../detection/engine.js";
import type { Finding } from "../detection/types.js";
import { writeAnnotatedScreenshot } from "../evidence/annotate.js";
import { createEvidence, dedupeEvidence, type EvidenceRecord } from "../evidence/record.js";
import { crawlJourney } from "../journey/journey-engine.js";
import type { JourneyRecord } from "../journey/types.js";
import { prisma } from "../prisma/client.js";
import { env } from "../config/env.js";

const JOURNEY_ORDER = ["checkout", "signup", "subscription", "cancellation"];

const scanWithPages = {
  pages: {
    orderBy: { createdAt: "asc" as const },
    include: {
      findings: {
        select: { id: true, journeyStepId: true },
      },
    },
  },
  journeys: {
    include: {
      steps: {
        orderBy: { position: "asc" as const },
        select: { id: true, pageId: true },
      },
    },
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

export interface JourneySummary {
  type: string;
  status: string;
  pages: number;
  findings: number;
}

export interface ScanResponse {
  id: string;
  scanId: string;
  url: string;
  status: Scan["status"];
  errors: string[];
  createdAt: string;
  updatedAt: string;
  pagesCrawled: number;
  findings: number;
  journeys: JourneySummary[];
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
    scanId: scan.id,
    url: scan.url,
    status: scan.status,
    errors: errorList(scan.error),
    createdAt: scan.createdAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString(),
    pagesCrawled: pages.length,
    findings: pages.reduce((total, page) => total + page.findings.length, 0),
    journeys: journeySummaries(scan),
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
    if (item.selector) json.selector = item.selector;
    if (item.box) json.box = item.box;
    return json;
  });
}

function pageKey(url: string): string {
  return normalizeUrl(url) ?? url;
}

function pageData(scanId: string, crawled: CrawledPage, pageKind: string): Prisma.PageCreateInput {
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
      pageKind,
      visibleText: crawled.visibleText,
      interactions: interactionsJson(crawled.interactions),
    },
  };
}

function journeySummaries(scan: ScanWithPages): JourneySummary[] {
  const summaries = scan.journeys.map((journey) => {
    const stepIds = new Set(journey.steps.map((step) => step.id));
    const findings = scan.pages.reduce((total, page) => {
      return (
        total +
        page.findings.filter((finding) => finding.journeyStepId !== null && stepIds.has(finding.journeyStepId))
          .length
      );
    }, 0);
    return {
      type: journey.type,
      status: journey.status,
      pages: journey.steps.length,
      findings,
    };
  });
  return summaries.sort((a, b) => journeyRank(a.type) - journeyRank(b.type) || a.type.localeCompare(b.type));
}

function journeyRank(type: string): number {
  const index = JOURNEY_ORDER.indexOf(type);
  return index === -1 ? JOURNEY_ORDER.length : index;
}

interface JourneyLink {
  journeyStepId: string;
  journeyId: string;
  journeyType: string;
  pageKind: string;
  action?: { label: string; type: string; selector?: string };
}

interface FindingContext {
  scanId: string;
  pageUrl: string;
  screenshotPath?: string | null;
  interactions: Interaction[];
  journeyStepId?: string;
  journeyId?: string;
  action?: JourneyLink["action"];
}

function storedEvidence(record: EvidenceRecord): Prisma.InputJsonValue {
  const content: Record<string, Prisma.InputJsonValue> = {
    value: record.content.value,
    pageUrl: record.content.pageUrl,
    pageId: record.content.pageId,
    ruleId: record.content.ruleId,
    ruleName: record.content.ruleName,
    confidence: record.content.confidence,
    capturedAt: record.content.capturedAt,
    scanId: record.content.scanId,
  };
  if (record.content.selector) content.selector = record.content.selector;
  if (record.content.screenshotPath) content.screenshotPath = record.content.screenshotPath;
  if (record.content.annotatedScreenshot) content.annotatedScreenshot = record.content.annotatedScreenshot;
  if (record.content.box) {
    content.box = {
      x: record.content.box.x,
      y: record.content.box.y,
      width: record.content.box.width,
      height: record.content.box.height,
    };
  }
  if (record.content.journeyStepId) content.journeyStepId = record.content.journeyStepId;
  if (record.content.journeyId) content.journeyId = record.content.journeyId;
  if (record.content.action) {
    const action: Record<string, Prisma.InputJsonValue> = {
      label: record.content.action.label,
      type: record.content.action.type,
    };
    if (record.content.action.selector) action.selector = record.content.action.selector;
    content.action = action;
  }
  return content;
}

async function saveFindings(findings: Finding[], context: FindingContext): Promise<void> {
  const capturedAt = new Date().toISOString();
  for (const finding of findings) {
    const existing = await prisma.finding.findFirst({
      where: { pageId: finding.pageId, ruleId: finding.ruleId },
      select: { id: true },
    });
    if (existing) continue;
    const records = dedupeEvidence(
      finding.evidence.flatMap((item) => {
        const record = createEvidence(finding, item, {
          ...context,
          pageId: finding.pageId,
          capturedAt,
        });
        return record ? [record] : [];
      }),
    );
    if (records.length === 0) continue;
    for (const [index, record] of records.entries()) {
      if (!record.content.box || !record.content.screenshotPath) continue;
      const annotated = await writeAnnotatedScreenshot(
        record.content.screenshotPath,
        record.content.box,
        finding.ruleId,
        index,
      );
      if (annotated) record.content.annotatedScreenshot = annotated;
    }
    await prisma.finding.create({
      data: {
        page: { connect: { id: finding.pageId } },
        ruleId: finding.ruleId,
        severity: finding.severity,
        summary: finding.description,
        ...(context.journeyStepId ? { journeyStep: { connect: { id: context.journeyStepId } } } : {}),
        evidence: {
          create: records.map((record) => ({
            type: record.type,
            content: storedEvidence(record),
          })),
        },
      },
    });
  }
}

async function saveJourneys(scanId: string, journeys: JourneyRecord[], pageIdByUrl: Map<string, string>): Promise<Map<string, JourneyLink>> {
  const contextByPage = new Map<string, JourneyLink>();
  for (const journey of journeys) {
    const created = await prisma.journey.create({
      data: {
        scan: { connect: { id: scanId } },
        type: journey.type,
        status: journey.status,
        actions: journey.actions.map((action) => {
          const stored: Record<string, Prisma.InputJsonValue> = { label: action.label, type: action.type };
          if (action.selector) stored.selector = action.selector;
          return stored;
        }),
        steps: {
          create: journey.steps.map((step, position) => {
            const pageId = pageIdByUrl.get(step.url);
            return {
              position,
              pageKind: step.kind,
              actionLabel: step.actionLabel ?? null,
              actionSelector: step.actionSelector ?? null,
              actionType: step.actionType ?? null,
              ...(pageId ? { page: { connect: { id: pageId } } } : {}),
            };
          }),
        },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });

    created.steps.forEach((step, index) => {
      const source = journey.steps[index];
      if (!step.pageId || !source) return;
      const action = source.actionLabel
        ? {
            label: source.actionLabel,
            type: source.actionType ?? "link",
            ...(source.actionSelector ? { selector: source.actionSelector } : {}),
          }
        : undefined;
      contextByPage.set(step.pageId, {
        journeyStepId: step.id,
        journeyId: created.id,
        journeyType: journey.type,
        pageKind: source.kind,
        ...(action ? { action } : {}),
      });
    });
  }
  return contextByPage;
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
    const result = await crawlJourney(url, {
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

    const pageIdByUrl = new Map<string, string>();
    const savedPages = [];
    for (let index = 0; index < result.pages.length; index += 1) {
      const crawled = result.pages[index];
      if (!crawled) continue;
      const saved = await prisma.page.create({
        data: pageData(scan.id, crawled, result.kinds[index] ?? "unknown"),
      });
      savedPages.push({ saved, crawled });
      pageIdByUrl.set(pageKey(crawled.finalUrl), saved.id);
      pageIdByUrl.set(pageKey(crawled.requestedUrl), saved.id);
    }

    const journeyContext = await saveJourneys(scan.id, result.journeys, pageIdByUrl);
    for (const { saved, crawled } of savedPages) {
      const detected = runDetection({
        id: saved.id,
        url: crawled.finalUrl,
        title: crawled.title,
        visibleText: crawled.visibleText,
        interactions: crawled.interactions,
      });
      const journey = journeyContext.get(saved.id);
      await saveFindings(detected, {
        scanId: scan.id,
        pageUrl: crawled.finalUrl,
        screenshotPath: crawled.screenshotPath,
        interactions: crawled.interactions,
        ...(journey?.journeyStepId ? { journeyStepId: journey.journeyStepId } : {}),
        ...(journey?.journeyId ? { journeyId: journey.journeyId } : {}),
        ...(journey?.action ? { action: journey.action } : {}),
      });
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

export async function getScan(id: string): Promise<ScanResponse | null> {
  const scan = await prisma.scan.findUnique({
    where: { id },
    include: scanWithPages,
  });
  return scan ? toScanResponse(scan) : null;
}
