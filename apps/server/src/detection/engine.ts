import type { DetectionPage, Finding } from "./types.js";
import { dedupeFindings } from "./utils.js";
import { detectBasketSneaking } from "./rules/basket-sneaking.js";
import { detectConfirmShaming } from "./rules/confirm-shaming.js";
import { detectFalseUrgency } from "./rules/false-urgency.js";
import { detectForcedAction } from "./rules/forced-action.js";
import { detectPreselection } from "./rules/preselection.js";

const detectors = [
  detectFalseUrgency,
  detectConfirmShaming,
  detectBasketSneaking,
  detectForcedAction,
  detectPreselection,
];

export function runDetection(page: DetectionPage): Finding[] {
  return dedupeFindings(detectors.flatMap((detect) => detect(page)));
}
