import type { DetectionPage, Finding } from "../types.js";
import { dedupeFindings, elementLabel, elementSelector, matchSnippets, type WeightedPattern } from "../utils.js";

/** Account walls. A hit counts only when a guest-style alternative is also present. */
export const forcedActionPatterns: readonly WeightedPattern[] = [
  {
    pattern: /\b(?:create an account|sign up|register|log in|login)\b[^.!?\n]{0,48}\b(?:to continue|to proceed|to checkout|to check out|to complete|required)\b/i,
    confidence: 0.86,
    severity: "medium",
  },
  {
    pattern: /\b(?:account|registration|sign-?up)\s+(?:is\s+)?required\s+to\s+(?:continue|proceed|checkout|check out|complete)\b/i,
    confidence: 0.86,
    severity: "medium",
  },
];

export const guestAlternativePatterns: readonly WeightedPattern[] = [
  {
    pattern: /\b(?:continue|checkout|check out)\s+as\s+(?:a\s+)?guest\b/i,
    confidence: 0.8,
    severity: "medium",
  },
  {
    pattern: /\bguest\s+checkout\b/i,
    confidence: 0.8,
    severity: "medium",
  },
  {
    pattern: /\bcontinue\s+without\s+(?:an\s+)?account\b/i,
    confidence: 0.8,
    severity: "medium",
  },
];

function collect(
  page: DetectionPage,
  patterns: readonly WeightedPattern[],
): { onControl: boolean; evidence: Finding["evidence"]; confidence: number } {
  const evidence: Finding["evidence"] = [];
  let onControl = false;
  let confidence = 0;

  const sources: Array<{ text: string; selector?: string; fromControl: boolean }> = [
    { text: page.visibleText, fromControl: false },
  ];
  for (const interaction of page.interactions) {
    if (interaction.type !== "button" && interaction.type !== "link") continue;
    const text = elementLabel(interaction);
    if (!text) continue;
    sources.push({ text, selector: elementSelector(interaction), fromControl: true });
  }

  for (const source of sources) {
    for (const pattern of patterns) {
      const snippets = matchSnippets(source.text, pattern.pattern);
      if (snippets.length === 0) continue;
      if (source.fromControl) onControl = true;
      confidence = Math.max(confidence, pattern.confidence);
      for (const snippet of snippets) {
        if (source.fromControl) {
          evidence.push(
            source.selector
              ? { type: "element", value: snippet, selector: source.selector }
              : { type: "element", value: snippet },
          );
        } else {
          evidence.push({ type: "text", value: snippet });
        }
      }
    }
  }

  return { onControl, evidence, confidence };
}

export function detectForcedAction(
  page: DetectionPage,
  requirements: readonly WeightedPattern[] = forcedActionPatterns,
  alternatives: readonly WeightedPattern[] = guestAlternativePatterns,
): Finding[] {
  const required = collect(page, requirements);
  const alternative = collect(page, alternatives);
  if (required.evidence.length === 0 || alternative.evidence.length === 0) return [];

  const onControl = required.onControl || alternative.onControl;
  return dedupeFindings([
    {
      ruleId: "forced-action",
      ruleName: "Forced Action",
      severity: onControl ? "medium" : "low",
      confidence: onControl ? Math.max(required.confidence, 0.8) : 0.64,
      pageId: page.id,
      description:
        "Potential dark pattern detected: account creation is presented as required even though a guest alternative is available.",
      evidence: [...required.evidence, ...alternative.evidence],
    },
  ]);
}
