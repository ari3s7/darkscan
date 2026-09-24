import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpError } from "../../src/lib/httpError.js";
import { parseScanRequest } from "../../src/lib/validateScanRequest.js";
import { isPrivateIp, publicUrlProblem } from "../../src/lib/urlSafety.js";

describe("scan URL safety", () => {
  it("rejects non-http URLs, credentials, and private targets", async () => {
    await assert.rejects(() => parseScanRequest({ url: "javascript:alert(1)" }), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 400);
      return true;
    });
    await assert.rejects(() => parseScanRequest({ url: "file:///etc/passwd" }), HttpError);
    await assert.rejects(() => parseScanRequest({ url: "http://user:secret@example.com" }), HttpError);
    await assert.rejects(() => parseScanRequest({ url: "http://127.0.0.1/admin" }), HttpError);
    await assert.rejects(() => parseScanRequest({ url: "http://192.168.1.20/" }), HttpError);
    await assert.rejects(() => parseScanRequest({ url: "http://10.1.1.1/" }), HttpError);
    await assert.rejects(() => parseScanRequest({ url: "http://169.254.169.254/latest" }), HttpError);
    await assert.rejects(() => parseScanRequest({ url: "http://[::1]/" }), HttpError);
    await assert.rejects(() => parseScanRequest({ url: "http://localhost/demo" }), HttpError);
    assert.equal(await publicUrlProblem("http://2130706433/", false), "url must not target a local or private network");
  });

  it("allows a public literal and a private host only when the demo switch is on", async () => {
    assert.equal(isPrivateIp("1.1.1.1"), false);
    assert.equal(isPrivateIp("8.8.8.8"), false);
    assert.equal(await publicUrlProblem("https://1.1.1.1/path", false), null);
    const local = await parseScanRequest({ url: "http://127.0.0.1:4174/" }, { allowPrivateHosts: true });
    assert.equal(local.url, "http://127.0.0.1:4174/");
  });
});