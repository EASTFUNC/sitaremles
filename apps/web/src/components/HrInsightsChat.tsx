"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Send, Loader2, MessageSquare } from "lucide-react";

type Exchange = { question: string; answer: string };

export default function HrInsightsChat({ companyId }: { companyId: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Exchange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function askQuestion() {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    const currentQuestion = question;

    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/hr-insights-agent`, {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company_id: companyId, question: currentQuestion }),
      });
      const data = await res.json();
      if (data.success) {
        setHistory((h) => [{ question: currentQuestion, answer: data.answer }, ...h]);
        setQuestion("");
        router.refresh();
      } else {
        setError(data.error ?? "Bilinmeyen hata");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") askQuestion();
          }}
          placeholder="Örn. Hangi şubede en çok şüpheli giriş var?"
          style={inputStyle}
        />
        <button onClick={askQuestion} disabled={loading || !question.trim()} style={{ ...buttonStyle, opacity: loading ? 0.6 : 1 }}>
          {loading ? <Loader2 size={15} strokeWidth={2} className="spin" /> : <Send size={15} strokeWidth={2} />}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12.5, color: "#D64545", marginTop: 10 }}>Hata: {error}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {history.map((ex, i) => (
          <div key={i} style={exchangeBoxStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <MessageSquare size={13} strokeWidth={1.75} color="var(--accent)" />
              <strong style={{ fontSize: 12.5 }}>{ex.question}</strong>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{ex.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 13,
};
const buttonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 10,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const exchangeBoxStyle: React.CSSProperties = {
  padding: 14,
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--bg-elevated)",
};