"use client";

import { useEffect, useState } from "react";

interface QaLog {
  id: string;
  category: string;
  topic_summary: string;
  answer_summary: string;
  question_char_count: number;
  answer_char_count: number;
  contains_pii: boolean;
  created_at: string;
}

interface AskResponse {
  answer: string;
  analysis: {
    category: string;
    topic_summary: string;
    answer_summary: string;
    contains_pii: boolean;
  };
  saved: boolean;
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AskResponse["analysis"] | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<QaLog[]>([]);
  const [historyConfigured, setHistoryConfigured] = useState<boolean>(true);

  async function loadHistory() {
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      const data = (await res.json()) as { logs: QaLog[]; configured: boolean };
      setLogs(data.logs);
      setHistoryConfigured(data.configured);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setAnalysis(null);
    setSaved(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "エラーが発生しました。");
      } else {
        const ok = data as AskResponse;
        setAnswer(ok.answer);
        setAnalysis(ok.analysis);
        setSaved(ok.saved);
        await loadHistory();
      }
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white text-zinc-900">
      <main className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-10">
          <div className="text-sm tracking-widest text-rose-500 font-semibold mb-2">
            HANDS-ON SAMPLE · web3 / AI 概論 2026
          </div>
          <h1 className="text-3xl font-bold mb-3">教えて、minta先生</h1>
          <p className="text-zinc-600 leading-relaxed">
            AI（OpenAI API）と DB（Supabase）を組み合わせた、最小サンプルアプリ。
            <br />
            質問を投げると minta先生が答えます。
            個人情報を除いた分析メタだけがDBに蓄積されます。
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 mb-8"
        >
          <label className="block text-sm font-semibold mb-2">
            minta先生に聞きたいこと
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例: Next.js の App Router と Pages Router の違いを教えてください"
            rows={4}
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent resize-none"
            maxLength={2000}
            disabled={loading}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-zinc-500">{question.length} / 2000</div>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="bg-rose-500 hover:bg-rose-600 disabled:bg-zinc-300 text-white font-semibold px-6 py-2.5 rounded-full text-sm transition"
            >
              {loading ? "minta先生が考え中..." : "minta先生に聞く"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {answer && (
          <section className="mb-10">
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🌱</span>
                <span className="font-semibold">minta先生</span>
              </div>
              <p className="text-zinc-800 whitespace-pre-wrap leading-relaxed">
                {answer}
              </p>
            </div>
            {analysis && (
              <details className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-700">
                <summary className="cursor-pointer font-semibold">
                  🔬 DBに保存された分析メタ（個人情報除去済）
                  {saved === false && (
                    <span className="ml-2 text-amber-600 font-normal">
                      ※ Supabase未設定のため保存スキップ
                    </span>
                  )}
                </summary>
                <dl className="mt-3 space-y-1">
                  <div className="flex gap-2">
                    <dt className="text-zinc-500 w-28">カテゴリ:</dt>
                    <dd>{analysis.category}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-zinc-500 w-28">質問の要約:</dt>
                    <dd>{analysis.topic_summary}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-zinc-500 w-28">回答の要約:</dt>
                    <dd>{analysis.answer_summary}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-zinc-500 w-28">PII検出:</dt>
                    <dd>{analysis.contains_pii ? "あり（要約から除去済）" : "なし"}</dd>
                  </div>
                </dl>
              </details>
            )}
          </section>
        )}

        <section>
          <h2 className="text-xl font-bold mb-4">📊 みんなの質問傾向（最新20件）</h2>
          {!historyConfigured ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
              Supabase が未設定です。<code className="bg-amber-100 px-1 rounded">.env.local</code>{" "}
              に Supabase の URL と Key を設定すると、ここに分析履歴が表示されます。
            </div>
          ) : logs.length === 0 ? (
            <div className="text-sm text-zinc-500">まだ履歴がありません。</div>
          ) : (
            <ul className="space-y-2">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {log.category}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(log.created_at).toLocaleString("ja-JP")}
                    </span>
                    {log.contains_pii && (
                      <span className="text-xs text-amber-600">🔒 PII除去済</span>
                    )}
                  </div>
                  <div className="text-zinc-800 font-medium">{log.topic_summary}</div>
                  <div className="text-zinc-600 mt-0.5">→ {log.answer_summary}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-16 text-center text-xs text-zinc-400">
          Powered by Next.js · OpenAI · Supabase · Vercel
        </footer>
      </main>
    </div>
  );
}
