import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import { launchBrowser } from "../crawler/browser.js";
import { normalizeUrl } from "../crawler/crawler.js";
import { extractPage } from "../crawler/page-extractor.js";
import { CrawlError, type CrawledPage, type CrawlOptions } from "../crawler/types.js";
import { publicUrlProblem } from "../lib/urlSafety.js";
import {
  actionKey,
  claim,
  decideFollow,
  isAllowedTarget,
  isGenericLinkAllowed,
  shouldStop,
} from "./interaction-handler.js";
import { classifyPage, detectActions, journeyTypeFor, signalsFromExtraction } from "./journey-detector.js";
import type { DiscoveredAction, JourneyAction, JourneyRecord, JourneyStatus, PageKind, VisitRecord } from "./types.js";

const TYPE_ORDER = ["checkout", "signup", "subscription", "cancellation"];
const POST_CLICK = new Set(["add-to-cart", "continue", "checkout", "decline", "continue-without"]);

interface QueueItem {
  url: string;
  depth: number;
  arrival?: JourneyAction;
}

export interface JourneyCrawlResult {
  pages: CrawledPage[];
  errors: string[];
  journeys: JourneyRecord[];
  /** Parallel to pages. Unknown pages stay in the crawl and out of a journey. */
  kinds: PageKind[];
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function shortError(error: unknown): string {
  if (error instanceof Error) {
    if (/timeout/i.test(error.message)) return "timed out";
    const first = error.message.split("\n")[0] ?? error.message;
    return first.slice(0, 240);
  }
  return "Unable to load the page";
}

async function blockedTarget(url: string, options: CrawlOptions, cache: Map<string, string | null>): Promise<string | null> {
  if (options.allowPrivateHosts !== false) return null;
  return publicUrlProblem(url, false, cache);
}

function publicAction(action: DiscoveredAction): JourneyAction {
  const stored: JourneyAction = { label: action.label, type: action.type };
  if (action.selector) stored.selector = action.selector;
  return stored;
}

function uniqueActions(actions: JourneyAction[]): JourneyAction[] {
  const seen = new Set<string>();
  const unique: JourneyAction[] = [];
  for (const action of actions) {
    const key = `${action.type}|${action.label.trim().toLowerCase()}|${action.selector ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(action);
  }
  return unique;
}

export function journeyStatus(type: string, steps: { kind: PageKind; blocked: boolean }[]): JourneyStatus {
  const kinds = new Set(steps.map((step) => step.kind));
  const blocked = steps.some((step) => step.blocked);

  if (type === "checkout") {
    if (kinds.has("confirmation")) return "completed";
    if (blocked) return "blocked";
    if (kinds.has("cart") || kinds.has("checkout") || kinds.has("product") || kinds.has("pricing")) {
      return "in_progress";
    }
    return "discovered";
  }

  if (type === "cancellation") {
    if (kinds.has("cancellation")) return "completed";
    return blocked ? "blocked" : "discovered";
  }

  if (type === "subscription") {
    if (kinds.has("subscription")) return blocked ? "blocked" : "completed";
    return blocked ? "blocked" : "discovered";
  }

  if (blocked) return "blocked";
  if (kinds.has("signup") || kinds.has("login")) return "in_progress";
  return "discovered";
}

export function buildJourneyRecords(visits: VisitRecord[]): JourneyRecord[] {
  const grouped = new Map<string, VisitRecord[]>();
  const seenInType = new Map<string, Set<string>>();

  for (const visit of visits) {
    const type = journeyTypeFor(visit.kind);
    if (!type) continue;
    const seen = seenInType.get(type) ?? new Set<string>();
    if (seen.has(visit.url)) continue;
    seen.add(visit.url);
    seenInType.set(type, seen);
    const list = grouped.get(type) ?? [];
    list.push(visit);
    grouped.set(type, list);
  }

  const types = [...grouped.keys()].sort((a, b) => {
    const left = TYPE_ORDER.indexOf(a);
    const right = TYPE_ORDER.indexOf(b);
    return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
  });

  return types.map((type) => {
    const list = grouped.get(type) ?? [];
    return {
      type,
      pages: list.map((visit) => visit.url),
      actions: uniqueActions(list.flatMap((visit) => visit.actions)),
      status: journeyStatus(type, list),
      steps: list.map((visit) => {
        const step: JourneyRecord["steps"][number] = { url: visit.url, kind: visit.kind };
        if (visit.arrival?.label) step.actionLabel = visit.arrival.label;
        if (visit.arrival?.selector) step.actionSelector = visit.arrival.selector;
        if (visit.arrival?.type) step.actionType = visit.arrival.type;
        return step;
      }),
    };
  });
}

async function saveScreenshot(page: Page, filePath: string): Promise<void> {
  try {
    await page.screenshot({ path: filePath, fullPage: true, animations: "disabled", timeout: 10_000 });
  } catch {
    await page.screenshot({ path: filePath, fullPage: false, animations: "disabled", timeout: 10_000 });
  }
}

function resolveLocator(page: Page, action: DiscoveredAction) {
  const selector = action.selector;
  if (!selector) return null;
  const role = /^role=(link|button)\[name=(.*)]$/s.exec(selector);
  if (role?.[1] && role[2]) {
    try {
      const name = JSON.parse(role[2]) as string;
      return page.getByRole(role[1] as "link" | "button", { name, exact: true }).first();
    } catch {
      return null;
    }
  }
  return page.locator(selector).first();
}

async function clickIfSafe(page: Page, action: DiscoveredAction, timeoutMs: number): Promise<string | null> {
  const locator = resolveLocator(page, action);
  if (!locator) return null;
  const allowPost = POST_CLICK.has(action.kind);
  const safe = await locator
    .evaluate((element, postAllowed) => {
      const form = element.closest("form");
      if (!form) return true;
      const blob = `${form.textContent ?? ""}`.slice(0, 4000);
      if (/\b(card number|credit card|cvv|cvc|security code)\b/i.test(blob)) return false;
      const method = (form.getAttribute("method") || "get").toLowerCase();
      const type = (element.getAttribute("type") || "").toLowerCase();
      const submit = type === "submit" || (element.tagName === "BUTTON" && type !== "button");
      if (submit && method === "post" && !postAllowed) return false;
      return true;
    }, allowPost)
    .catch(() => false);
  if (!safe) return null;

  const before = page.url();
  await locator.click({ timeout: timeoutMs });
  await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs }).catch(() => undefined);
  const after = page.url();
  if (normalizeUrl(after) === normalizeUrl(before)) return null;
  return after;
}

/**
 * Walks a site along commerce and account flows.
 * Reuses the existing browser, extractor, and URL normalizer. Does not submit payment or personal data.
 */
export async function crawlJourney(startUrl: string, options: CrawlOptions): Promise<JourneyCrawlResult> {
  const start = normalizeUrl(startUrl);
  if (!start) return { pages: [], errors: ["Starting URL is not a valid http(s) URL"], journeys: [], kinds: [] };
  const hostCache = new Map<string, string | null>();
  const blockedStart = await blockedTarget(start, options, hostCache);
  if (blockedStart) return { pages: [], errors: [blockedStart], journeys: [], kinds: [] };

  const pages: CrawledPage[] = [];
  const errors: string[] = [];
  const visits: VisitRecord[] = [];
  const seen = new Set<string>([start]);
  const saved = new Set<string>();
  const usedActions = new Set<string>();
  const queue: QueueItem[] = [{ url: start, depth: 0 }];
  let origin: string | null = null;

  let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    if (options.allowPrivateHosts === false) {
      await context.route("**/*", async (route) => {
        const target = route.request().url();
        if (!target.startsWith("http://") && !target.startsWith("https://")) {
          await route.continue();
          return;
        }
        const problem = await blockedTarget(target, options, hostCache);
        if (problem) {
          await route.abort().catch(() => undefined);
          return;
        }
        await route.continue();
      });
    }
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(options.timeoutMs);
    page.setDefaultTimeout(options.timeoutMs);
    page.on("dialog", (dialog) => {
      void dialog.dismiss().catch(() => undefined);
    });
    await mkdir(options.screenshotDir, { recursive: true });
    const clickTimeout = Math.min(8_000, options.timeoutMs);

    while (queue.length > 0 && pages.length < options.maxPages) {
      const current = queue.shift();
      if (!current) break;

      try {
        const blocked = await blockedTarget(current.url, options, hostCache);
        if (blocked) {
          errors.push(`${current.url}: ${blocked}`);
          continue;
        }
        const response = await page.goto(current.url, {
          waitUntil: "domcontentloaded",
          timeout: options.timeoutMs,
        });
        const finalUrl = page.url();
        let final: URL;
        try {
          final = new URL(finalUrl);
        } catch {
          errors.push(`${current.url}: unable to read the final URL`);
          continue;
        }
        if (final.protocol !== "http:" && final.protocol !== "https:") {
          errors.push(`${current.url}: page did not load`);
          continue;
        }
        if (!origin) origin = final.origin;
        if (final.origin !== origin) {
          errors.push(`${current.url}: redirected outside the site`);
          continue;
        }
        const blockedFinal = await blockedTarget(finalUrl, options, hostCache);
        if (blockedFinal) {
          errors.push(`${current.url}: ${blockedFinal}`);
          continue;
        }

        const normalizedFinal = normalizeUrl(finalUrl) ?? finalUrl;
        if (saved.has(normalizedFinal)) continue;

        const contentTypeHeader = response?.headers()["content-type"] ?? null;
        const contentType = blankToNull(contentTypeHeader);
        if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
          errors.push(`${current.url}: skipped non-HTML response`);
          continue;
        }

        const extracted = await extractPage(page);
        const signals = signalsFromExtraction(finalUrl, extracted);
        const kind = classifyPage(signals);
        const discovered = detectActions(extracted.interactions);
        const stop = shouldStop(signals);
        const index = pages.length;
        const fileName = `${String(index).padStart(2, "0")}.png`;
        let screenshotPath: string | null = `${options.screenshotPathPrefix}/${fileName}`;
        let pageError: string | null = null;
        try {
          await saveScreenshot(page, join(options.screenshotDir, fileName));
        } catch (error) {
          screenshotPath = null;
          pageError = "Unable to save a screenshot";
          console.error(`Screenshot failed for ${finalUrl}`, error);
        }

        saved.add(normalizedFinal);
        seen.add(normalizedFinal);
        pages.push({
          requestedUrl: current.url,
          finalUrl,
          title: extracted.title,
          statusCode: response?.status() ?? null,
          contentType,
          language: extracted.language,
          description: extracted.description,
          depth: current.depth,
          index,
          visibleText: extracted.visibleText,
          interactions: extracted.interactions,
          screenshotPath,
          error: pageError,
        });
        visits.push({
          url: normalizedFinal,
          kind,
          blocked: stop.stop,
          actions: discovered.map(publicAction),
          ...(current.arrival ? { arrival: current.arrival } : {}),
        });

        if (current.depth >= options.maxDepth || stop.stop) continue;

        const priority: QueueItem[] = [];
        const later: QueueItem[] = [];
        const consider = (raw: string, arrival: JourneyAction | undefined, bucket: QueueItem[]) => {
          const next = normalizeUrl(raw, finalUrl);
          if (!next || !origin || !isAllowedTarget(next, origin)) return;
          if (seen.has(next) || queue.length + pages.length >= options.maxPages * 4) return;
          if (!claim(seen, next)) return;
          bucket.push({ url: next, depth: current.depth + 1, ...(arrival ? { arrival } : {}) });
        };

        for (const action of discovered) {
          if (decideFollow(action, signals) !== "link" || !action.href) continue;
          if (!claim(usedActions, actionKey(normalizedFinal, action))) continue;
          consider(action.href, publicAction(action), priority);
        }

        for (const candidate of extracted.navigation) {
          if (!isGenericLinkAllowed(candidate.url, candidate.text, origin)) continue;
          const arrival = candidate.text ? { label: candidate.text, type: "link" } : undefined;
          consider(candidate.url, arrival, later);
        }

        let clicks = 0;
        for (const action of discovered) {
          if (clicks >= 3 || pages.length >= options.maxPages) break;
          if (decideFollow(action, signals) !== "click") continue;
          if (!claim(usedActions, actionKey(normalizedFinal, action))) continue;
          clicks += 1;
          try {
            const landed = await clickIfSafe(page, action, clickTimeout);
            if (!landed || !origin) continue;
            if (new URL(landed).origin !== origin) {
              await page.goBack({ timeout: clickTimeout }).catch(() => undefined);
              continue;
            }
            consider(landed, publicAction(action), priority);
          } catch (error) {
            errors.push(`${finalUrl}: unable to use “${action.label}” (${shortError(error)})`);
          }
        }

        if (priority.length > 0) queue.unshift(...priority);
        if (later.length > 0) queue.push(...later);
      } catch (error) {
        const message = shortError(error);
        errors.push(`${current.url}: ${message}`);
        console.error(`Failed to crawl ${current.url}: ${message}`);
      }
    }
  } catch (error) {
    if (error instanceof CrawlError) throw error;
    throw new CrawlError("Unable to crawl the site", { cause: error });
  } finally {
    await browser?.close();
  }

  return { pages, errors, journeys: buildJourneyRecords(visits), kinds: visits.map((visit) => visit.kind) };
}
