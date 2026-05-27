/**
 * LLM プロバイダ抽象化レイヤー
 *
 * 優先順位:
 *   1. GEMINI_API_KEY があれば Gemini を使う
 *   2. なければ OPENAI_API_KEY を見て OpenAI を使う
 *   3. 両方なければ null
 *
 * 教材方針: 受講者は無料の Gemini を基本に動かす。
 * 万が一 Gemini が落ちたら OPENAI_API_KEY を追加するだけで切り替わる。
 */

import { getGeminiClient } from "./gemini";
import { getOpenAIClient } from "./openai";

export type LLMProvider = "gemini" | "openai";

export const GEMINI_MODEL = "gemini-2.5-flash";
export const OPENAI_MODEL = "gpt-4o-mini";

export function getActiveProvider(): LLMProvider | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export interface GenerateOptions {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export async function generateAnswer(opts: GenerateOptions): Promise<string> {
  const provider = getActiveProvider();
  if (provider === "gemini") return generateWithGemini(opts);
  if (provider === "openai") return generateWithOpenAI(opts);
  throw new Error("No LLM provider configured (GEMINI_API_KEY or OPENAI_API_KEY required)");
}

export async function generateJSON<T>(opts: GenerateOptions): Promise<T> {
  const provider = getActiveProvider();
  if (provider === "gemini") return generateJSONWithGemini<T>(opts);
  if (provider === "openai") return generateJSONWithOpenAI<T>(opts);
  throw new Error("No LLM provider configured");
}

// ---------- Gemini ----------

async function generateWithGemini(opts: GenerateOptions): Promise<string> {
  const client = getGeminiClient();
  if (!client) throw new Error("Gemini client not available");
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: opts.userMessage,
    config: {
      systemInstruction: opts.systemPrompt,
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxOutputTokens ?? 600,
    },
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function generateJSONWithGemini<T>(opts: GenerateOptions): Promise<T> {
  const client = getGeminiClient();
  if (!client) throw new Error("Gemini client not available");
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: opts.userMessage,
    config: {
      systemInstruction: opts.systemPrompt,
      temperature: opts.temperature ?? 0,
      responseMimeType: "application/json",
    },
  });
  const raw = response.text;
  if (!raw) throw new Error("Gemini returned empty JSON response");
  return parseJSONLoosely<T>(raw);
}

// ---------- OpenAI ----------

async function generateWithOpenAI(opts: GenerateOptions): Promise<string> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI client not available");
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userMessage },
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxOutputTokens ?? 600,
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned empty response");
  return text;
}

async function generateJSONWithOpenAI<T>(opts: GenerateOptions): Promise<T> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OpenAI client not available");
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: opts.temperature ?? 0,
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned empty JSON response");
  return parseJSONLoosely<T>(raw);
}

// ---------- shared ----------

function parseJSONLoosely<T>(raw: string): T {
  // Gemini が ```json ... ``` で包むケースに対処
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
