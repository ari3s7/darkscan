import type { DetectionPage, Finding } from "../types.js";
import { dedupeFindings, matchSnippets, type WeightedPattern } from "../utils.js";

/**
 * Phrases that imply a closing window. Bare clock times and calendar dates are intentionally absent.
 * Replace this list to tune the rule without changing the detector.
 */
export const falseUrgencyPatterns: readonly WeightedPattern[] = [
  {
    pattern: /\bonly\s+\d{1,3}\s+(?:seconds?|minutes?|hours?)\s+left\b/i,
    confidence: 0.92,
    severity: "high",
  },
  {
    pattern: /\b(?:ends|expires|expiring)\s+in\s+\d{1,3}\s+(?:seconds?|minutes?|hours?)\b/i,
    confidence: 0.9,
    severity: "high",
  },
  {
    pattern: /\boffer\s+ends\s+soon\b/i,
    confidence: 0.84,
    severity: "medium",
  },
  {
    pattern: /\blimited[- ]time\b/i,
    confidence: 0.8,
    severity: "medium",
  },
  {
    pattern: /\bsale\s+ends\s+(?:soon|today|tonight)\b/i,
    confidence: 0.8,
    severity: "medium",
  },
];

export function detectFalseUrgency(
  page: DetectionPage,
  patterns: readonly WeightedPattern[] = falseUrgencyPatterns,
): Finding[] {
  const sources = [page.title, page.visibleText].filter((part): part is string => Boolean(part));
  const evidence: Finding["evidence"] = [];
  let confidence = 0;
  let severity: Finding["severity"] = "low";

  for (const source of sources) {
    for (const pattern of patterns) {
      const snippets = matchSnippets(source, pattern.pattern);
      if (snippets.length === 0) continue;
      if (pattern.confidence > confidence) {
        confidence = pattern.confidence;
        severity = pattern.severity;
      }
      for (const snippet of snippets) {
        evidence.push({ type: "text", value: snippet });
      }
    }
  }

  if (evidence.length === 0) return [];

  const sample = evidence[0]?.value ?? "time-pressure language";
  return dedupeFindings([
    {
      ruleId: "false-urgency",
      ruleName: "False Urgency",
      severity,
      confidence,
      pageId: page.id,
      description: `Potential dark pattern detected: time-pressure language (“${sample}”).`,
      evidence,
    },
  ]);
}
