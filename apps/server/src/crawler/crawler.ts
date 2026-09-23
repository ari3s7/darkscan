import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import { launchBrowser } from "./browser.js";
import { extractPage } from "./page-extractor.js";
import {
  CrawlError,
  type CrawledPage,
  type CrawlOptions,
  type CrawlResult,
  type NavigationCandidate,
} from "./types.js";

export const CRAWL_MAX_PAGES = 10;
export const CRAWL_MAX_DEPTH = 3;

const TRACKING_PARAM = /^(?:utm_|fbclid$|gclid$|mc_eid$|igshid$)/i;
const SKIP_EXTENSION =
  /\.(?:pdf|zip|png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|mp4|mp3|woff2?|ttf|eot|gz|tgz|rar|7z|dmg|apk)$/i;
const UNSAFE_PATH = /\/(?:logout|log-out|signout|sign-out|delete|destroy|unsubscribe|deactivate)(?:\/|$)/i;
const UNSAFE_TEXT =
  /\b(?:log ?out|sign ?out|delete|unsubscribe|deactivate|buy now|place order|pay now|complete purchase|add to cart|complete order)\b/i;

interface QueueItem {
  url: string;
  depth: number;
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeUrl(raw: string, base?: string): string | null {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

function sameOrigin(url: string, origin: string): boolean {
  return new URL(url).origin === origin;
}

function canFollow(candidate: NavigationCandidate, origin: string): string | null {
  const normalized = normalizeUrl(candidate.url);
  if (!normalized || !sameOrigin(normalized, origin)) return null;
  const path = new URL(normalized).pathname;
  if (SKIP_EXTENSION.test(path) || UNSAFE_PATH.test(path)) return null;
  if (candidate.text && UNSAFE_TEXT.test(candidate.text)) return null;
  return normalized;
}

function shortError(error: unknown): string {
  if (error instanceof Error) {
    const first = error.message.split("\n")[0] ?? error.message;
    return first.slice(0, 240);
  }
  return "Unable to load the page";
}

async function saveScreenshot(page: Page, filePath: string): Promise<void> {
  try {
    await page.screenshot({
      path: filePath,
      fullPage: true,
      animations: "disabled",
      timeout: 10_000,
    });
  } catch {
    await page.screenshot({
      path: filePath,
      fullPage: false,
      animations: "disabled",
      timeout: 10_000,
    });
  }
}

/**
 * Crawls one site from a starting URL. Detection is a later phase.
 * Stays on the starting origin, skips destructive targets, and stops at the page and depth limits.
 */
export async function crawlSite(startUrl: string, options: CrawlOptions): Promise<CrawlResult> {
  const start = normalizeUrl(startUrl);
  if (!start) {
    return { pages: [], errors: ["Starting URL is not a valid http(s) URL"] };
  }

  const pages: CrawledPage[] = [];
  const errors: string[] = [];
  const seen = new Set<string>([start]);
  const saved = new Set<string>();
  const queue: QueueItem[] = [{ url: start, depth: 0 }];
  let origin: string | null = null;

  let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(options.timeoutMs);
    await mkdir(options.screenshotDir, { recursive: true });

    while (queue.length > 0 && pages.length < options.maxPages) {
      const current = queue.shift();
      if (!current) break;

      try {
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

        const normalizedFinal = normalizeUrl(finalUrl) ?? finalUrl;
        if (saved.has(normalizedFinal)) continue;

        const contentTypeHeader = response?.headers()["content-type"] ?? null;
        const contentType = blankToNull(contentTypeHeader);
        if (
          contentType &&
          !contentType.includes("text/html") &&
          !contentType.includes("application/xhtml")
        ) {
          errors.push(`${current.url}: skipped non-HTML response`);
          continue;
        }

        const extracted = await extractPage(page);
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

        if (current.depth >= options.maxDepth) continue;
        for (const candidate of extracted.navigation) {
          const next = canFollow(candidate, origin);
          if (!next || seen.has(next) || queue.length + pages.length >= options.maxPages * 4) continue;
          seen.add(next);
          queue.push({ url: next, depth: current.depth + 1 });
        }
      } catch (error) {
        const message = shortError(error);
        errors.push(`${current.url}: ${message}`);
        console.error(`Failed to crawl ${current.url}`, error);
      }
    }
  } catch (error) {
    if (error instanceof CrawlError) throw error;
    throw new CrawlError("Unable to crawl the site", { cause: error });
  } finally {
    await browser?.close();
  }

  return { pages, errors };
}
