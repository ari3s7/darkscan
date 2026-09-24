import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Interaction } from "../../src/crawler/types.js";
import { detectForcedAction } from "../../src/detection/rules/forced-action.js";
import type { DetectionPage } from "../../src/detection/types.js";

function page(visibleText: string, interactions: Interaction[] = []): DetectionPage {
  return { id: "page-1", url: "https://shop.example/checkout", title: "Checkout", visibleText, interactions };
}

describe("forced action", () => {
  it("flags a required account when a guest path is also offered", () => {
    const findings = detectForcedAction(
      page("", [
        { type: "button", text: "Create an account to continue" },
        { type: "link", text: "Continue as guest" },
      ]),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.ruleId, "forced-action");
    assert.equal(findings[0]?.severity, "medium");
    assert.ok((findings[0]?.confidence ?? 0) >= 0.8);
    assert.match(findings[0]?.description ?? "", /potential dark pattern detected/i);
    assert.equal(findings[0]?.evidence.length, 2);
  });

  it("ignores a normal sign-in page", () => {
    const findings = detectForcedAction(page("Welcome back", [{ type: "button", text: "Sign in" }]));
    assert.deepEqual(findings, []);
  });

  it("does not flag an account requirement when no alternative is shown", () => {
    const findings = detectForcedAction(page("", [{ type: "button", text: "Create an account to continue" }]));
    assert.deepEqual(findings, []);
  });
});
