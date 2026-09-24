import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Interaction } from "../../src/crawler/types.js";
import { detectConfirmShaming } from "../../src/detection/rules/confirm-shaming.js";
import type { DetectionPage } from "../../src/detection/types.js";

function page(visibleText: string, interactions: Interaction[]): DetectionPage {
  return { id: "page-1", url: "https://shop.example/offer", title: "Offer", visibleText, interactions };
}

describe("confirm shaming", () => {
  it("flags a decline button that shames the opt-out", () => {
    const findings = detectConfirmShaming(
      page("", [
        { type: "button", text: "No, I don't want to save money" },
        { type: "link", text: "No thanks, I prefer to pay full price" },
      ]),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.ruleId, "confirm-shaming");
    assert.equal(findings[0]?.severity, "medium");
    assert.equal(findings[0]?.evidence.length, 2);
    assert.equal(findings[0]?.evidence[0]?.type, "element");
    assert.match(findings[0]?.description ?? "", /potential dark pattern detected/i);
  });

  it("does not treat a plain decline as shaming", () => {
    const findings = detectConfirmShaming(page("", [{ type: "button", text: "No thanks" }]));
    assert.deepEqual(findings, []);
  });

  it("ignores shaming copy that is not on a button or link", () => {
    const findings = detectConfirmShaming(
      page("No, I don't want to save money", [{ type: "input", text: "Email", name: "email" }]),
    );
    assert.deepEqual(findings, []);
  });
});
