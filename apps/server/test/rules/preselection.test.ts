import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Interaction } from "../../src/crawler/types.js";
import { detectPreselection } from "../../src/detection/rules/preselection.js";
import type { DetectionPage } from "../../src/detection/types.js";

function page(interactions: Interaction[]): DetectionPage {
  return {
    id: "page-1",
    url: "https://shop.example/checkout",
    title: "Checkout",
    visibleText: "",
    interactions,
  };
}

describe("preselection", () => {
  it("records a checked paid option and its label", () => {
    const findings = detectPreselection(
      page([{ type: "checkbox", name: "protection", text: "Premium protection", checked: true }]),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.ruleId, "preselection");
    assert.equal(findings[0]?.evidence[0]?.type, "element");
    assert.equal(findings[0]?.evidence[0]?.value, "Premium protection");
    assert.equal(findings[0]?.evidence[0]?.selector, 'checkbox[name="protection"]');
    assert.match(findings[0]?.description ?? "", /potential dark pattern detected/i);
  });

  it("ignores an unchecked option", () => {
    const findings = detectPreselection(
      page([{ type: "checkbox", name: "protection", text: "Premium protection", checked: false }]),
    );
    assert.deepEqual(findings, []);
  });

  it("ignores consent checkboxes and an unpriced plan radio", () => {
    assert.deepEqual(
      detectPreselection(page([{ type: "checkbox", text: "I agree to the terms", checked: true }])),
      [],
    );
    assert.deepEqual(
      detectPreselection(page([{ type: "radio", name: "plan", text: "Annual", value: "annual", checked: true }])),
      [],
    );
  });
});
