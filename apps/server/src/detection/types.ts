import type { Interaction } from "../crawler/types.js";

export type Severity = "low" | "medium" | "high";

export interface EvidenceItem {
  type: "text" | "element" | "attribute";
  value: string;
  selector?: string;
}

/** A finding. Rule confidence is a signal weight. AI confidence is the validated model score. */
export interface Finding {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  confidence: number;
  pageId: string;
  description: string;
  evidence: EvidenceItem[];
  source?: "rule" | "ai";
  reasoning?: string;
}

export interface DetectionPage {
  id: string;
  url: string;
  title: string | null;
  visibleText: string;
  interactions: Interaction[];
}
