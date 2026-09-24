import { rules } from "@darkscan/rules";
import type { Interaction } from "../crawler/types.js";
import type { Finding, Severity } from "../detection/types.js";
import { profileFor } from "../report/profiles.js";
import { AI_SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import type { AiAnalysisResult, AiAssessment, AiCandidate, AiClient, AiPageInput, AiRuleSignal } from "./types.js";

export const AI_CONFIDENCE_FLOOR = 0.75;
export const AI_MAX_PAGES = 3;

const ALLOWED_RULES = new Set([...rules.map((rule) => rule.id), "preselection"]);

/** Text signals for patterns the rule engine does not already decide. */
export const uncoveredSignals: readonly { ruleId: string; pattern: RegExp }[] = [
  { ruleId: "subscription-trap", pattern: /\b(?:call to cancel|cancellation fee|minimum term)\b/i },
  { ruleId: "drip-pricing", pattern: /\b(?:excluding fees|service fee|taxes calculated)\b/i },
  { ruleId: "nagging", pattern: /\b(?:are you sure you want to leave|before you go)\b/i },
  { ruleId: "trick-question", pattern: /\b(?:uncheck to|do not not)\b/i },
  { ruleId: "disguised-advertisement", pattern: /\b(?:sponsored post|advertorial)\b/i },
  { ruleId: "bait-and-switch", pattern: /\b(?:price changed|was only)\b/i },
  { ruleId: "saas-billing", pattern: /\b(?:auto-?renew|recurring charge)\b/i },
  { ruleId: "rogue-malware", pattern: /\b(?:virus detected|computer is infected)\b/i },
];

const DECLINE = /\b(?:no thanks|decline|cancel)\b/i;
const PRIMARY = /\b(?:accept|subscribe|continue|buy|upgrade)\b/i;

function excerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + length + 80);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function pushUnique(items: string[], value: string): void {
  const trimmed = value.trim();
  if (!trimmed || items.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
  items.push(trimmed.slice(0, 240));
}

function area(interaction: Interaction): number {
  if (!interaction.box) return 0;
  return interaction.box.width * interaction.box.height;
}

function visualEmphasis(interactions: Interaction[]): boolean {
  const hiddenChoice = interactions.some(
    (item) =>
      item.hidden === true &&
      Boolean(item.text?.trim()) &&
      (item.type === "button" || item.type === "link" || item.type === "checkbox"),
  );
  if (hiddenChoice) return true;
  const decline = interactions.filter((item) => item.box && DECLINE.test(item.text ?? ""));
  const primary = interactions.filter((item) => item.box && PRIMARY.test(item.text ?? ""));
  const small = Math.min(...decline.map(area));
  const large = Math.max(...primary.map(area));
  return decline.length > 0 && primary.length > 0 && small > 0 && large >= small * 3;
}

function ruleSignals(findings: Finding[]): AiRuleSignal[] {
  return findings.slice(0, 5).map((finding) => ({
    ruleId: finding.ruleId,
    confidence: finding.confidence,
    evidence: finding.evidence[0]?.value ?? finding.description,
  }));
}

export function selectCandidates(pages: AiPageInput[]): AiCandidate[] {
  const selected: Array<{ rank: number; candidate: AiCandidate }> = [];
  for (const page of pages) {
    const excerpts: string[] = [];
    const elements: AiCandidate["elements"] = [];
    let rank = 0;
    const lowConfidence = page.ruleFindings.some((finding) => finding.confidence < AI_CONFIDENCE_FLOOR);
    if (lowConfidence) rank += 3;
    for (const finding of page.ruleFindings) {
      if (finding.confidence >= AI_CONFIDENCE_FLOOR) continue;
      for (const item of finding.evidence) pushUnique(excerpts, item.value);
    }
    for (const signal of uncoveredSignals) {
      const match = signal.pattern.exec(page.visibleText);
      if (!match || match.index === undefined) continue;
      rank += 2;
      pushUnique(excerpts, excerpt(page.visibleText, match.index, match[0].length));
    }
    for (const interaction of page.interactions) {
      const label = interaction.text?.trim();
      if (!label) continue;
      const mentioned = excerpts.some((item) => item.toLowerCase().includes(label.toLowerCase()));
      const signal = uncoveredSignals.some((entry) => entry.pattern.test(label));
      if (!mentioned && !signal && !interaction.hidden) continue;
      if (elements.length >= 6) break;
      const element: AiCandidate["elements"][number] = { text: label.slice(0, 160) };
      if (interaction.selector) element.selector = interaction.selector;
      if (interaction.hidden) element.hidden = true;
      elements.push(element);
    }
    const visual = visualEmphasis(page.interactions);
    const includeScreenshot = Boolean(page.screenshotPath) && visual;
    if (visual) rank += 2;
    if (rank === 0) continue;
    const candidate: AiCandidate = {
      pageId: page.id,
      url: page.url,
      title: page.title,
      excerpts: excerpts.slice(0, 4),
      elements,
      ruleSignals: ruleSignals(page.ruleFindings.filter((finding) => finding.confidence < AI_CONFIDENCE_FLOOR)),
      includeScreenshot,
    };
    if (page.journeyType) candidate.journeyType = page.journeyType;
    if (page.pageKind) candidate.pageKind = page.pageKind;
    if (includeScreenshot && page.screenshotPath) candidate.screenshotPath = page.screenshotPath;
    selected.push({ rank, candidate });
  }
  return selected
    .sort((a, b) => b.rank - a.rank)
    .slice(0, AI_MAX_PAGES)
    .map((item) => item.candidate);
}

export function corpusFor(candidate: AiCandidate): string[] {
  const corpus = [...candidate.excerpts, ...candidate.elements.map((element) => element.text)];
  if (candidate.screenshotPath) corpus.push(candidate.screenshotPath);
  for (const signal of candidate.ruleSignals) corpus.push(signal.evidence);
  return corpus.filter((item) => item.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function evidenceIsSupplied(quote: string, corpus: readonly string[]): boolean {
  const trimmed = quote.trim();
  if (trimmed.length < 4) return false;
  const needle = trimmed.toLowerCase();
  return corpus.some((entry) => {
    const haystack = entry.toLowerCase();
    return haystack === needle || (trimmed.length >= 8 && haystack.includes(needle));
  });
}

function negative(ruleId: string): AiAssessment {
  return { isPotentialDarkPattern: false, ruleId, confidence: 0, reasoning: "", evidence: [] };
}

/** Accepts only the documented JSON shape. Invented quotes become a negative result. */
export function validateAiResponse(raw: unknown, corpus: readonly string[]): AiAssessment | null {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed)) return null;
  if (typeof parsed.isPotentialDarkPattern !== "boolean") return null;
  if (typeof parsed.ruleId !== "string") return null;
  if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) return null;
  if (typeof parsed.reasoning !== "string") return null;
  if (!Array.isArray(parsed.evidence) || parsed.evidence.some((item) => typeof item !== "string")) return null;
  const evidence = parsed.evidence.map((item) => item.trim()).filter((item) => item.length > 0);
  if (!parsed.isPotentialDarkPattern) return negative(parsed.ruleId);
  if (!ALLOWED_RULES.has(parsed.ruleId)) return negative(parsed.ruleId);
  if (parsed.reasoning.trim().length === 0 || evidence.length === 0) return negative(parsed.ruleId);
  if (evidence.some((quote) => !evidenceIsSupplied(quote, corpus))) return negative(parsed.ruleId);
  return {
    isPotentialDarkPattern: true,
    ruleId: parsed.ruleId,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning.trim().slice(0, 600),
    evidence: evidence.slice(0, 4),
  };
}

function severityFor(confidence: number): Severity {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

function toFinding(candidate: AiCandidate, assessment: AiAssessment): Finding {
  const profile = profileFor(assessment.ruleId);
  return {
    ruleId: assessment.ruleId,
    ruleName: profile.name,
    severity: severityFor(assessment.confidence),
    confidence: assessment.confidence,
    pageId: candidate.pageId,
    description: `Potential dark pattern detected: ${profile.name}.`,
    source: "ai",
    reasoning: assessment.reasoning,
    evidence: assessment.evidence.map((value) => {
      const element = candidate.elements.find((item) => value.toLowerCase().includes(item.text.toLowerCase()));
      if (element?.selector) return { type: "element" as const, value, selector: element.selector };
      return { type: "text" as const, value };
    }),
  };
}

export function mergeFindings(ruleFindings: Finding[], aiFindings: Finding[]): Finding[] {
  const claimed = new Set(ruleFindings.map((finding) => finding.ruleId));
  const kept = ruleFindings.map((finding) => ({ ...finding, source: "rule" as const }));
  const added = aiFindings.filter((finding) => finding.source === "ai" && !claimed.has(finding.ruleId));
  return [...kept, ...added];
}

function redactSecrets(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_\-]+/g, "[redacted]").slice(0, 180);
}

export async function analyzeAmbiguousPages(pages: AiPageInput[], client: AiClient | null): Promise<AiAnalysisResult> {
  if (!client) return { status: "unavailable", findings: [] };
  const candidates = selectCandidates(pages);
  if (candidates.length === 0) return { status: "skipped", findings: [] };
  const findings: Finding[] = [];
  for (const candidate of candidates) {
    try {
      const raw = await client.complete({
        system: AI_SYSTEM_PROMPT,
        user: buildUserPrompt(candidate),
        ...(candidate.includeScreenshot && candidate.screenshotPath ? { screenshotPath: candidate.screenshotPath } : {}),
      });
      const assessment = validateAiResponse(raw, corpusFor(candidate));
      if (!assessment?.isPotentialDarkPattern) continue;
      findings.push(toFinding(candidate, assessment));
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed";
      console.error(`AI analysis failed: ${redactSecrets(message)}`);
      return { status: "unavailable", findings };
    }
  }
  return { status: "completed", findings };
}
