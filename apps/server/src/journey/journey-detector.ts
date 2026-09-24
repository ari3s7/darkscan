import type { Interaction, PageExtraction } from "../crawler/types.js";
import type { ActionKind, DiscoveredAction, FollowMode, PageKind, PageSignals } from "./types.js";

interface KindRule {
  kind: PageKind;
  rank: number;
  url?: RegExp;
  title?: RegExp;
  heading?: RegExp;
  button?: RegExp;
  text?: RegExp;
}

/** Higher rank wins a tie. A score below 3 stays unknown so nav chrome does not classify the page. */
const KIND_RULES: readonly KindRule[] = [
  {
    kind: "confirmation",
    rank: 100,
    url: /\/(?:thank-?you|confirmation|order-complete|success)(?:\/|$)/i,
    title: /\b(?:thank you|order confirmed|order complete|payment successful)\b/i,
    heading: /\b(?:thank you|order confirmed|you're all set|order complete)\b/i,
    text: /\b(?:thank you for your order|order has been confirmed|payment successful)\b/i,
  },
  {
    kind: "cancellation",
    rank: 90,
    url: /\/(?:cancel|cancellation)(?:\/|$)/i,
    title: /\b(?:cancel subscription|cancellation|cancel your plan|cancel your subscription)\b/i,
    heading: /\b(?:cancel subscription|cancellation|cancel your plan)\b/i,
    text: /\b(?:cancel your subscription|cancellation policy)\b/i,
  },
  {
    kind: "checkout",
    rank: 80,
    url: /\/(?:checkout|check-out|payment)(?:\/|$)/i,
    title: /\b(?:checkout|payment|billing)\b/i,
    heading: /\b(?:checkout|payment details|shipping address|billing details)\b/i,
    text: /\b(?:place your order|payment method|card number)\b/i,
  },
  {
    kind: "cart",
    rank: 70,
    url: /\/(?:cart|basket|bag)(?:\/|$)/i,
    title: /\b(?:your cart|shopping cart|your basket|your bag)\b/i,
    heading: /\b(?:your cart|shopping cart|your basket|your bag)\b/i,
  },
  {
    kind: "signup",
    rank: 66,
    url: /\/(?:signup|sign-up|register|create-account)(?:\/|$)/i,
    title: /\b(?:sign up|create an account|create account|register|start free trial)\b/i,
    heading: /\b(?:sign up|create an account|create account|start free trial)\b/i,
  },
  {
    kind: "login",
    rank: 60,
    url: /\/(?:login|log-in|signin|sign-in)(?:\/|$)/i,
    title: /\b(?:sign in|log in|login)\b/i,
    heading: /\b(?:sign in|log in|login)\b/i,
  },
  {
    kind: "subscription",
    rank: 50,
    url: /\/(?:subscription|subscriptions|manage-subscription)(?:\/|$)/i,
    title: /\b(?:manage subscription|my subscription|current plan)\b/i,
    heading: /\b(?:manage subscription|my subscription|current plan)\b/i,
  },
  {
    kind: "pricing",
    rank: 40,
    url: /\/(?:pricing|plans)(?:\/|$)/i,
    title: /\b(?:pricing|plans)\b/i,
    heading: /\b(?:pricing|choose a plan|plans)\b/i,
  },
  {
    kind: "product",
    rank: 30,
    url: /\/(?:product|products|item)(?:\/|$)/i,
    title: /\b(?:add to cart|buy now)\b/i,
    heading: /\bproduct details\b/i,
    button: /\b(?:add to cart|buy now)\b/i,
  },
];

/** Matched in order so a longer phrase wins over a shorter one. */
export const actionPatterns: readonly { kind: ActionKind; pattern: RegExp }[] = [
  {
    kind: "continue-without",
    pattern: /\b(?:continue\s+without|continue\s+as\s+(?:a\s+)?guest|guest\s+checkout|checkout\s+as\s+guest)\b/i,
  },
  { kind: "manage-subscription", pattern: /\bmanage\s+subscription\b/i },
  { kind: "start-free-trial", pattern: /\bstart\s+(?:a\s+)?free\s+trial\b/i },
  { kind: "add-to-cart", pattern: /\badd\s+to\s+(?:cart|bag|basket)\b/i },
  { kind: "buy-now", pattern: /\bbuy\s+now\b/i },
  { kind: "checkout", pattern: /\b(?:check\s*out|checkout)\b/i },
  { kind: "subscribe", pattern: /\bsubscribe\b/i },
  { kind: "sign-up", pattern: /\b(?:sign\s+up|create\s+an?\s+account|register)\b/i },
  { kind: "cancel", pattern: /\b(?:cancel(?:\s+subscription|\s+plan)?|cancellation)\b/i },
  { kind: "decline", pattern: /\b(?:decline|no\s+thanks)\b/i },
  { kind: "remove", pattern: /\bremove\b/i },
  { kind: "continue", pattern: /\bcontinue\b/i },
];

const LINK_ONLY = new Set<ActionKind>([
  "buy-now",
  "subscribe",
  "start-free-trial",
  "sign-up",
  "manage-subscription",
  "cancel",
]);

const CLICKABLE = new Set<ActionKind>(["add-to-cart", "continue", "checkout", "decline", "continue-without"]);

function pathname(url: string): string {
  try {
    const path = new URL(url).pathname;
    if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
    return path || "/";
  } catch {
    return "/";
  }
}

function isHome(path: string): boolean {
  return path === "/" || path === "/index" || path === "/index.html" || path === "/home";
}

export function classifyPage(signals: PageSignals): PageKind {
  const path = pathname(signals.url);
  const title = signals.title ?? "";
  let bestKind: PageKind = "unknown";
  let bestScore = 0;
  let bestRank = -1;

  for (const rule of KIND_RULES) {
    let score = 0;
    if (rule.url?.test(path)) score += 5;
    if (rule.title && title && rule.title.test(title)) score += 4;
    if (rule.heading && signals.headings.some((heading) => rule.heading?.test(heading))) score += 3;
    if (rule.button && signals.buttons.some((label) => rule.button?.test(label))) score += 2;
    if (rule.text && rule.text.test(signals.visibleText.slice(0, 4000))) score += 1;
    if (score > bestScore || (score === bestScore && score > 0 && rule.rank > bestRank)) {
      bestScore = score;
      bestRank = rule.rank;
      bestKind = rule.kind;
    }
  }

  if (bestScore >= 3) return bestKind;
  return isHome(path) ? "landing" : "unknown";
}

export function journeyTypeFor(kind: PageKind): string | null {
  switch (kind) {
    case "landing":
    case "product":
    case "pricing":
    case "cart":
    case "checkout":
    case "confirmation":
      return "checkout";
    case "signup":
    case "login":
      return "signup";
    case "subscription":
      return "subscription";
    case "cancellation":
      return "cancellation";
    default:
      return null;
  }
}

function selectorFor(interaction: Interaction): string | undefined {
  if (interaction.name && /^[\w.:-]+$/.test(interaction.name)) {
    const tag = interaction.type === "link" ? "a" : "button";
    return `${tag}[name="${interaction.name}"]`;
  }
  if ((interaction.type === "link" || interaction.type === "button") && interaction.text) {
    const role = interaction.type === "link" ? "link" : "button";
    return `role=${role}[name=${JSON.stringify(interaction.text)}]`;
  }
  if (interaction.type === "link" && interaction.value) {
    try {
      const path = new URL(interaction.value).pathname;
      if (path && path !== "/") return `a[href*="${path.replaceAll('"', "")}"]`;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function proposedFollow(kind: ActionKind, interaction: Interaction): FollowMode {
  if (kind === "remove") return "none";
  if (LINK_ONLY.has(kind)) return interaction.type === "link" && interaction.value ? "link" : "none";
  if (CLICKABLE.has(kind)) {
    if (interaction.type === "link" && interaction.value) return "link";
    if (interaction.type === "button") return "click";
  }
  return "none";
}

function matchKind(label: string, patterns: readonly { kind: ActionKind; pattern: RegExp }[]): ActionKind | null {
  for (const entry of patterns) {
    if (!entry.pattern.test(label)) continue;
    if (entry.kind === "cancel" && label.length > 48) continue;
    return entry.kind;
  }
  return null;
}

export function detectActions(
  interactions: Interaction[],
  patterns: readonly { kind: ActionKind; pattern: RegExp }[] = actionPatterns,
): DiscoveredAction[] {
  const actions: DiscoveredAction[] = [];
  const seen = new Set<string>();

  for (const interaction of interactions) {
    if (interaction.hidden || interaction.disabled) continue;
    if (interaction.type !== "button" && interaction.type !== "link") continue;
    const label = interaction.text?.trim();
    if (!label) continue;
    const kind = matchKind(label, patterns);
    if (!kind) continue;
    const selector = selectorFor(interaction);
    const key = `${kind}|${label.toLowerCase()}|${selector ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const action: DiscoveredAction = {
      label,
      type: interaction.type,
      kind,
      follow: proposedFollow(kind, interaction),
    };
    if (selector) action.selector = selector;
    if (interaction.type === "link" && interaction.value) action.href = interaction.value;
    actions.push(action);
  }

  return actions;
}

export function signalsFromExtraction(url: string, extracted: PageExtraction): PageSignals {
  const headings = extracted.visibleText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 1 && line.length <= 80)
    .slice(0, 1);
  const buttons = extracted.interactions
    .filter((item) => (item.type === "button" || item.type === "link") && item.text && !item.hidden)
    .map((item) => item.text ?? "");
  const fields = extracted.interactions
    .filter((item) => item.type === "input" || item.type === "checkbox" || item.type === "radio")
    .map((item) => {
      const field: PageSignals["fields"][number] = { type: item.type };
      if (item.name) field.name = item.name;
      if (item.text) field.text = item.text;
      if (item.hidden) field.hidden = true;
      return field;
    });
  return {
    url,
    title: extracted.title,
    headings,
    buttons,
    visibleText: extracted.visibleText,
    fields,
  };
}
