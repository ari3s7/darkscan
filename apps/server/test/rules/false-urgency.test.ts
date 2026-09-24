import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Interaction } from "../../src/crawler/types.js";
import { detectFalseUrgency } from "../../src/detection/rules/false-urgency.js";
import type { DetectionPage } from "../../src/detection/types.js";

function page(visibleText: string, interactions: Interaction[] = []): DetectionPage {
  return { id: "page-1", url: "https://shop.example/sale", title: "Sale", visibleText, interactions };
}

describe("false urgency", () => {
  it("flags an explicit remaining-time claim", () => {
    const findings = detectFalseUrgency(page("Only 5 minutes left to claim this offer."));
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.ruleId, "false-urgency");
    assert.equal(findings[0]?.severity, "high");
    assert.ok((findings[0]?.confidence ?? 0) >= 0.9);
    assert.match(findings[0]?.description ?? "", /potential dark pattern detected/i);
    assert.equal(findings[0]?.evidence[0]?.type, "text");
    assert.match(findings[0]?.evidence[0]?.value ?? "", /only 5 minutes left/i);
  });

  it("ignores ordinary opening hours and dates", () => {
    const findings = detectFalseUrgency(
      page("Open daily from 9:00 AM to 5:00 PM. Published 12 March 2024."),
    );
    assert.deepEqual(findings, []);
  });

  it("ignores a bare clock while still flagging a real countdown phrase", () => {
    assert.deepEqual(detectFalseUrgency(page("Ends at 14:30. Timer reads 00:05:00.")), []);
    const findings = detectFalseUrgency(page("Hurry, only 5 minutes left."));
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.pageId, "page-1");
  });
});
