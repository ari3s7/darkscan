import { normalizeUrl } from "../crawler/crawler.js";
import type { DiscoveredAction, FollowMode, PageSignals } from "./types.js";

const SKIP_EXTENSION =
  /\.(?:pdf|zip|png|jpe?g|gif|webp|svg|ico|css|js|mjs|map|mp4|mp3|woff2?|ttf|eot|gz|tgz|rar|7z|dmg|apk)$/i;
const UNSAFE_PATH = /\/(?:logout|log-out|signout|sign-out|delete|destroy|unsubscribe|deactivate)(?:\/|$)/i;

/** Labels that must never be activated. Add-to-cart and buy-now links are handled separately. */
const DESTRUCTIVE_LABEL =
  /\b(?:log ?out|sign ?out|delete|unsubscribe|deactivate|place order|pay now|complete purchase|complete order|confirm cancellation)\b/i;

const GENERIC_SKIP =
  /\b(?:log ?out|sign ?out|delete|unsubscribe|deactivate|buy now|place order|pay now|complete purchase|add to cart|complete order|remove)\b/i;

const PAYMENT_FIELD = /(?:card[\s_-]?number|credit[\s_-]?card|cvv|cvc|cc-number|cc-csc|security code)/i;
const SECRET_FIELD = /password|passwd/i;
const GUEST_ALTERNATIVE = /\b(?:continue\s+as\s+(?:a\s+)?guest|guest\s+checkout|continue\s+without)\b/i;
const STOP_EXCEPTIONS = new Set(["decline", "continue-without"]);

export interface StopDecision {
  stop: boolean;
  reason?: "authentication" | "payment";
}

export function shouldStop(signals: PageSignals): StopDecision {
  const payment = signals.fields.some((field) => PAYMENT_FIELD.test(`${field.name ?? ""} ${field.text ?? ""}`));
  if (payment) return { stop: true, reason: "payment" };

  const password = signals.fields.some(
    (field) => !field.hidden && SECRET_FIELD.test(`${field.name ?? ""} ${field.text ?? ""}`),
  );
  if (!password) return { stop: false };
  const guest = signals.buttons.some((label) => GUEST_ALTERNATIVE.test(label));
  if (guest) return { stop: false };
  return { stop: true, reason: "authentication" };
}

export function isDestructiveLabel(label: string): boolean {
  return DESTRUCTIVE_LABEL.test(label);
}

export function isPersonalField(field: { name?: string; text?: string }): boolean {
  return /(email|e-mail|phone|mobile|password|passwd|card|cvv|cvc|ssn|address)/i.test(
    `${field.name ?? ""} ${field.text ?? ""}`,
  );
}

export function isAllowedTarget(raw: string, origin: string): boolean {
  const normalized = normalizeUrl(raw);
  if (!normalized) return false;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  if (SKIP_EXTENSION.test(url.pathname) || UNSAFE_PATH.test(url.pathname)) return false;
  return true;
}

/** Generic links use the crawler's denylist. Journey actions go through decideFollow instead. */
export function isGenericLinkAllowed(raw: string, text: string | undefined, origin: string): boolean {
  if (!isAllowedTarget(raw, origin)) return false;
  if (text && (GENERIC_SKIP.test(text) || isDestructiveLabel(text))) return false;
  return true;
}

export function decideFollow(action: DiscoveredAction, signals: PageSignals): FollowMode {
  if (action.follow === "none" || isDestructiveLabel(action.label)) return "none";
  let origin: string;
  try {
    origin = new URL(signals.url).origin;
  } catch {
    return "none";
  }
  if (action.href) {
    const absolute = normalizeUrl(action.href, signals.url);
    if (!absolute || !isAllowedTarget(absolute, origin)) return "none";
  }
  const stop = shouldStop(signals);
  if (stop.stop && !STOP_EXCEPTIONS.has(action.kind)) return "none";
  return action.follow;
}

export type InteractionPlan = "open" | "click" | "skip";

/** The only planned operations are opening a link or clicking a flow control. Fields are never filled. */
export function interactionPlan(action: DiscoveredAction, signals: PageSignals): InteractionPlan {
  const mode = decideFollow(action, signals);
  if (mode === "link") return "open";
  if (mode === "click") return "click";
  return "skip";
}

export function actionKey(
  pageUrl: string,
  action: { kind?: string; label: string; selector?: string; type: string },
): string {
  return [pageUrl, action.kind ?? action.type, action.label.trim().toLowerCase(), action.selector ?? ""].join("|");
}

/** Returns true the first time the key is seen. */
export function claim(seen: Set<string>, key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
