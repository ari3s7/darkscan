import { chromium, type Browser } from "playwright";

export function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });
}
