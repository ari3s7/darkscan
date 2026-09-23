import type { DarkPatternRule } from "./types.js";

/**
 * Category definitions from India's specified dark patterns
 * (CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023).
 * Detection is intentionally not implemented.
 */
export const rules: readonly DarkPatternRule[] = [
  {
    id: "false-urgency",
    name: "False Urgency",
    description:
      "Implying scarcity or a deadline that is untrue so a user feels they must act immediately.",
    detectionStrategy: "placeholder",
  },
  {
    id: "basket-sneaking",
    name: "Basket Sneaking",
    description:
      "Adding extra products, services, donations, or fees at checkout without the user's consent.",
    detectionStrategy: "placeholder",
  },
  {
    id: "confirm-shaming",
    name: "Confirm Shaming",
    description:
      "Using guilt, shame, fear, or ridicule to push a user toward a particular choice.",
    detectionStrategy: "placeholder",
  },
  {
    id: "forced-action",
    name: "Forced Action",
    description:
      "Requiring an unrelated purchase, signup, or disclosure of personal information to finish the action the user intended.",
    detectionStrategy: "placeholder",
  },
  {
    id: "subscription-trap",
    name: "Subscription Trap",
    description:
      "Making cancellation hard to find or complete, or renewing a subscription without a clear active choice.",
    detectionStrategy: "placeholder",
  },
  {
    id: "interface-interference",
    name: "Interface Interference",
    description:
      "Highlighting some choices and hiding or de-emphasizing others so the user is steered away from the action they wanted.",
    detectionStrategy: "placeholder",
  },
  {
    id: "bait-and-switch",
    name: "Bait and Switch",
    description:
      "Advertising one result of a user's action and then delivering a different result.",
    detectionStrategy: "placeholder",
  },
  {
    id: "drip-pricing",
    name: "Drip Pricing",
    description:
      "Withholding parts of the price until late in the flow, or blocking a service unless a higher price is paid.",
    detectionStrategy: "placeholder",
  },
  {
    id: "disguised-advertisement",
    name: "Disguised Advertisement",
    description:
      "Presenting an advertisement as editorial content, a user post, or another non-ad format.",
    detectionStrategy: "placeholder",
  },
  {
    id: "nagging",
    name: "Nagging",
    description:
      "Repeated prompts or interruptions that pressure a user into a transaction, signup, or consent.",
    detectionStrategy: "placeholder",
  },
  {
    id: "trick-question",
    name: "Trick Question",
    description:
      "Using confusing wording, double negatives, or ambiguous options so the user chooses something they did not intend.",
    detectionStrategy: "placeholder",
  },
  {
    id: "saas-billing",
    name: "SaaS Billing",
    description:
      "Collecting recurring software payments in a way that is easy to start and difficult to notice, understand, or stop.",
    detectionStrategy: "placeholder",
  },
  {
    id: "rogue-malware",
    name: "Rogue Malware",
    description:
      "Scaring a user into believing a device is infected in order to sell a fake removal tool or install harmful software.",
    detectionStrategy: "placeholder",
  },
];
