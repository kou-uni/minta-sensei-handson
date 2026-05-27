# 教えて、minta先生 — Reference App

千葉工業大学「web3・AI概論 2026」のハンズオン教材「DB連携・API連携サンプル」のリファレンス実装です。

**Next.js + OpenAI API + Supabase + Vercel** で「質問を投げると minta先生（AI）が答え、個人情報を除いた分析メタだけが DB に蓄積される」最小アプリ。

## 構成

- `src/lib/minta.ts` — minta先生の system prompt（人格定義）
- `src/lib/openai.ts` — OpenAI クライアント
- `src/lib/pii.ts` — PII（個人情報）除去ロジック（regex 一次 + LLM 二次）
- `src/lib/supabase.ts` — Supabase クライアント
- `src/app/api/ask/route.ts` — POST: 質問 → OpenAI → 分析 → Supabase 保存
- `src/app/api/history/route.ts` — GET: 履歴取得
- `src/app/page.tsx` — UI

## ローカル起動

```bash
cp .env.local.example .env.local
# .env.local をエディタで開き、OPENAI_API_KEY を書く
# Supabase 3つは未設定でもアプリは起動（履歴は空のまま）
npm install
npm run dev
```

→ http://localhost:3000

## Vercel デプロイ

1. このレポを Vercel に Import
2. **環境変数** で `OPENAI_API_KEY` を設定
3. Deploy → 公開URLで動作確認
4. Vercel ダッシュボード → Storage → **Create Database → Supabase** で連携
   - Supabase の URL / anon key / service_role key が自動で環境変数に追加される
5. Supabase の SQL Editor で教材側の `assets/supabase-schema.sql` を Run
6. Vercel で Redeploy → 履歴がDBに蓄積される

## ライセンス

教材本体は CC BY-NC-SA 4.0。アプリのコード部分は MIT 相当で再利用OK。
