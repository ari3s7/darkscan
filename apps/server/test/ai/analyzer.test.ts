import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeAmbiguousPages,
  mergeFindings,
  selectCandidates,
  validateAiResponse,
} from "../../src/ai/analyzer.js";
import type { AiClient, AiPageInput } from "../../src/ai/types.js";
import type { Finding } from "../../src/detection/types.js";
import { buildReport } from "../../src/report/buildReport.js";

function page(partial: Partial<AiPageInput> & Pick<AiPageInput, "id" | "visibleText">): AiPageInput {
  return {
    url: "https://shop.example/pricing",
    title: "Pricing",
    interactions: [],
    screenshotPath: null,
    ruleFindings: [],
    ...partial,
  };
}

function ruleFinding(partial: Partial<Finding> = {}): Finding {
  return {
    ruleId: "false-urgency",
    ruleName: "False Urgency",
    severity: "high",
    confidence: 0.92,
    pageId: "page-1",
    description: "Potential dark pattern detected: time-pressure language.",
    evidence: [{ type: "text", value: "Only 5 minutes left" }],
    ...partial,
  };
}

describe("AI response validation", () => {
  const corpus = ["Call to cancel after the trial ends", "storage/screenshots/scan/00.png"];

  it("accepts a quote taken from the supplied text", () => {
    const result = validateAiResponse(
      {
        isPotentialDarkPattern: true,
        ruleId: "subscription-trap",
        confidence: 0.7,
        reasoning: "The page says the user must call to cancel.",
        evidence: ["Call to cancel"],
      },
      corpus,
    );
    assert.equal(result?.isPotentialDarkPattern, true);
    assert.equal(result?.ruleId, "subscription-trap");
    assert.deepEqual(result?.evidence, ["Call to cancel"]);
  });

  it("rejects a malformed payload", () => {
    assert.equal(validateAiResponse("not-json", corpus), null);
    assert.equal(validateAiResponse({ isPotentialDarkPattern: "yes" }, corpus), null);
    assert.equal(
      validateAiResponse(
        {
          isPotentialDarkPattern: true,
          ruleId: "not-a-rule",
          confidence: 0.4,
          reasoning: "Something looked odd.",
          evidence: ["Call to cancel"],
        },
        corpus,
      )?.isPotentialDarkPattern,
      false,
    );
  });

  it("does not keep a positive result when the quote was not supplied", () => {
    const result = validateAiResponse(
      {
        isPotentialDarkPattern: true,
        ruleId: "drip-pricing",
        confidence: 0.8,
        reasoning: "A fee appeared.",
        evidence: ["Hidden resort fee of $40"],
      },
      corpus,
    );
    assert.equal(result?.isPotentialDarkPattern, false);
    assert.deepEqual(result?.evidence, []);
  });
});

describe("AI availability", () => {
  it("continues without findings when the API key is missing", async () => {
    const result = await analyzeAmbiguousPages(
      [page({ id: "page-1", visibleText: "Please call to cancel before the minimum term ends." })],
      null,
    );
    assert.equal(result.status, "unavailable");
    assert.deepEqual(result.findings, []);
  });

  it("returns no AI findings when the request fails", async () => {
    const client: AiClient = {
      complete() {
        throw new Error("429 rate limit for sk-test-secret-key");
      },
    };
    const logs: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    try {
      const result = await analyzeAmbiguousPages(
        [page({ id: "page-1", visibleText: "Please call to cancel before the minimum term ends." })],
        client,
      );
      assert.equal(result.status, "unavailable");
      assert.deepEqual(result.findings, []);
      assert.match(logs.join("\n"), /AI analysis failed/);
      assert.equal(logs.join("\n").includes("sk-test-secret-key"), false);
    } finally {
      console.error = original;
    }
  });
});

describe("candidate selection and merging", () => {
  it("skips a page that the rules already classified confidently", () => {
    const selected = selectCandidates([
      page({
        id: "page-1",
        visibleText: "Only 5 minutes left to claim this offer.",
        ruleFindings: [ruleFinding()],
      }),
    ]);
    assert.deepEqual(selected, []);
  });

  it("sends a screenshot only for a visual hierarchy problem", () => {
    const selected = selectCandidates([
      page({
        id: "page-1",
        visibleText: "Choose a plan",
        screenshotPath: "storage/screenshots/scan/00.png",
        interactions: [
          { type: "button", text: "Subscribe now", box: { x: 10, y: 10, width: 240, height: 60 } },
          { type: "button", text: "No thanks", box: { x: 10, y: 80, width: 40, height: 12 } },
        ],
      }),
    ]);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.includeScreenshot, true);
    assert.equal(selected[0]?.screenshotPath, "storage/screenshots/scan/00.png");
  });

  it("keeps rule findings and adds only a new AI rule", () => {
    const rules = [ruleFinding({ confidence: 0.62, severity: "medium" })];
    const ai = [
      ruleFinding({ source: "ai", confidence: 0.4, description: "Potential dark pattern detected: False Urgency." }),
      ruleFinding({
        ruleId: "subscription-trap",
        ruleName: "Subscription Trap",
        source: "ai",
        confidence: 0.7,
        severity: "medium",
        reasoning: "The page says the user must call to cancel.",
        description: "Potential dark pattern detected: Subscription Trap.",
        evidence: [{ type: "text", value: "Call to cancel" }],
      }),
    ];
    const merged = mergeFindings(rules, ai);
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.source, "rule");
    assert.equal(merged[0]?.confidence, 0.62);
    assert.equal(merged[1]?.ruleId, "subscription-trap");
    assert.equal(merged[1]?.source, "ai");

    const report = buildReport({
      scan: { id: "scan-1", url: "https://shop.example/" },
      aiAnalysis: "completed",
      pages: [{ id: "page-1", url: "https://shop.example/pricing", finalUrl: null, screenshotPath: null }],
      journeys: [],
      findings: [
        {
          id: "ai-1",
          ruleId: "subscription-trap",
          source: "ai",
          severity: "medium",
          summary: "Potential dark pattern detected: Subscription Trap.",
          pageId: "page-1",
          journeyStepId: null,
          createdAt: "2026-09-24T12:00:00.000Z",
          evidence: [
            {
              id: "e-1",
              type: "text",
              createdAt: "2026-09-24T12:00:00.000Z",
              content: {
                value: "Call to cancel",
                pageUrl: "https://shop.example/pricing",
                ruleId: "subscription-trap",
                confidence: 0.7,
                reasoning: "The page says the user must call to cancel.",
                capturedAt: "2026-09-24T12:00:00.000Z",
              },
            },
          ],
        },
      ],
    });
    assert.equal(report.summary.aiAnalysis, "completed");
    assert.equal(report.findings[0]?.source, "ai");
    assert.equal(report.findings[0]?.aiConfidence, 0.7);
    assert.match(report.findings[0]?.aiReasoning ?? "", /call to cancel/i);
  });
});
