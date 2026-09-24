import type { Interaction } from "../../crawler/types.js";
import type { DetectionPage, Finding } from "../types.js";
import { dedupeFindings, elementLabel, elementSelector, matchesAnyKeyword } from "../utils.js";

/** Optional extras. A match counts only when the extra is already selected or attached. */
export const basketSneakingKeywords: readonly string[] = [
  "insurance",
  "protection plan",
  "purchase protection",
  "protection",
  "warranty",
  "extended warranty",
  "donation",
  "add-on",
  "addon",
  "gift wrap",
];

const notAnExtra = /\b(?:data|privacy|password)\s+protection\b/i;

function isOptionalExtra(text: string, keywords: readonly string[]): boolean {
  if (!text.trim() || notAnExtra.test(text)) return false;
  return matchesAnyKeyword(text, keywords);
}

function selectedControl(interaction: Interaction): boolean {
  return (interaction.type === "checkbox" || interaction.type === "radio") && interaction.checked === true;
}

function hiddenFee(interaction: Interaction): boolean {
  if (!interaction.hidden) return false;
  const name = interaction.name ?? "";
  return /fee|price|cost|charge|addon|add-on/i.test(name) && Boolean(interaction.value?.trim());
}

export function detectBasketSneaking(
  page: DetectionPage,
  keywords: readonly string[] = basketSneakingKeywords,
): Finding[] {
  const evidence: Finding["evidence"] = [];

  for (const interaction of page.interactions) {
    const haystack = elementLabel(interaction).replaceAll("_", " ");
    if (!isOptionalExtra(haystack, keywords)) continue;

    const selector = elementSelector(interaction);
    const label = interaction.text?.trim() || haystack;
    if (selectedControl(interaction)) {
      evidence.push(
        selector
          ? { type: "element", value: label, selector }
          : { type: "element", value: label },
      );
      continue;
    }

    if (hiddenFee(interaction)) {
      const value = `${interaction.name ?? "fee"}=${interaction.value ?? ""}`;
      evidence.push(
        selector
          ? { type: "attribute", value, selector }
          : { type: "attribute", value },
      );
    }
  }

  if (evidence.length === 0) return [];

  const sample = evidence[0]?.value ?? "optional add-on";
  return dedupeFindings([
    {
      ruleId: "basket-sneaking",
      ruleName: "Basket Sneaking",
      severity: "high",
      confidence: evidence.some((item) => item.type === "attribute") ? 0.84 : 0.9,
      pageId: page.id,
      description: `Potential dark pattern detected: an optional add-on appears selected (“${sample}”).`,
      evidence,
    },
  ]);
}
