import type { Interaction } from "../../crawler/types.js";
import type { DetectionPage, Finding } from "../types.js";
import { dedupeFindings, elementLabel, elementSelector, matchesAnyKeyword } from "../utils.js";

/** Checked boxes with these words are treated as ordinary consent, not a preselected extra. */
export const consentExclusions: readonly string[] = [
  "terms",
  "privacy",
  "conditions",
  "policy",
  "age",
  "remember me",
];

/** Selected choices that look like a paid or marketing default. */
export const paidOptionKeywords: readonly string[] = [
  "express",
  "premium",
  "protection",
  "warranty",
  "insurance",
  "donation",
  "gift wrap",
  "add-on",
  "addon",
];

function isConsent(text: string, exclusions: readonly string[]): boolean {
  return matchesAnyKeyword(text, exclusions);
}

function isPaidOption(text: string, keywords: readonly string[]): boolean {
  return matchesAnyKeyword(text, keywords);
}

function pushElement(evidence: Finding["evidence"], interaction: Interaction, label: string): void {
  const selector = elementSelector(interaction);
  evidence.push(selector ? { type: "element", value: label, selector } : { type: "element", value: label });
}

export function detectPreselection(
  page: DetectionPage,
  exclusions: readonly string[] = consentExclusions,
  paidKeywords: readonly string[] = paidOptionKeywords,
): Finding[] {
  const evidence: Finding["evidence"] = [];
  let confidence = 0;
  let severity: Finding["severity"] = "medium";

  for (const interaction of page.interactions) {
    const label = elementLabel(interaction);
    if (!label) continue;
    const recorded = interaction.text?.trim() || label;

    if (interaction.type === "checkbox" && interaction.checked === true && !isConsent(label, exclusions)) {
      pushElement(evidence, interaction, recorded);
      confidence = Math.max(confidence, 0.8);
      continue;
    }

    if (interaction.type === "radio" && interaction.checked === true && isPaidOption(label, paidKeywords)) {
      pushElement(evidence, interaction, recorded);
      confidence = Math.max(confidence, 0.86);
      severity = "high";
      continue;
    }

    const optionLabel = interaction.text?.trim() ?? "";
    if (
      interaction.type === "input" &&
      !interaction.hidden &&
      optionLabel &&
      optionLabel.length <= 80 &&
      isPaidOption(optionLabel, paidKeywords)
    ) {
      pushElement(evidence, interaction, optionLabel);
      confidence = Math.max(confidence, 0.78);
    }
  }

  if (evidence.length === 0) return [];

  const sample = evidence[0]?.value ?? "selected control";
  return dedupeFindings([
    {
      ruleId: "preselection",
      ruleName: "Preselection",
      severity,
      confidence,
      pageId: page.id,
      description: `Potential dark pattern detected: a control is already selected (“${sample}”).`,
      evidence,
    },
  ]);
}
