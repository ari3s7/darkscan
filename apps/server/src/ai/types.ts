import type { Interaction } from "../crawler/types.js";
import type { Finding } from "../detection/types.js";

export type AiStatus = "completed" | "skipped" | "unavailable";

export interface AiAssessment {
  isPotentialDarkPattern: boolean;
  ruleId: string;
  confidence: number;
  reasoning: string;
  evidence: string[];
}

export interface AiElement {
  text: string;
  selector?: string;
  hidden?: boolean;
}

export interface AiRuleSignal {
  ruleId: string;
  confidence: number;
  evidence: string;
}

export interface AiPageInput {
  id: string;
  url: string;
  title: string | null;
  visibleText: string;
  interactions: Interaction[];
  screenshotPath: string | null;
  journeyType?: string;
  pageKind?: string;
  ruleFindings: Finding[];
}

/** The only context sent to the model for one page. */
export interface AiCandidate {
  pageId: string;
  url: string;
  title: string | null;
  journeyType?: string;
  pageKind?: string;
  excerpts: string[];
  elements: AiElement[];
  ruleSignals: AiRuleSignal[];
  screenshotPath?: string;
  includeScreenshot: boolean;
}

export interface AiCompletionRequest {
  system: string;
  user: string;
  screenshotPath?: string;
}

export interface AiClient {
  complete(request: AiCompletionRequest): Promise<unknown>;
}

export interface AiAnalysisResult {
  status: AiStatus;
  findings: Finding[];
}
