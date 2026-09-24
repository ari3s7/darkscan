import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const port = Number(process.env.DEMO_PORT ?? 4174);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith("/")) path += "index.html";
  else if (!extname(path)) path += ".html";
  const file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Bad path");
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Missing</title><p>This demo page does not exist.</p>");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`DarkScan demo site at http://127.0.0.1:${port}`);
});
