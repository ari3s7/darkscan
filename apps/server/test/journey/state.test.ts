import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildJourneyRecords, journeyStatus } from "../../src/journey/journey-engine.js";

describe("journey state", () => {
  it("moves a checkout flow from discovered to blocked", () => {
    assert.equal(journeyStatus("checkout", [{ kind: "landing", blocked: false }]), "discovered");
    assert.equal(journeyStatus("checkout", [{ kind: "product", blocked: false }]), "in_progress");
    const journeys = buildJourneyRecords([
      { url: "https://shop.test/", kind: "landing", blocked: false, actions: [] },
      {
        url: "https://shop.test/product",
        kind: "product",
        blocked: false,
        actions: [{ label: "Add to cart", type: "link" }],
        arrival: { label: "Product", type: "link" },
      },
      {
        url: "https://shop.test/checkout",
        kind: "checkout",
        blocked: true,
        actions: [{ label: "Pay now", type: "button" }],
        arrival: { label: "Checkout", type: "link", selector: 'a[href*="/checkout"]' },
      },
    ]);
    assert.equal(journeys.length, 1);
    assert.equal(journeys[0]?.type, "checkout");
    assert.equal(journeys[0]?.status, "blocked");
    assert.deepEqual(journeys[0]?.pages, [
      "https://shop.test/",
      "https://shop.test/product",
      "https://shop.test/checkout",
    ]);
    assert.equal(journeys[0]?.steps[2]?.actionLabel, "Checkout");
    assert.equal(journeys[0]?.steps[2]?.actionSelector, 'a[href*="/checkout"]');
  });

  it("does not complete a flow that never reaches confirmation", () => {
    assert.notEqual(journeyStatus("checkout", [{ kind: "cart", blocked: false }]), "completed");
    assert.equal(journeyStatus("signup", [{ kind: "login", blocked: false }]), "in_progress");
  });

  it("completes confirmation, cancellation, and subscription when those pages are reached", () => {
    assert.equal(
      journeyStatus("checkout", [
        { kind: "checkout", blocked: true },
        { kind: "confirmation", blocked: false },
      ]),
      "completed",
    );
    assert.equal(journeyStatus("cancellation", [{ kind: "cancellation", blocked: false }]), "completed");
    assert.equal(journeyStatus("subscription", [{ kind: "subscription", blocked: false }]), "completed");
    assert.equal(journeyStatus("subscription", [{ kind: "subscription", blocked: true }]), "blocked");
    assert.equal(journeyStatus("signup", [{ kind: "signup", blocked: true }]), "blocked");
  });
});
