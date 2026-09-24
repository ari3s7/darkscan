import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPage } from "../../src/journey/journey-detector.js";
import type { PageSignals } from "../../src/journey/types.js";

function signals(partial: Partial<PageSignals> & { url: string }): PageSignals {
  return {
    url: partial.url,
    title: partial.title ?? null,
    headings: partial.headings ?? [],
    buttons: partial.buttons ?? [],
    visibleText: partial.visibleText ?? "",
    fields: partial.fields ?? [],
  };
}

describe("page classification", () => {
  it("classifies the main commerce and account pages", () => {
    assert.equal(classifyPage(signals({ url: "https://shop.test/", title: "Welcome" })), "landing");
    assert.equal(classifyPage(signals({ url: "https://shop.test/product/shoe", title: "Trail shoes" })), "product");
    assert.equal(classifyPage(signals({ url: "https://shop.test/pricing", title: "Pricing" })), "pricing");
    assert.equal(classifyPage(signals({ url: "https://shop.test/cart", title: "Your cart" })), "cart");
    assert.equal(classifyPage(signals({ url: "https://shop.test/checkout", title: "Checkout" })), "checkout");
    assert.equal(classifyPage(signals({ url: "https://shop.test/signup", title: "Create account" })), "signup");
    assert.equal(classifyPage(signals({ url: "https://shop.test/login", title: "Sign in" })), "login");
    assert.equal(
      classifyPage(signals({ url: "https://shop.test/account", title: "Manage subscription" })),
      "subscription",
    );
    assert.equal(
      classifyPage(signals({ url: "https://shop.test/thank-you", title: "Thank you", headings: ["Order confirmed"] })),
      "confirmation",
    );
    assert.equal(
      classifyPage(signals({ url: "https://shop.test/cancel", title: "Cancel subscription" })),
      "cancellation",
    );
  });

  it("does not treat ordinary hours or dates as a confirmation", () => {
    assert.equal(
      classifyPage(
        signals({
          url: "https://shop.test/about",
          title: "About",
          headings: ["Open daily from 9:00 AM to 5:00 PM"],
          visibleText: "Published 12 March 2024.",
        }),
      ),
      "unknown",
    );
  });

  it("keeps checkout ahead of a cart mention and ignores a lone add-to-cart button", () => {
    assert.equal(
      classifyPage(
        signals({
          url: "https://shop.test/checkout",
          title: "Checkout",
          headings: ["Your cart"],
          visibleText: "Review your cart before you pay.",
        }),
      ),
      "checkout",
    );
    assert.equal(
      classifyPage(
        signals({
          url: "https://shop.test/blog/story",
          title: "A story",
          buttons: ["Add to cart"],
        }),
      ),
      "unknown",
    );
  });
});
