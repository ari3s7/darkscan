import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReport } from "../../src/report/buildReport.js";
import { catalogProfiles } from "../../src/report/profiles.js";

const generatedAt = "2026-09-24T12:00:00.000Z";

function report() {
  return buildReport(
    {
      scan: { id: "scan-1", url: "https://shop.example/" },
      pages: [
        {
          id: "page-1",
          url: "https://shop.example/product",
          finalUrl: "https://shop.example/product",
          screenshotPath: "storage/screenshots/scan-1/00.png",
        },
        {
          id: "page-2",
          url: "https://shop.example/cart",
          finalUrl: "https://shop.example/cart",
          screenshotPath: "storage/screenshots/scan-1/01.png",
        },
      ],
      journeys: [
        {
          id: "journey-1",
          type: "checkout",
          status: "blocked",
          steps: [
            { id: "step-1", pageId: "page-1" },
            { id: "step-2", pageId: "page-2" },
          ],
        },
      ],
      findings: [
        {
          id: "finding-1",
          ruleId: "false-urgency",
          severity: "high",
          summary: "Potential dark pattern detected: time-pressure language.",
          pageId: "page-1",
          journeyStepId: "step-1",
          createdAt: generatedAt,
          evidence: [
            {
              id: "evidence-1",
              type: "text",
              createdAt: generatedAt,
              content: {
                value: "Only 5 minutes left",
                pageUrl: "https://shop.example/product",
                pageId: "page-1",
                screenshotPath: "storage/screenshots/scan-1/00.png",
                journeyStepId: "step-1",
                journeyId: "journey-1",
                ruleId: "false-urgency",
                confidence: 0.92,
                capturedAt: generatedAt,
              },
            },
            {
              id: "evidence-1b",
              type: "text",
              createdAt: generatedAt,
              content: {
                value: "Only 5 minutes left",
                pageUrl: "https://shop.example/product",
                ruleId: "false-urgency",
                confidence: 0.92,
                capturedAt: generatedAt,
              },
            },
          ],
        },
        {
          id: "finding-1-dup",
          ruleId: "false-urgency",
          severity: "high",
          summary: "duplicate",
          pageId: "page-1",
          journeyStepId: "step-1",
          createdAt: generatedAt,
          evidence: [
            {
              id: "evidence-dup",
              type: "text",
              createdAt: generatedAt,
              content: { value: "Only 5 minutes left", pageUrl: "https://shop.example/product", ruleId: "false-urgency" },
            },
          ],
        },
        {
          id: "finding-2",
          ruleId: "basket-sneaking",
          severity: "high",
          summary: "Potential dark pattern detected: an optional add-on appears selected.",
          pageId: "page-2",
          journeyStepId: "step-2",
          createdAt: generatedAt,
          evidence: [
            {
              id: "evidence-2",
              type: "element",
              createdAt: generatedAt,
              content: {
                value: "Premium protection",
                selector: 'checkbox[name="protection"]',
                pageUrl: "https://shop.example/cart",
                screenshotPath: "storage/screenshots/scan-1/01.png",
                annotatedScreenshot: "storage/screenshots/scan-1/01-basket-sneaking-0.svg",
                box: { x: 12, y: 40, width: 180, height: 24 },
                ruleId: "basket-sneaking",
                confidence: 0.9,
                capturedAt: generatedAt,
              },
            },
          ],
        },
        {
          id: "finding-orphan",
          ruleId: "confirm-shaming",
          severity: "medium",
          summary: "not on a crawled page",
          pageId: "missing-page",
          journeyStepId: null,
          createdAt: generatedAt,
          evidence: [
            {
              id: "evidence-orphan",
              type: "element",
              createdAt: generatedAt,
              content: { value: "No thanks", pageUrl: "https://shop.example/gone", ruleId: "confirm-shaming" },
            },
          ],
        },
      ],
    },
    generatedAt,
  );
}

describe("compliance report", () => {
  it("summarizes pages, journeys, severity, and pattern", () => {
    const result = report();
    assert.equal(result.summary.pagesCrawled, 2);
    assert.equal(result.summary.journeysDiscovered, 1);
    assert.equal(result.summary.totalFindings, 2);
    assert.deepEqual(result.summary.findingsBySeverity, { low: 0, medium: 0, high: 2 });
    assert.deepEqual(result.summary.findingsByPattern, [
      { ruleId: "basket-sneaking", ruleName: "Basket Sneaking", count: 1 },
      { ruleId: "false-urgency", ruleName: "False Urgency", count: 1 },
    ]);
  });

  it("attaches the journey, evidence, guideline, and a remediation", () => {
    const result = report();
    const urgency = result.findings.find((finding) => finding.ruleId === "false-urgency");
    assert.ok(urgency);
    assert.equal(urgency.pattern, "False Urgency");
    assert.equal(urgency.confidence, 0.92);
    assert.equal(urgency.pageId, "page-1");
    assert.equal(urgency.journeyId, "journey-1");
    assert.equal(urgency.journeyType, "checkout");
    assert.equal(urgency.evidence.length, 1);
    assert.equal(urgency.evidence[0]?.screenshotPath, "storage/screenshots/scan-1/00.png");
    assert.equal(urgency.evidence[0]?.journeyStepId, "step-1");
    assert.equal(urgency.evidence[0]?.ruleId, "false-urgency");
    assert.match(urgency.regulatoryReference, /potentially applicable/i);
    assert.match(urgency.regulatoryReference, /not a determination/i);
    assert.match(urgency.explanation, /does not determine that the page is non-compliant/i);
    assert.match(urgency.suggestedRemediation, /countdown/i);

    const basket = result.findings.find((finding) => finding.ruleId === "basket-sneaking");
    assert.equal(basket?.evidence[0]?.annotatedScreenshot, "storage/screenshots/scan-1/01-basket-sneaking-0.svg");
    assert.equal(basket?.evidence[0]?.selector, 'checkbox[name="protection"]');
    assert.equal(result.findings.some((finding) => finding.pageId === "missing-page"), false);
  });

  it("lists every specified pattern and marks only implemented detectors as active", () => {
    const rules = catalogProfiles();
    assert.equal(rules.length, 13);
    assert.equal(rules.find((rule) => rule.id === "false-urgency")?.detectionStatus, "active");
    assert.equal(rules.find((rule) => rule.id === "drip-pricing")?.detectionStatus, "defined");
    assert.ok(rules.every((rule) => rule.regulatoryReference.length > 0 && rule.suggestedRemediation.length > 0));
    assert.equal(report().rules.length, 13);
  });
});