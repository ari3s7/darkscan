import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { annotatedSvg, pngSize, writeAnnotatedScreenshot } from "../../src/evidence/annotate.js";

function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  bytes[0] = 0x89;
  bytes.write("PNG", 1, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

describe("annotation", () => {
  it("reads the PNG size and draws a rectangle over the element", () => {
    assert.deepEqual(pngSize(png(320, 180)), { width: 320, height: 180 });
    assert.equal(pngSize(Buffer.from("not a png")), null);
    const svg = annotatedSvg("01.png", 320, 180, { x: 12, y: 40, width: 180, height: 24 });
    assert.match(svg, /href="01.png"/);
    assert.match(svg, /<rect x="12" y="40" width="180" height="24"/);
    assert.match(svg, /stroke="#d92d20"/);
  });

  it("writes the annotated screenshot beside the page capture", async () => {
    const directory = fileURLToPath(new URL("../../storage/evidence-test/", import.meta.url));
    await mkdir(directory, { recursive: true });
    const screenshot = join(directory, "01.png");
    await writeFile(screenshot, png(640, 200));
    const stored = await writeAnnotatedScreenshot(screenshot, { x: 8, y: 16, width: 100, height: 30 }, "preselection", 0);
    assert.equal(stored, join(directory, "01-preselection-0.svg"));
    const svg = await readFile(stored ?? "", "utf8");
    assert.match(svg, /width="640" height="200"/);
    assert.match(svg, /<rect x="8" y="16" width="100" height="30"/);
  });
});
