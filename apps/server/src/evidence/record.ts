import type { Interaction } from "../crawler/types.js";
import type { EvidenceItem, Finding } from "../detection/types.js";

export interface ElementBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvidenceContent {
  value: string;
  selector?: string;
  pageUrl: string;
  pageId: string;
  screenshotPath?: string;
  annotatedScreenshot?: string;
  box?: ElementBox;
  journeyStepId?: string;
  journeyId?: string;
  ruleId: string;
  ruleName: string;
  confidence: number;
  capturedAt: string;
  scanId: string;
  reasoning?: string;
  action?: { label: string; type: string; selector?: string };
}

export interface EvidenceRecord {
  type: EvidenceItem["type"];
  content: EvidenceContent;
}

export interface EvidenceSource {
  scanId: string;
  pageId: string;
  pageUrl: string;
  screenshotPath?: string | null;
  journeyStepId?: string;
  journeyId?: string;
  interactions: Interaction[];
  capturedAt: string;
  reasoning?: string;
  action?: { label: string; type: string; selector?: string };
}

export function evidenceKey(record: Pick<EvidenceRecord, "type" | "content">): string {
  const content = record.content;
  return [
    content.ruleId,
    record.type,
    content.value.trim().toLowerCase(),
    content.selector ?? "",
    content.pageUrl,
  ].join("|");
}

export function dedupeEvidence(records: EvidenceRecord[]): EvidenceRecord[] {
  const seen = new Set<string>();
  const unique: EvidenceRecord[] = [];
  for (const record of records) {
    const key = evidenceKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }
  return unique;
}

function nameFromSelector(selector: string): string | undefined {
  return /\[name="([^"]+)"\]/.exec(selector)?.[1];
}

function locate(item: EvidenceItem, interactions: Interaction[]): Interaction | undefined {
  if (item.selector) {
    const named = interactions.find((entry) => entry.selector === item.selector);
    if (named) return named;
    const name = nameFromSelector(item.selector);
    if (name) {
      const byName = interactions.find((entry) => entry.name === name);
      if (byName) return byName;
    }
  }
  const value = item.value.trim().toLowerCase();
  if (!value) return undefined;
  return interactions.find((entry) => {
    const text = entry.text?.trim().toLowerCase();
    return Boolean(text && (value === text || value.includes(text)));
  });
}

function isBox(value: Interaction["box"]): value is ElementBox {
  return Boolean(value && value.width > 0 && value.height > 0);
}

/** A record is returned only when it can be tied to a saved page. */
export function createEvidence(
  finding: Pick<Finding, "ruleId" | "ruleName" | "confidence" | "pageId">,
  item: EvidenceItem,
  source: EvidenceSource,
): EvidenceRecord | null {
  if (!source.pageId || !source.pageUrl || finding.pageId !== source.pageId) return null;
  const value = item.value.trim();
  if (!value) return null;
  const match = locate(item, source.interactions);
  const selector = item.selector ?? match?.selector;
  const content: EvidenceContent = {
    value,
    pageUrl: source.pageUrl,
    pageId: source.pageId,
    ruleId: finding.ruleId,
    ruleName: finding.ruleName,
    confidence: finding.confidence,
    capturedAt: source.capturedAt,
    scanId: source.scanId,
  };
  if (selector) content.selector = selector;
  if (source.screenshotPath) content.screenshotPath = source.screenshotPath;
  if (source.journeyStepId) content.journeyStepId = source.journeyStepId;
  if (source.journeyId) content.journeyId = source.journeyId;
  if (match && isBox(match.box)) content.box = match.box;
  if (source.reasoning) content.reasoning = source.reasoning;
  if (source.action) content.action = source.action;
  return { type: item.type, content };
}
