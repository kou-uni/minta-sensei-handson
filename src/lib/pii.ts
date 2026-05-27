import OpenAI from "openai";

const EMAIL_REGEX = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-\s]?)?\(?\d{2,4}\)?[-\s]?\d{2,4}[-\s]?\d{3,4}/g;
const URL_REGEX = /https?:\/\/[^\s]+/g;

export function stripObviousPII(text: string): string {
  return text
    .replace(EMAIL_REGEX, "[メール]")
    .replace(URL_REGEX, "[URL]")
    .replace(PHONE_REGEX, "[電話]");
}

export interface AnalysisResult {
  category: string;
  topic_summary: string;
  answer_summary: string;
  contains_pii: boolean;
}

const ANALYZER_PROMPT = `あなたは質問と回答のペアを分析し、個人情報を完全に除いた要約を作るアシスタントです。

# 入力
- question: ユーザーの質問
- answer: AIの回答

# 出力（必ずこのJSON形式のみ）
{
  "category": "AI | web3 | 開発 | 学習方法 | その他 のいずれか1つ",
  "topic_summary": "質問の内容を表す30文字程度の日本語要約（個人情報を完全除去）",
  "answer_summary": "回答の要点を40文字程度の日本語で要約（個人情報を完全除去）",
  "contains_pii": true もしくは false（元テキストにPIIが含まれていたか）
}

# 個人情報の除去ルール（厳守）
- 人名（漢字氏名・カタカナ氏名・ニックネーム）→ 「ある学生」「ある人」など一般化
- 住所・地名（特定の市区町村以下）→ 「ある地域」
- 学校名・会社名・サークル名 → 「ある学校」「ある組織」
- メールアドレス・電話番号・URL → 出力には含めない
- SNSアカウント名・Discord ID → 出力には含めない
- 固有の製品名やサービス名（一般的に知られているもの: ChatGPT, GitHub等）は残してOK

JSON以外の文字（前置き・後置き・コードブロック記号など）は出力しないこと。`;

export async function analyzeWithLLM(
  client: OpenAI,
  question: string,
  answer: string
): Promise<AnalysisResult> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: ANALYZER_PROMPT },
      {
        role: "user",
        content: `question: ${question}\n\nanswer: ${answer}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("PII analyzer returned empty response");

  const parsed = JSON.parse(raw) as AnalysisResult;
  return {
    category: parsed.category ?? "その他",
    topic_summary: parsed.topic_summary ?? "（要約取得失敗）",
    answer_summary: parsed.answer_summary ?? "（要約取得失敗）",
    contains_pii: !!parsed.contains_pii,
  };
}
