import { rules } from "@darkscan/rules";
import type { AiCandidate } from "./types.js";

const RULE_IDS = [...rules.map((rule) => rule.id), "preselection"].join(", ");

export const AI_SYSTEM_PROMPT = [
  "You review one web page for a potential dark pattern.",
  "Use only the supplied excerpts, element labels, rule signals, and screenshot when one is attached.",
  "Do not invent text, selectors, prices, or events.",
  "If the supplied evidence is not enough, set isPotentialDarkPattern to false and evidence to an empty array.",
  "Describe a potential pattern. Do not say the page is illegal, unlawful, or non-compliant.",
  `ruleId must be one of: ${RULE_IDS}.`,
  "confidence is a number from 0 to 1.",
  "evidence must be exact quotes copied from the supplied excerpts or element labels, or the supplied screenshot path.",
  "Return only JSON with keys isPotentialDarkPattern, ruleId, confidence, reasoning, evidence.",
].join(" ");

export function buildUserPrompt(candidate: AiCandidate): string {
  return JSON.stringify({
    url: candidate.url,
    title: candidate.title,
    journey: candidate.journeyType ?? null,
    pageKind: candidate.pageKind ?? null,
    excerpts: candidate.excerpts,
    elements: candidate.elements,
    ruleSignals: candidate.ruleSignals,
    screenshot: candidate.includeScreenshot ? (candidate.screenshotPath ?? null) : null,
  });
}
