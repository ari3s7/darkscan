import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Interaction } from "../../src/crawler/types.js";
import { createEvidence, dedupeEvidence, type EvidenceSource } from "../../src/evidence/record.js";
import type { Finding } from "../../src/detection/types.js";

const finding: Finding = {
  ruleId: "basket-sneaking",
  ruleName: "Basket Sneaking",
  severity: "high",
  confidence: 0.9,
  pageId: "page-1",
  description: "Potential dark pattern detected: an optional add-on appears selected.",
  evidence: [],
};

const source: EvidenceSource = {
  scanId: "scan-1",
  pageId: "page-1",
  pageUrl: "https://shop.example/cart",
  screenshotPath: "storage/screenshots/scan-1/01.png",
  journeyStepId: "step-1",
  journeyId: "journey-1",
  capturedAt: "2026-09-24T10:00:00.000Z",
  interactions: [
    {
      type: "checkbox",
      name: "protection",
      text: "Premium protection",
      checked: true,
      selector: 'checkbox[name="protection"]',
      box: { x: 12, y: 40, width: 180, height: 24 },
    },
  ],
};

describe("evidence records", () => {
  it("stores the page, element, journey step, rule, and time", () => {
    const record = createEvidence(
      finding,
      { type: "element", value: "Premium protection", selector: 'checkbox[name="protection"]' },
      source,
    );
    assert.ok(record);
    assert.equal(record.content.pageUrl, "https://shop.example/cart");
    assert.equal(record.content.pageId, "page-1");
    assert.equal(record.content.screenshotPath, "storage/screenshots/scan-1/01.png");
    assert.equal(record.content.selector, 'checkbox[name="protection"]');
    assert.equal(record.content.value, "Premium protection");
    assert.deepEqual(record.content.box, { x: 12, y: 40, width: 180, height: 24 });
    assert.equal(record.content.journeyStepId, "step-1");
    assert.equal(record.content.journeyId, "journey-1");
    assert.equal(record.content.ruleId, "basket-sneaking");
    assert.equal(record.content.capturedAt, "2026-09-24T10:00:00.000Z");
  });

  it("keeps a text finding tied to the page when no element matches", () => {
    const record = createEvidence(
      { ...finding, ruleId: "false-urgency", ruleName: "False Urgency" },
      { type: "text", value: "Only 5 minutes left" },
      { ...source, interactions: [] },
    );
    assert.ok(record);
    assert.equal(record.content.pageUrl, "https://shop.example/cart");
    assert.equal(record.content.screenshotPath, "storage/screenshots/scan-1/01.png");
    assert.equal(record.content.box, undefined);
    assert.equal(record.content.selector, undefined);
  });

  it("drops evidence that is not tied to the saved page", () => {
    const record = createEvidence(finding, { type: "text", value: "Only 5 minutes left" }, { ...source, pageUrl: "" });
    assert.equal(record, null);
    const otherPage = createEvidence(
      finding,
      { type: "text", value: "Only 5 minutes left" },
      { ...source, pageId: "page-2" },
    );
    assert.equal(otherPage, null);
  });
});

describe("duplicate evidence", () => {
  it("keeps one record when the same rule, value, and selector repeat", () => {
    const interactions: Interaction[] = source.interactions;
    const first = createEvidence(
      finding,
      { type: "element", value: "Premium protection", selector: 'checkbox[name="protection"]' },
      { ...source, interactions },
    );
    const second = createEvidence(
      finding,
      { type: "element", value: "Premium protection", selector: 'checkbox[name="protection"]' },
      source,
    );
    const different = createEvidence(finding, { type: "text", value: "Donation added" }, source);
    assert.ok(first && second && different);
    const unique = dedupeEvidence([first, second, different]);
    assert.equal(unique.length, 2);
    assert.equal(unique[0]?.content.value, "Premium protection");
    assert.equal(unique[1]?.content.value, "Donation added");
  });
});
