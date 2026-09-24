import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Interaction } from "../../src/crawler/types.js";
import { detectActions } from "../../src/journey/journey-detector.js";

function link(text: string, href: string): Interaction {
  return { type: "link", text, value: href };
}

describe("action detection", () => {
  it("stores an add-to-cart link with its selector", () => {
    const actions = detectActions([
      link("Add to cart", "https://shop.test/cart"),
      { type: "button", text: "Checkout", name: "checkout" },
    ]);
    assert.equal(actions.length, 2);
    assert.equal(actions[0]?.kind, "add-to-cart");
    assert.equal(actions[0]?.follow, "link");
    assert.equal(actions[0]?.type, "link");
    assert.equal(actions[0]?.selector, 'role=link[name="Add to cart"]');
    assert.equal(actions[1]?.kind, "checkout");
    assert.equal(actions[1]?.follow, "click");
    assert.equal(actions[1]?.selector, 'button[name="checkout"]');
  });

  it("ignores ordinary navigation", () => {
    assert.deepEqual(detectActions([link("Learn more", "https://shop.test/about"), { type: "link", text: "About" }]), []);
  });

  it("records buy-now and remove without activating a button", () => {
    const actions = detectActions([
      { type: "button", text: "Buy now" },
      link("Buy now", "https://shop.test/checkout"),
      { type: "button", text: "Remove" },
    ]);
    assert.equal(actions.find((action) => action.type === "button" && action.kind === "buy-now")?.follow, "none");
    assert.equal(actions.find((action) => action.type === "link" && action.kind === "buy-now")?.follow, "link");
    assert.equal(actions.find((action) => action.kind === "remove")?.follow, "none");
  });
});
