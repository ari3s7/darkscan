import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import { env } from "../config/env.js";
import { launchBrowser } from "./browser.js";
import { extractPage } from "./page-extractor.js";
import { CrawlError, type CrawledPage } from "./types.js";

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
 * Loads one page, extracts its visible content and controls, and saves a screenshot.
 */
export async function crawlPage(
  url: string,
  options: { screenshotDir: string; screenshotPathPrefix: string },
): Promise<CrawledPage> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;

  try {
    browser = await launchBrowser();
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(env.crawlTimeoutMs);
    await mkdir(options.screenshotDir, { recursive: true });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: env.crawlTimeoutMs,
    });
    const extracted = await extractPage(page);
    const fileName = "00.png";
    let screenshotPath: string | null = `${options.screenshotPathPrefix}/${fileName}`;
    try {
      await saveScreenshot(page, join(options.screenshotDir, fileName));
    } catch (error) {
      screenshotPath = null;
      console.error(`Screenshot failed for ${page.url()}`, error);
    }

    return {
      requestedUrl: url,
      finalUrl: page.url(),
      title: extracted.title,
      statusCode: response?.status() ?? null,
      contentType: blankToNull(response?.headers()["content-type"] ?? null),
      language: extracted.language,
      description: extracted.description,
      visibleText: extracted.visibleText,
      interactions: extracted.interactions,
      screenshotPath,
    };
  } catch (error) {
    if (error instanceof CrawlError) throw error;
    throw new CrawlError("Unable to load the page", { cause: error });
  } finally {
    await browser?.close();
  }
}
