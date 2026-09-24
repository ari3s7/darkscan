import { rules, type DarkPatternRule } from "@darkscan/rules";

export type DetectionStatus = "active" | "defined";

export interface RuleProfile {
  id: string;
  name: string;
  description: string;
  regulatoryReference: string;
  detectionStatus: DetectionStatus;
  suggestedRemediation: string;
}

/** Rule ids the current detectors can emit. The rest of the catalog stays defined-only. */
const ACTIVE_RULES = new Set(["false-urgency", "basket-sneaking", "confirm-shaming", "forced-action", "preselection"]);

const REMEDIATION: Record<string, string> = {
  "false-urgency": "Show a real end time, or remove the countdown when the offer is not actually expiring.",
  "basket-sneaking": "Leave optional products and fees unselected, and show their price before they are added.",
  "confirm-shaming": "Use a neutral opt-out label such as “No thanks”.",
  "forced-action": "Let the user finish the task without an unrelated account or purchase when an alternative exists.",
  "subscription-trap": "Make cancellation as easy to find and complete as signup.",
  "interface-interference": "Present choices with similar visual weight, and leave optional items unselected.",
  "bait-and-switch": "Deliver the outcome the control’s label describes.",
  "drip-pricing": "Show the full price, including unavoidable fees, before the user commits.",
  "disguised-advertisement": "Label advertising distinctly from editorial or user content.",
  nagging: "Limit repeated prompts and keep a clear way to dismiss them.",
  "trick-question": "Ask one thing at a time, in plain language, without double negatives.",
  "saas-billing": "State the renewal amount and date before charging, and provide a clear way to stop.",
  "rogue-malware": "Do not claim a device is infected in order to sell a removal tool.",
  preselection: "Leave paid or marketing options unselected until the user opts in.",
};

const PRESELECTION: RuleProfile = {
  id: "preselection",
  name: "Preselection",
  description: "A paid or marketing option is already selected before the user chooses it.",
  regulatoryReference:
    "Potentially applicable as interface interference under the Guidelines for Prevention and Regulation of Dark Patterns, 2023 (Central Consumer Protection Authority). Preselection is not itself one of the 13 specified pattern names. This is not a determination that the practice is non-compliant.",
  detectionStatus: "active",
  suggestedRemediation: REMEDIATION.preselection ?? "",
};

export function detectionStatus(ruleId: string): DetectionStatus {
  return ACTIVE_RULES.has(ruleId) ? "active" : "defined";
}

export function profileFor(ruleId: string): RuleProfile {
  if (ruleId === "preselection") return PRESELECTION;
  const rule = rules.find((entry) => entry.id === ruleId);
  if (!rule) {
    return {
      id: ruleId,
      name: ruleId,
      description: "A potential dark pattern was recorded for this rule id.",
      regulatoryReference:
        "No specified guideline category is attached to this rule id. This is not a determination that the practice is non-compliant.",
      detectionStatus: "defined",
      suggestedRemediation: "Review the recorded element and remove the pressure if the user did not choose it.",
    };
  }
  return profileFromRule(rule);
}

export function catalogProfiles(): RuleProfile[] {
  return rules.map(profileFromRule);
}

function profileFromRule(rule: DarkPatternRule): RuleProfile {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    regulatoryReference: rule.regulatoryReference,
    detectionStatus: detectionStatus(rule.id),
    suggestedRemediation: REMEDIATION[rule.id] ?? "Review the recorded element with the user flow in mind.",
  };
}
