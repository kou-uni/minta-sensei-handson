import { GoogleGenAI } from "@google/genai";

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
