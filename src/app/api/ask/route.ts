import { NextRequest } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { getSupabaseClient } from "@/lib/supabase";
import { MINTA_MODEL, MINTA_SYSTEM_PROMPT } from "@/lib/minta";
import { analyzeWithLLM, stripObviousPII } from "@/lib/pii";

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

  const gemini = getGeminiClient();
  if (!gemini) {
    return Response.json(
      {
        error:
          "Gemini APIキーが未設定です。.env.local に GEMINI_API_KEY を設定してください。",
      },
      { status: 503 }
    );
  }

  // 1) minta先生として回答を生成
  const sanitizedQuestion = stripObviousPII(question);
  let answer: string;
  try {
    const response = await gemini.models.generateContent({
      model: MINTA_MODEL,
      contents: sanitizedQuestion,
      config: {
        systemInstruction: MINTA_SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    });
    answer = response.text?.trim() ?? "";
    if (!answer) throw new Error("empty answer");
  } catch (err) {
    console.error("[/api/ask] Gemini 回答生成エラー:", err);
    return Response.json(
      { error: "minta先生からの回答取得に失敗しました。" },
      { status: 502 }
    );
  }

  // 2) PII除去 + 分析メタデータ生成（保存はメタのみ）
  let analysis;
  try {
    analysis = await analyzeWithLLM(gemini, question, answer);
  } catch (err) {
    console.error("[/api/ask] PII analyzer エラー:", err);
    analysis = {
      category: "その他",
      topic_summary: "（分析失敗）",
      answer_summary: "（分析失敗）",
      contains_pii: false,
    };
  }

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
    answer,
    analysis,
    saved,
  });
}
