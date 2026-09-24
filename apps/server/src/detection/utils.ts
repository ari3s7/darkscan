import type { Interaction } from "../crawler/types.js";
import type { EvidenceItem, Finding, Severity } from "./types.js";

export function elementLabel(interaction: Interaction): string {
  return [interaction.text, interaction.name, interaction.value].filter((part) => part && part.trim() !== "").join(" ");
}

export function elementSelector(interaction: Interaction): string | undefined {
  if (!interaction.name) return undefined;
  return `${interaction.type}[name="${interaction.name.replaceAll('"', "")}"]`;
}

export function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, "i").test(text);
}

export function matchesAnyKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => matchesKeyword(text, keyword));
}

export interface WeightedPattern {
  pattern: RegExp;
  confidence: number;
  severity: Severity;
}

export function matchSnippets(text: string, pattern: RegExp): string[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const global = new RegExp(pattern.source, flags);
  const snippets: string[] = [];
  for (const match of text.matchAll(global)) {
    const index = match.index ?? 0;
    const start = Math.max(0, index - 48);
    const end = Math.min(text.length, index + match[0].length + 48);
    const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (snippet && !snippets.some((existing) => existing.toLowerCase() === snippet.toLowerCase())) {
      snippets.push(snippet);
    }
  }
  return snippets;
}

export function uniqueEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  const unique: EvidenceItem[] = [];
  for (const item of items) {
    const key = `${item.type}|${item.value.trim().toLowerCase()}|${item.selector ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

/** One finding per rule. Repeated evidence is dropped. Confidence keeps the stronger signal. */
export function dedupeFindings(findings: Finding[]): Finding[] {
  const byRule = new Map<string, Finding>();
  for (const finding of findings) {
    const evidence = uniqueEvidence(finding.evidence);
    if (evidence.length === 0) continue;
    const existing = byRule.get(finding.ruleId);
    if (!existing) {
      byRule.set(finding.ruleId, { ...finding, evidence });
      continue;
    }
    existing.evidence = uniqueEvidence([...existing.evidence, ...evidence]);
    if (finding.confidence > existing.confidence) {
      existing.confidence = finding.confidence;
      existing.severity = finding.severity;
      existing.description = finding.description;
    }
  }
  return [...byRule.values()];
}

