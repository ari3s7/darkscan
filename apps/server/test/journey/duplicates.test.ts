import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildJourneyRecords } from "../../src/journey/journey-engine.js";
import { actionKey, claim } from "../../src/journey/interaction-handler.js";
import type { VisitRecord } from "../../src/journey/types.js";

describe("duplicate prevention", () => {
  it("records a url only once", () => {
    const seen = new Set<string>();
    assert.equal(claim(seen, "https://shop.test/cart"), true);
    assert.equal(claim(seen, "https://shop.test/cart"), false);
  });

  it("records an action only once", () => {
    const seen = new Set<string>();
    const key = actionKey("https://shop.test/product", {
      kind: "add-to-cart",
      label: "Add to cart",
      type: "link",
      selector: 'a[href*="/cart"]',
    });
    assert.equal(claim(seen, key), true);
    assert.equal(claim(seen, key), false);
    assert.notEqual(
      key,
      actionKey("https://shop.test/product", { kind: "checkout", label: "Checkout", type: "link" }),
    );
  });

  it("does not repeat a page inside one journey", () => {
    const visit: VisitRecord = {
      url: "https://shop.test/cart",
      kind: "cart",
      blocked: false,
      actions: [{ label: "Checkout", type: "link", selector: 'a[href*="/checkout"]' }],
    };
    const journeys = buildJourneyRecords([visit, visit]);
    assert.equal(journeys[0]?.pages.length, 1);
    assert.equal(journeys[0]?.actions.length, 1);
  });
});
