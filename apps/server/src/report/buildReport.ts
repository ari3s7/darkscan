import { evidenceKey, type EvidenceContent, type EvidenceRecord } from "../evidence/record.js";
import { catalogProfiles, profileFor, type RuleProfile } from "./profiles.js";

export interface ReportPage {
  id: string;
  url: string;
  finalUrl: string | null;
  screenshotPath: string | null;
}

export interface ReportEvidenceInput {
  id: string;
  type: string;
  content: unknown;
  createdAt: Date | string;
}

export interface ReportFindingInput {
  id: string;
  ruleId: string;
  source?: string | null;
  severity: string | null;
  summary: string;
  pageId: string;
  journeyStepId: string | null;
  createdAt: Date | string;
  evidence: ReportEvidenceInput[];
}

export interface ReportJourney {
  id: string;
  type: string;
  status: string;
  steps: { id: string; pageId: string | null }[];
}

export interface ReportEvidence {
  type: string;
  value: string;
  selector?: string;
  pageUrl: string;
  screenshotPath?: string;
  annotatedScreenshot?: string;
  box?: EvidenceContent["box"];
  journeyStepId?: string;
  journeyId?: string;
  ruleId: string;
  capturedAt: string;
}

export interface ReportFinding {
  ruleId: string;
  ruleName: string;
  pattern: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  source: "rule" | "ai";
  aiConfidence?: number;
  aiReasoning?: string;
  description: string;
  pageId: string;
  pageUrl: string;
  journeyId?: string;
  journeyType?: string;
  explanation: string;
  evidence: ReportEvidence[];
  regulatoryReference: string;
  suggestedRemediation: string;
}

export interface ComplianceReport {
  scanId: string;
  url: string;
  generatedAt: string;
  summary: {
    pagesCrawled: number;
    journeysDiscovered: number;
    totalFindings: number;
    findingsBySeverity: { low: number; medium: number; high: number };
    findingsByPattern: { ruleId: string; ruleName: string; count: number }[];
    aiAnalysis: "completed" | "skipped" | "unavailable";
  };
  rules: RuleProfile[];
  findings: ReportFinding[];
}

function isSeverity(value: string | null): value is ReportFinding["severity"] {
  return value === "low" || value === "medium" || value === "high";
}

function asContent(value: unknown): Partial<EvidenceContent> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Partial<EvidenceContent>;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeEvidence(
  item: ReportEvidenceInput,
  finding: ReportFindingInput,
  page: ReportPage,
  journeyId: string | undefined,
): ReportEvidence | null {
  const content = asContent(item.content);
  const pageUrl = content.pageUrl || page.finalUrl || page.url;
  const value = typeof content.value === "string" ? content.value.trim() : "";
  if (!pageUrl || !value) return null;
  const evidence: ReportEvidence = {
    type: item.type,
    value,
    pageUrl,
    ruleId: content.ruleId || finding.ruleId,
    capturedAt: content.capturedAt || iso(item.createdAt),
  };
  if (content.selector) evidence.selector = content.selector;
  const screenshot = content.screenshotPath || page.screenshotPath;
  if (screenshot) evidence.screenshotPath = screenshot;
  if (content.annotatedScreenshot) evidence.annotatedScreenshot = content.annotatedScreenshot;
  if (content.box) evidence.box = content.box;
  const stepId = content.journeyStepId || finding.journeyStepId;
  if (stepId) evidence.journeyStepId = stepId;
  const linkedJourney = content.journeyId || journeyId;
  if (linkedJourney) evidence.journeyId = linkedJourney;
  return evidence;
}

function readAiAnalysis(value: string | undefined): ComplianceReport["summary"]["aiAnalysis"] {
  if (value === "completed" || value === "unavailable" || value === "skipped") return value;
  return "skipped";
}

export function buildReport(
  input: {
    scan: { id: string; url: string };
    pages: ReportPage[];
    journeys: ReportJourney[];
    findings: ReportFindingInput[];
    aiAnalysis?: string;
  },
  generatedAt = new Date().toISOString(),
): ComplianceReport {
  const pages = new Map(input.pages.map((page) => [page.id, page]));
  const journeyByStep = new Map<string, ReportJourney>();
  for (const journey of input.journeys) {
    for (const step of journey.steps) journeyByStep.set(step.id, journey);
  }

  const seenFindings = new Set<string>();
  const findings: ReportFinding[] = [];
  for (const finding of input.findings) {
    const page = pages.get(finding.pageId);
    if (!page) continue;
    const findingKey = `${finding.pageId}|${finding.ruleId}`;
    if (seenFindings.has(findingKey)) continue;
    const journey = finding.journeyStepId ? journeyByStep.get(finding.journeyStepId) : undefined;
    const profile = profileFor(finding.ruleId);
    let confidence = 0;
    const evidence = dedupeReportEvidence(
      finding.evidence.flatMap((item) => {
        const stored = asContent(item.content);
        if (typeof stored.confidence === "number") confidence = Math.max(confidence, stored.confidence);
        const normalized = normalizeEvidence(item, finding, page, journey?.id);
        return normalized ? [normalized] : [];
      }),
    );
    if (evidence.length === 0) continue;
    seenFindings.add(findingKey);
    const severity = isSeverity(finding.severity) ? finding.severity : "low";
    const source = finding.source === "ai" ? "ai" : "rule";
    const aiReasoning = finding.evidence
      .map((item) => asContent(item.content).reasoning)
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    const reportFinding: ReportFinding = {
      ruleId: finding.ruleId,
      ruleName: profile.name,
      pattern: profile.name,
      severity,
      confidence,
      source,
      description: finding.summary,
      pageId: finding.pageId,
      pageUrl: page.finalUrl || page.url,
      explanation: `${finding.summary} ${profile.description} Potentially applicable pattern; this report does not determine that the page is non-compliant.`,
      evidence,
      regulatoryReference: profile.regulatoryReference,
      suggestedRemediation: profile.suggestedRemediation,
    };
    if (source === "ai") {
      reportFinding.aiConfidence = confidence;
      if (aiReasoning) reportFinding.aiReasoning = aiReasoning.trim();
    }
    if (journey) {
      reportFinding.journeyId = journey.id;
      reportFinding.journeyType = journey.type;
    }
    findings.push(reportFinding);
  }

  const findingsBySeverity = { low: 0, medium: 0, high: 0 };
  for (const finding of findings) findingsBySeverity[finding.severity] += 1;
  const patternCounts = new Map<string, { ruleId: string; ruleName: string; count: number }>();
  for (const finding of findings) {
    const current = patternCounts.get(finding.ruleId) ?? { ruleId: finding.ruleId, ruleName: finding.ruleName, count: 0 };
    current.count += 1;
    patternCounts.set(finding.ruleId, current);
  }

  return {
    scanId: input.scan.id,
    url: input.scan.url,
    generatedAt,
    summary: {
      pagesCrawled: input.pages.length,
      journeysDiscovered: input.journeys.length,
      totalFindings: findings.length,
      findingsBySeverity,
      findingsByPattern: [...patternCounts.values()].sort((a, b) => b.count - a.count || a.ruleId.localeCompare(b.ruleId)),
      aiAnalysis: readAiAnalysis(input.aiAnalysis),
    },
    rules: catalogProfiles(),
    findings,
  };
}

function dedupeReportEvidence(items: ReportEvidence[]): ReportEvidence[] {
  const seen = new Set<string>();
  const unique: ReportEvidence[] = [];
  for (const item of items) {
    const record: EvidenceRecord = {
      type: item.type === "element" || item.type === "attribute" ? item.type : "text",
      content: {
        value: item.value,
        pageUrl: item.pageUrl,
        pageId: "",
        ruleId: item.ruleId,
        ruleName: "",
        confidence: 0,
        capturedAt: item.capturedAt,
        scanId: "",
        ...(item.selector ? { selector: item.selector } : {}),
      },
    };
    const key = evidenceKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}
