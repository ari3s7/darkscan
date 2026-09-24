import type { Interaction } from "../../crawler/types.js";
import type { DetectionPage, Finding } from "../types.js";
import { dedupeFindings, elementLabel, elementSelector, matchSnippets, type WeightedPattern } from "../utils.js";

/**
 * Opt-out copy that shames the decline. A bare "No thanks" is not included.
 * Replace this list to tune the rule.
 */
export const confirmShamingPatterns: readonly WeightedPattern[] = [
  {
    pattern: /\bno,?\s+i\s+(?:do not|don't|dont)\s+(?:want|need|like)\b/i,
    confidence: 0.9,
    severity: "medium",
  },
  {
    pattern: /\bno\s+thanks?,?\s+.{0,80}\b(?:prefer|pay|miss|hate|don't|dont|do not|want)\b/i,
    confidence: 0.86,
    severity: "medium",
  },
  {
    pattern: /\bi(?:'d| would)\s+rather\s+(?:pay|miss|stay)\b/i,
    confidence: 0.84,
    severity: "medium",
  },
];

function controlCopy(interaction: Interaction): string {
  return elementLabel(interaction);
}

export function detectConfirmShaming(
  page: DetectionPage,
  patterns: readonly WeightedPattern[] = confirmShamingPatterns,
): Finding[] {
  const controls = page.interactions.filter(
    (interaction) => interaction.type === "button" || interaction.type === "link",
  );
  const evidence: Finding["evidence"] = [];
  let confidence = 0;
  let severity: Finding["severity"] = "medium";

  for (const control of controls) {
    const copy = controlCopy(control);
    if (!copy) continue;
    for (const pattern of patterns) {
      const snippets = matchSnippets(copy, pattern.pattern);
      if (snippets.length === 0) continue;
      if (pattern.confidence > confidence) {
        confidence = pattern.confidence;
        severity = pattern.severity;
      }
      const selector = elementSelector(control);
      for (const snippet of snippets) {
        evidence.push(selector ? { type: "element", value: snippet, selector } : { type: "element", value: snippet });
      }
    }
  }

  if (evidence.length === 0) return [];

  const sample = evidence[0]?.value ?? "shaming opt-out";
  return dedupeFindings([
    {
      ruleId: "confirm-shaming",
      ruleName: "Confirm Shaming",
      severity,
      confidence,
      pageId: page.id,
      description: `Potential dark pattern detected: the opt-out uses shaming language (“${sample}”).`,
      evidence,
    },
  ]);
}
