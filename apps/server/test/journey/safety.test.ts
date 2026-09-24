import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideFollow,
  interactionPlan,
  isAllowedTarget,
  isPersonalField,
  shouldStop,
} from "../../src/journey/interaction-handler.js";
import type { DiscoveredAction, PageSignals } from "../../src/journey/types.js";

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

function action(partial: Partial<DiscoveredAction> & Pick<DiscoveredAction, "label" | "kind" | "follow">): DiscoveredAction {
  return { type: partial.type ?? "button", ...partial };
}

describe("safety restrictions", () => {
  it("follows an add-to-cart link on a product page", () => {
    const plan = interactionPlan(
      action({
        label: "Add to cart",
        kind: "add-to-cart",
        follow: "link",
        type: "link",
        href: "https://shop.test/cart",
      }),
      signals({ url: "https://shop.test/product" }),
    );
    assert.equal(plan, "open");
  });

  it("does not leave the origin or open a destructive path", () => {
    assert.equal(isAllowedTarget("https://evil.test/cart", "https://shop.test"), false);
    assert.equal(isAllowedTarget("https://shop.test/logout", "https://shop.test"), false);
    assert.equal(isAllowedTarget("https://shop.test/cart", "https://shop.test"), true);
    assert.equal(
      decideFollow(
        action({ label: "Add to cart", kind: "add-to-cart", follow: "link", type: "link", href: "/cart" }),
        signals({ url: "https://shop.test/product" }),
      ),
      "link",
    );
    assert.equal(
      decideFollow(
        action({ label: "Cancel subscription", kind: "cancel", follow: "link", type: "link", href: "/logout" }),
        signals({ url: "https://shop.test/" }),
      ),
      "none",
    );
    assert.equal(
      decideFollow(
        action({
          label: "Checkout",
          kind: "checkout",
          follow: "link",
          type: "link",
          href: "https://evil.test/checkout",
        }),
        signals({ url: "https://shop.test/cart" }),
      ),
      "none",
    );
  });

  it("stops at payment or authentication and never plans data entry", () => {
    const payment = signals({
      url: "https://shop.test/checkout",
      fields: [{ type: "input", name: "cardnumber", text: "Card number" }],
      buttons: ["Continue", "Pay now"],
    });
    assert.deepEqual(shouldStop(payment), { stop: true, reason: "payment" });
    assert.equal(
      interactionPlan(action({ label: "Continue", kind: "continue", follow: "click" }), payment),
      "skip",
    );
    assert.equal(
      interactionPlan(action({ label: "Pay now", kind: "buy-now", follow: "click" }), payment),
      "skip",
    );
    assert.equal(isPersonalField({ name: "email", text: "Email address" }), true);

    const login = signals({
      url: "https://shop.test/login",
      fields: [{ type: "input", name: "password", text: "Password" }],
      buttons: ["Sign in"],
    });
    assert.equal(shouldStop(login).reason, "authentication");
    assert.equal(
      interactionPlan(
        action({ label: "Create an account", kind: "sign-up", follow: "click", type: "button" }),
        login,
      ),
      "skip",
    );

    const guest = signals({
      url: "https://shop.test/login",
      fields: [{ type: "input", name: "password" }],
      buttons: ["Continue as guest"],
    });
    assert.equal(shouldStop(guest).stop, false);
    assert.equal(
      interactionPlan(action({ label: "Remove", kind: "remove", follow: "none" }), guest),
      "skip",
    );
    assert.equal(
      decideFollow(action({ label: "Place order", kind: "continue", follow: "click" }), signals({ url: "https://shop.test/cart" })),
      "none",
    );
  });
});
