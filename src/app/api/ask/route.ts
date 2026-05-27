import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { MINTA_SYSTEM_PROMPT } from "@/lib/minta";
import { getActiveProvider, generateAnswer } from "@/lib/llm";
import { analyzeQA, stripObviousPII } from "@/lib/pii";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return Response.json(
      { error: "質問を入力してください。" },
      { status: 400 }
    );
  }
  if (question.length > 2000) {
    return Response.json(
      { error: "質問は2000文字以内でお願いします。" },
      { status: 400 }
    );
  }

  const provider = getActiveProvider();
  if (!provider) {
    return Response.json(
      {
        error:
          "AI APIキーが未設定です。.env.local に GEMINI_API_KEY または OPENAI_API_KEY を設定してください。",
      },
      { status: 503 }
    );
  }

  // 1) minta先生として回答を生成（regex で明らかなPIIだけ事前除去）
  const sanitizedQuestion = stripObviousPII(question);
  let answer: string;
  try {
    answer = await generateAnswer({
      systemPrompt: MINTA_SYSTEM_PROMPT,
      userMessage: sanitizedQuestion,
      temperature: 0.7,
      maxOutputTokens: 600,
    });
  } catch (err) {
    console.error(`[/api/ask] ${provider} 回答生成エラー:`, err);
    return Response.json(
      { error: "minta先生からの回答取得に失敗しました。" },
      { status: 502 }
    );
  }

  // 2) PII除去 + 分析メタデータ生成（保存はメタのみ）
  const analysis = await analyzeQA(question, answer);

  // 3) Supabase に保存（メタのみ・元の質問文/回答文は保存しない）
  const supabase = getSupabaseClient();
  let saved = false;
  if (supabase) {
    const { error } = await supabase.from("qa_logs").insert({
      category: analysis.category,
      topic_summary: analysis.topic_summary,
      answer_summary: analysis.answer_summary,
      question_char_count: question.length,
      answer_char_count: answer.length,
      contains_pii: analysis.contains_pii,
    });
    if (error) {
      console.error("[/api/ask] Supabase insert エラー:", error);
    } else {
      saved = true;
    }
  }

  return Response.json({
    provider,
    answer,
    analysis,
    saved,
  });
}
