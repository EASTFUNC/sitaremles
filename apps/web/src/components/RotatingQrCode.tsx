"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

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
      {qrUrl && <img src={qrUrl} alt={`${branchName} QR kodu`} width={140} height={140} style={{ borderRadius: 8 }} />}
      <p style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
        {secondsLeft}s içinde yenilenecek
      </p>
    </div>
  );
}