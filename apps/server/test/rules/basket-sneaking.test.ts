import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Interaction } from "../../src/crawler/types.js";
import { detectBasketSneaking } from "../../src/detection/rules/basket-sneaking.js";
import type { DetectionPage } from "../../src/detection/types.js";

function page(interactions: Interaction[]): DetectionPage {
  return {
    id: "page-1",
    url: "https://shop.example/checkout",
    title: "Checkout",
    visibleText: "Review your order",
    interactions,
  };
}

describe("basket sneaking", () => {
  it("flags a protection plan that is already checked", () => {
    const findings = detectBasketSneaking(
      page([{ type: "checkbox", name: "protection", value: "premium", text: "Premium protection", checked: true }]),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.ruleId, "basket-sneaking");
    assert.equal(findings[0]?.severity, "high");
    assert.equal(findings[0]?.evidence[0]?.type, "element");
    assert.match(findings[0]?.evidence[0]?.value ?? "", /premium protection/i);
    assert.equal(findings[0]?.evidence[0]?.selector, 'checkbox[name="protection"]');
    assert.match(findings[0]?.description ?? "", /potential dark pattern detected/i);
  });

  it("ignores the same plan when it is not selected", () => {
    const findings = detectBasketSneaking(
      page([{ type: "checkbox", name: "protection", value: "premium", text: "Premium protection", checked: false }]),
    );
    assert.deepEqual(findings, []);
  });

  it("ignores a checked consent box and flags a hidden add-on fee", () => {
    assert.deepEqual(
      detectBasketSneaking(page([{ type: "checkbox", text: "I agree to the terms", checked: true }])),
      [],
    );
    const findings = detectBasketSneaking(
      page([{ type: "input", name: "addon_fee", value: "9.99", hidden: true }]),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.evidence[0]?.type, "attribute");
    assert.equal(findings[0]?.evidence[0]?.value, "addon_fee=9.99");
  });
});
