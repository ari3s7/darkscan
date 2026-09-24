import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { ElementBox } from "./record.js";

export function pngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || bytes.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export function annotatedSvg(imageFile: string, width: number, height: number, box: ElementBox): string {
  const x = Math.max(0, Math.min(box.x, width));
  const y = Math.max(0, Math.min(box.y, height));
  const rectWidth = Math.max(1, Math.min(box.width, width - x));
  const rectHeight = Math.max(1, Math.min(box.height, height - y));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image href="${imageFile}" xlink:href="${imageFile}" width="${width}" height="${height}" />
  <rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" fill="rgba(217,45,32,0.18)" stroke="#d92d20" stroke-width="3" />
</svg>
`;
}

function resolvePath(screenshotPath: string): string {
  return screenshotPath.startsWith("/") ? screenshotPath : join(process.cwd(), screenshotPath);
}

/** Writes an SVG beside the page screenshot with a rectangle over the element. */
export async function writeAnnotatedScreenshot(
  screenshotPath: string,
  box: ElementBox,
  ruleId: string,
  index: number,
): Promise<string | null> {
  let bytes: Buffer;
  try {
    bytes = await readFile(resolvePath(screenshotPath));
  } catch {
    return null;
  }
  const size = pngSize(bytes);
  if (!size) return null;
  const fileName = `${basename(screenshotPath, ".png")}-${ruleId}-${index}.svg`;
  const stored = join(dirname(screenshotPath), fileName).split("\\").join("/");
  await writeFile(resolvePath(stored), annotatedSvg(basename(screenshotPath), size.width, size.height, box), "utf8");
  return stored;
}
