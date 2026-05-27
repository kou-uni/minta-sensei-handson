import { getSupabasePublicClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabasePublicClient();
  if (!supabase) {
    return Response.json({ logs: [], configured: false });
  }

  const { data, error } = await supabase
    .from("qa_logs")
    .select(
      "id, category, topic_summary, answer_summary, question_char_count, answer_char_count, contains_pii, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[/api/history] Supabase select エラー:", error);
    return Response.json({ logs: [], configured: true, error: error.message });
  }

  return Response.json({ logs: data ?? [], configured: true });
}
