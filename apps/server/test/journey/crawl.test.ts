import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { CRAWL_MAX_DEPTH, CRAWL_MAX_PAGES } from "../../src/crawler/crawler.js";
import { runDetection } from "../../src/detection/engine.js";
import { crawlJourney } from "../../src/journey/journey-engine.js";

const pages: Record<string, string> = {
  "/": `<!doctype html><html><head><title>Welcome</title></head><body>
    <h1>Welcome</h1>
    <a href="/product">Product</a>
    <a href="/pricing">Pricing</a>
    <a href="/billing">Manage subscription</a>
    <a href="/cancel">Cancel subscription</a>
    <a href="/logout">Log out</a>
    <a href="/broken">Broken page</a>
    <a href="https://example.com/out">Elsewhere</a>
  </body></html>`,
  "/product": `<!doctype html><html><head><title>Trail shoes</title></head><body>
    <h1>Trail shoes</h1>
    <p>Only 5 minutes left to claim this offer.</p>
    <a href="/cart">Add to cart</a>
  </body></html>`,
  "/cart": `<!doctype html><html><head><title>Your cart</title></head><body>
    <h1>Your cart</h1>
    <label><input type="checkbox" name="protection" value="premium" checked> Premium protection</label>
    <a href="/checkout">Checkout</a>
    <button type="button">Remove</button>
  </body></html>`,
  "/checkout": `<!doctype html><html><head><title>Checkout</title></head><body>
    <h1>Checkout</h1>
    <form method="post" action="/done">
      <label>Card number <input name="cardnumber"></label>
      <button type="submit">Pay now</button>
    </form>
  </body></html>`,
  "/pricing": `<!doctype html><html><head><title>Pricing</title></head><body>
    <h1>Pricing</h1>
    <a href="/signup">Start free trial</a>
  </body></html>`,
  "/signup": `<!doctype html><html><head><title>Create account</title></head><body>
    <h1>Create account</h1>
    <form method="post" action="/account">
      <label>Password <input type="password" name="password"></label>
      <button type="submit">Create an account</button>
    </form>
  </body></html>`,
  "/billing": `<!doctype html><html><head><title>Manage subscription</title></head><body>
    <h1>Manage subscription</h1>
  </body></html>`,
  "/cancel": `<!doctype html><html><head><title>Cancel subscription</title></head><body>
    <h1>Cancel subscription</h1>
    <button type="submit">Confirm cancellation</button>
  </body></html>`,
  "/done": `<!doctype html><html><head><title>Thank you</title></head><body><h1>Thank you</h1></body></html>`,
  "/logout": `<!doctype html><html><head><title>Log out</title></head><body><h1>Delete account</h1></body></html>`,
};

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") resolve(address.port);
      else reject(new Error("No port"));
    });
    server.on("error", reject);
  });
}

describe("journey crawl", () => {
  it("walks the shop flow and stops before payment, logout, and other sites", async () => {
    const seen: string[] = [];
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      seen.push(`${request.method ?? "GET"} ${path}`);
      if (path === "/broken") {
        response.destroy();
        return;
      }
      const body = pages[path];
      if (!body || request.method !== "GET") {
        response.writeHead(404, { "content-type": "text/html" });
        response.end("<!doctype html><title>Missing</title>");
        return;
      }
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(body);
    });
    const port = await listen(server);
    const storage = fileURLToPath(new URL("../../storage/", import.meta.url));
    await mkdir(storage, { recursive: true });
    const directory = await mkdtemp(join(storage, "journey-"));
    try {
      const result = await crawlJourney(`http://127.0.0.1:${port}/`, {
        maxPages: CRAWL_MAX_PAGES,
        maxDepth: CRAWL_MAX_DEPTH,
        timeoutMs: 15_000,
        screenshotDir: directory,
        screenshotPathPrefix: "storage/journey-test",
      });
      const paths = result.pages.map((page) => new URL(page.finalUrl).pathname);
      assert.ok(paths.includes("/"));
      assert.ok(paths.includes("/product"));
      assert.ok(paths.includes("/cart"));
      assert.ok(paths.includes("/checkout"));
      assert.ok(paths.includes("/pricing"));
      assert.ok(paths.includes("/signup"));
      assert.ok(paths.includes("/billing"));
      assert.ok(paths.includes("/cancel"));
      assert.equal(paths.includes("/done"), false);
      assert.equal(paths.includes("/logout"), false);
      assert.ok(result.errors.some((error) => error.includes("/broken")));
      assert.ok(result.pages.length > 1);
      assert.equal(seen.some((hit) => hit.startsWith("POST")), false);
      assert.equal(seen.some((hit) => hit.includes("/done")), false);
      assert.ok(result.pages.length <= CRAWL_MAX_PAGES);
      assert.ok(result.pages.every((page) => page.depth <= CRAWL_MAX_DEPTH));

      const checkout = result.journeys.find((journey) => journey.type === "checkout");
      const signup = result.journeys.find((journey) => journey.type === "signup");
      const subscription = result.journeys.find((journey) => journey.type === "subscription");
      const cancellation = result.journeys.find((journey) => journey.type === "cancellation");
      assert.equal(checkout?.status, "blocked");
      assert.equal(signup?.status, "blocked");
      assert.equal(subscription?.status, "completed");
      assert.equal(cancellation?.status, "completed");
      assert.ok(checkout?.actions.some((action) => action.label === "Add to cart"));
      assert.ok(checkout?.actions.some((action) => action.label === "Remove" && action.type === "button"));
      assert.equal(checkout?.actions.some((action) => /pay now/i.test(action.label)), false);

      const product = result.pages.find((page) => new URL(page.finalUrl).pathname === "/product");
      const cart = result.pages.find((page) => new URL(page.finalUrl).pathname === "/cart");
      assert.ok(product);
      assert.ok(cart);
      const findings = [
        ...runDetection({
          id: "product",
          url: product.finalUrl,
          title: product.title,
          visibleText: product.visibleText,
          interactions: product.interactions,
        }),
        ...runDetection({
          id: "cart",
          url: cart.finalUrl,
          title: cart.title,
          visibleText: cart.visibleText,
          interactions: cart.interactions,
        }),
      ];
      assert.ok(findings.some((finding) => finding.ruleId === "false-urgency"));
      assert.ok(findings.some((finding) => finding.ruleId === "basket-sneaking"));
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
