import { readFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import type { AiClient, AiCompletionRequest } from "./types.js";

const MAX_IMAGE_BYTES = 1_000_000;

export function redactSecrets(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_\-]+/g, "[redacted]").slice(0, 180);
}

function resolvePath(screenshotPath: string): string {
  return screenshotPath.startsWith("/") ? screenshotPath : join(process.cwd(), screenshotPath);
}

async function imageContent(screenshotPath: string): Promise<OpenAI.Chat.Completions.ChatCompletionContentPartImage | null> {
  try {
    const bytes = await readFile(resolvePath(screenshotPath));
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
    const encoded = bytes.toString("base64");
    return {
      type: "image_url",
      image_url: { url: `data:image/png;base64,${encoded}`, detail: "low" },
    };
  } catch {
    return null;
  }
}

export function createOpenAiClient(apiKey: string, model: string, baseURL?: string): AiClient {
  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL, defaultHeaders: { "X-Title": "DarkScan" } } : {}),
  });
  return {
    async complete(request: AiCompletionRequest): Promise<unknown> {
      try {
        const image = request.screenshotPath ? await imageContent(request.screenshotPath) : null;
        const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: request.user }];
        if (image) userContent.push(image);
        const response = await client.chat.completions.create({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: userContent },
          ],
        });
        return response.choices[0]?.message?.content ?? null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI request failed";
        throw new Error(redactSecrets(message));
      }
    },
  };
}
