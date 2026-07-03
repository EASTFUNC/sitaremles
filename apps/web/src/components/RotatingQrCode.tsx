"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { RefreshCw } from "lucide-react";

export default function RotatingQrCode({ branchId, branchName }: { branchId: string; branchName: string }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    const supabase = createClient();

    async function refresh() {
      const { data, error } = await supabase.rpc("get_current_qr_payload", { p_branch_id: branchId });
      if (error || !data) return;
      const payload = JSON.stringify(data);
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`);
      setSecondsLeft(5);
    }

    refresh();
    const refreshInterval = setInterval(refresh, 5000);
    const countdownInterval = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [branchId]);

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          background: "#FFFFFF",
          padding: 10,
          borderRadius: 12,
          display: "inline-block",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      >
        {qrUrl && <img src={qrUrl} alt={`${branchName} QR kodu`} width={130} height={130} style={{ display: "block" }} />}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          marginTop: 8,
          fontSize: 11,
          color: "var(--text-secondary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <RefreshCw size={11} strokeWidth={2} />
        <span>{secondsLeft}s</span>
      </div>
    </div>
  );
}