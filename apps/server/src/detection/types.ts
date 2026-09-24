import type { Interaction } from "../crawler/types.js";

export type Severity = "low" | "medium" | "high";

export interface EvidenceItem {
  type: "text" | "element" | "attribute";
  value: string;
  selector?: string;
}

/** A finding. Confidence is a signal weight, not a learned score. */
export interface Finding {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  confidence: number;
  pageId: string;
  description: string;
  evidence: EvidenceItem[];
}

export interface DetectionPage {
  id: string;
  url: string;
  title: string | null;
  visibleText: string;
  interactions: Interaction[];
}
