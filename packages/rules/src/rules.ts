import type { DarkPatternRule } from "./types.js";

/**
 * Category definitions from India's specified dark patterns
 * (Guidelines for Prevention and Regulation of Dark Patterns, 2023).
 * Detectors live in the server. This catalog does not decide that a page is unlawful.
 */
function specified(rule: Pick<DarkPatternRule, "id" | "name" | "description">): DarkPatternRule {
  return {
    ...rule,
    regulatoryReference: `Potentially applicable under the Guidelines for Prevention and Regulation of Dark Patterns, 2023 (Central Consumer Protection Authority), which specify “${rule.name}”. This is not a determination that the practice is non-compliant.`,
    detectionStrategy: "placeholder",
  };
}

export const rules: readonly DarkPatternRule[] = [
  specified({
    id: "false-urgency",
    name: "False Urgency",
    description:
      "Implying scarcity or a deadline that is untrue so a user feels they must act immediately.",
  }),
  specified({
    id: "basket-sneaking",
    name: "Basket Sneaking",
    description:
      "Adding extra products, services, donations, or fees at checkout without the user's consent.",
  }),
  specified({
    id: "confirm-shaming",
    name: "Confirm Shaming",
    description:
      "Using guilt, shame, fear, or ridicule to push a user toward a particular choice.",
  }),
  specified({
    id: "forced-action",
    name: "Forced Action",
    description:
      "Requiring an unrelated purchase, signup, or disclosure of personal information to finish the action the user intended.",
  }),
  specified({
    id: "subscription-trap",
    name: "Subscription Trap",
    description:
      "Making cancellation hard to find or complete, or renewing a subscription without a clear active choice.",
  }),
  specified({
    id: "interface-interference",
    name: "Interface Interference",
    description:
      "Highlighting some choices and hiding or de-emphasizing others so the user is steered away from the action they wanted.",
  }),
  specified({
    id: "bait-and-switch",
    name: "Bait and Switch",
    description:
      "Advertising one result of a user's action and then delivering a different result.",
  }),
  specified({
    id: "drip-pricing",
    name: "Drip Pricing",
    description:
      "Withholding parts of the price until late in the flow, or blocking a service unless a higher price is paid.",
  }),
  specified({
    id: "disguised-advertisement",
    name: "Disguised Advertisement",
    description:
      "Presenting an advertisement as editorial content, a user post, or another non-ad format.",
  }),
  specified({
    id: "nagging",
    name: "Nagging",
    description:
      "Repeated prompts or interruptions that pressure a user into a transaction, signup, or consent.",
  }),
  specified({
    id: "trick-question",
    name: "Trick Question",
    description:
      "Using confusing wording, double negatives, or ambiguous options so the user chooses something they did not intend.",
  }),
  specified({
    id: "saas-billing",
    name: "SaaS Billing",
    description:
      "Collecting recurring software payments in a way that is easy to start and difficult to notice, understand, or stop.",
  }),
  specified({
    id: "rogue-malware",
    name: "Rogue Malware",
    description:
      "Scaring a user into believing a device is infected in order to sell a fake removal tool or install harmful software.",
  }),
];
