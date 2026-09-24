export interface ElementBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageResult {
  id: string;
  url: string;
  finalUrl: string | null;
  title: string | null;
  statusCode: number | null;
  screenshotPath: string | null;
  error: string | null;
  metadata: unknown;
}

export interface JourneyStepResult {
  id: string;
  pageId: string | null;
  position: number;
  pageKind: string;
  actionLabel: string | null;
}

export interface JourneyResult {
  type: string;
  status: string;
  pages: number;
  findings: number;
  steps: JourneyStepResult[];
}

export type AiAnalysis = "completed" | "skipped" | "unavailable";

export interface ScanResult {
  id: string;
  url: string;
  status: string;
  errors: string[];
  pagesCrawled: number;
  findings: number;
  aiAnalysis: AiAnalysis;
  journeys: JourneyResult[];
  pages: PageResult[];
}

export interface ReportEvidence {
  type: string;
  value: string;
  selector?: string;
  pageUrl: string;
  screenshotPath?: string;
  annotatedScreenshot?: string;
  box?: ElementBox;
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

export interface RuleProfile {
  id: string;
  name: string;
  description: string;
  regulatoryReference: string;
  detectionStatus: "active" | "defined";
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
    aiAnalysis: AiAnalysis;
  };
  rules: RuleProfile[];
  findings: ReportFinding[];
}

function apiBase(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:3001";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(data: unknown): string {
  if (isRecord(data) && typeof data.error === "string") return data.error;
  return "Scan failed";
}

function readAiAnalysis(value: unknown): AiAnalysis {
  if (value === "completed" || value === "unavailable" || value === "skipped") return value;
  return "skipped";
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readPage(value: unknown): PageResult | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.url !== "string") return null;
  return {
    id: value.id,
    url: value.url,
    finalUrl: readString(value.finalUrl),
    title: readString(value.title),
    statusCode: typeof value.statusCode === "number" ? value.statusCode : null,
    screenshotPath: readString(value.screenshotPath),
    error: readString(value.error),
    metadata: value.metadata ?? null,
  };
}

function readStep(value: unknown): JourneyStepResult | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return {
    id: value.id,
    pageId: readString(value.pageId),
    position: typeof value.position === "number" ? value.position : 0,
    pageKind: readString(value.pageKind) ?? "unknown",
    actionLabel: readString(value.actionLabel),
  };
}

function readJourney(value: unknown): JourneyResult | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  const steps = Array.isArray(value.steps) ? value.steps.flatMap((step) => {
    const parsed = readStep(step);
    return parsed ? [parsed] : [];
  }) : [];
  return {
    type: value.type,
    status: readString(value.status) ?? "discovered",
    pages: typeof value.pages === "number" ? value.pages : steps.length,
    findings: typeof value.findings === "number" ? value.findings : 0,
    steps,
  };
}

export function readScan(data: unknown): ScanResult {
  if (!isRecord(data) || typeof data.id !== "string" || typeof data.url !== "string" || typeof data.status !== "string" || !Array.isArray(data.pages)) {
    throw new Error("Unexpected response from the server");
  }
  return {
    id: data.id,
    url: data.url,
    status: data.status,
    errors: Array.isArray(data.errors) ? data.errors.filter((item): item is string => typeof item === "string") : [],
    pagesCrawled: typeof data.pagesCrawled === "number" ? data.pagesCrawled : data.pages.length,
    findings: typeof data.findings === "number" ? data.findings : 0,
    aiAnalysis: readAiAnalysis(data.aiAnalysis),
    journeys: Array.isArray(data.journeys) ? data.journeys.flatMap((journey) => {
      const parsed = readJourney(journey);
      return parsed ? [parsed] : [];
    }) : [],
    pages: data.pages.flatMap((page) => {
      const parsed = readPage(page);
      return parsed ? [parsed] : [];
    }),
  };
}

function readBox(value: unknown): ElementBox | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.x !== "number" || typeof value.y !== "number" || typeof value.width !== "number" || typeof value.height !== "number") {
    return undefined;
  }
  return { x: value.x, y: value.y, width: value.width, height: value.height };
}

function readEvidence(value: unknown): ReportEvidence | null {
  if (!isRecord(value) || typeof value.value !== "string" || typeof value.pageUrl !== "string") return null;
  const evidence: ReportEvidence = {
    type: readString(value.type) ?? "text",
    value: value.value,
    pageUrl: value.pageUrl,
    ruleId: readString(value.ruleId) ?? "",
    capturedAt: readString(value.capturedAt) ?? "",
  };
  const selector = readString(value.selector);
  const screenshotPath = readString(value.screenshotPath);
  const annotatedScreenshot = readString(value.annotatedScreenshot);
  const journeyStepId = readString(value.journeyStepId);
  const journeyId = readString(value.journeyId);
  const box = readBox(value.box);
  if (selector) evidence.selector = selector;
  if (screenshotPath) evidence.screenshotPath = screenshotPath;
  if (annotatedScreenshot) evidence.annotatedScreenshot = annotatedScreenshot;
  if (journeyStepId) evidence.journeyStepId = journeyStepId;
  if (journeyId) evidence.journeyId = journeyId;
  if (box) evidence.box = box;
  return evidence;
}

function readSeverity(value: unknown): ReportFinding["severity"] {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "low";
}

function readFinding(value: unknown): ReportFinding | null {
  if (!isRecord(value) || typeof value.ruleId !== "string" || typeof value.pageId !== "string") return null;
  const evidence = Array.isArray(value.evidence) ? value.evidence.flatMap((item) => {
    const parsed = readEvidence(item);
    return parsed ? [parsed] : [];
  }) : [];
  const finding: ReportFinding = {
    ruleId: value.ruleId,
    ruleName: readString(value.ruleName) ?? value.ruleId,
    pattern: readString(value.pattern) ?? readString(value.ruleName) ?? value.ruleId,
    severity: readSeverity(value.severity),
    confidence: typeof value.confidence === "number" ? value.confidence : 0,
    source: value.source === "ai" ? "ai" : "rule",
    description: readString(value.description) ?? "",
    pageId: value.pageId,
    pageUrl: readString(value.pageUrl) ?? "",
    explanation: readString(value.explanation) ?? "",
    evidence,
    regulatoryReference: readString(value.regulatoryReference) ?? "",
    suggestedRemediation: readString(value.suggestedRemediation) ?? "",
  };
  if (typeof value.aiConfidence === "number") finding.aiConfidence = value.aiConfidence;
  const reasoning = readString(value.aiReasoning);
  const journeyId = readString(value.journeyId);
  const journeyType = readString(value.journeyType);
  if (reasoning) finding.aiReasoning = reasoning;
  if (journeyId) finding.journeyId = journeyId;
  if (journeyType) finding.journeyType = journeyType;
  return finding;
}

function readRule(value: unknown): RuleProfile | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  return {
    id: value.id,
    name: value.name,
    description: readString(value.description) ?? "",
    regulatoryReference: readString(value.regulatoryReference) ?? "",
    detectionStatus: value.detectionStatus === "active" ? "active" : "defined",
    suggestedRemediation: readString(value.suggestedRemediation) ?? "",
  };
}

function readCount(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export function readReport(data: unknown): ComplianceReport {
  if (!isRecord(data) || typeof data.scanId !== "string" || typeof data.url !== "string" || !isRecord(data.summary) || !Array.isArray(data.findings)) {
    throw new Error("Unexpected response from the server");
  }
  const summary = data.summary;
  const bySeverity = isRecord(summary.findingsBySeverity) ? summary.findingsBySeverity : {};
  const byPattern = Array.isArray(summary.findingsByPattern) ? summary.findingsByPattern.flatMap((item) => {
    if (!isRecord(item) || typeof item.ruleId !== "string") return [];
    return [{
      ruleId: item.ruleId,
      ruleName: readString(item.ruleName) ?? item.ruleId,
      count: readCount(item.count),
    }];
  }) : [];
  return {
    scanId: data.scanId,
    url: data.url,
    generatedAt: readString(data.generatedAt) ?? "",
    summary: {
      pagesCrawled: readCount(summary.pagesCrawled),
      journeysDiscovered: readCount(summary.journeysDiscovered),
      totalFindings: readCount(summary.totalFindings),
      findingsBySeverity: {
        low: readCount(bySeverity.low),
        medium: readCount(bySeverity.medium),
        high: readCount(bySeverity.high),
      },
      findingsByPattern: byPattern,
      aiAnalysis: readAiAnalysis(summary.aiAnalysis),
    },
    rules: Array.isArray(data.rules) ? data.rules.flatMap((rule) => {
      const parsed = readRule(rule);
      return parsed ? [parsed] : [];
    }) : [],
    findings: data.findings.flatMap((finding) => {
      const parsed = readFinding(finding);
      return parsed ? [parsed] : [];
    }),
  };
}

async function readJson(response: Response): Promise<unknown> {
  const data: unknown = await response.json();
  if (!response.ok) throw new Error(errorMessage(data));
  return data;
}

export async function requestScan(url: string, signal?: AbortSignal): Promise<ScanResult> {
  const response = await fetch(`${apiBase()}/api/scans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });
  return readScan(await readJson(response));
}

export async function getScan(id: string, signal?: AbortSignal): Promise<ScanResult> {
  const response = await fetch(`${apiBase()}/api/scans/${encodeURIComponent(id)}`, { signal });
  return readScan(await readJson(response));
}

export async function getReport(id: string, signal?: AbortSignal): Promise<ComplianceReport> {
  const response = await fetch(`${apiBase()}/api/scans/${encodeURIComponent(id)}/report`, { signal });
  return readReport(await readJson(response));
}

export function isRunning(status: string): boolean {
  return status === "PENDING" || status === "RUNNING";
}

export async function pollScan(
  id: string,
  onUpdate: (scan: ScanResult) => void,
  signal: AbortSignal,
): Promise<ScanResult> {
  let latest = await getScan(id, signal);
  onUpdate(latest);
  while (isRunning(latest.status)) {
    await wait(1500, signal);
    latest = await getScan(id, signal);
    onUpdate(latest);
  }
  return latest;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Turns a stored screenshot path into a URL served by the API. */
export function mediaUrl(storedPath: string | null | undefined): string | null {
  if (!storedPath) return null;
  const normalized = storedPath.replaceAll("\\", "/");
  const marker = "storage/screenshots/";
  const index = normalized.indexOf(marker);
  if (index === -1) return null;
  const relative = normalized.slice(index + marker.length);
  const encoded = relative.split("/").filter((part) => part.length > 0).map((part) => encodeURIComponent(part)).join("/");
  return encoded ? `${apiBase()}/screenshots/${encoded}` : null;
}

export function findingKey(finding: ReportFinding): string {
  return `${finding.pageId}|${finding.ruleId}|${finding.source}`;
}

export function pageKind(page: PageResult): string | null {
  if (!isRecord(page.metadata)) return null;
  return readString(page.metadata.pageKind);
}
