import type { Browser } from "playwright";
import { env } from "../config/env.js";
import { launchBrowser } from "./browser.js";
import { CrawlError, type CrawledPage } from "./types.js";

/**
 * Loads a single page and returns its URL, title, and status.
 * Extraction and site navigation are later steps.
 */
export async function crawlPage(url: string): Promise<CrawledPage> {
  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: env.crawlTimeoutMs,
    });
    const title = (await page.title()).trim();

    return {
      requestedUrl: url,
      finalUrl: page.url(),
      title: title || null,
      statusCode: response?.status() ?? null,
    };
  } catch (error) {
    if (error instanceof CrawlError) throw error;
    throw new CrawlError("Unable to load the page", { cause: error });
  } finally {
    await browser?.close();
  }
}
