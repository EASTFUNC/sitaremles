import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { company_id, branch_id, week_start } = await req.json();
    const authHeader = req.headers.get("Authorization")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // 1) Bağlamı topla
    const { data: context, error: ctxError } = await supabase.rpc("get_shift_agent_context", {
      p_company_id: company_id,
      p_branch_id: branch_id,
      p_week_start: week_start,
    });
    if (ctxError) throw ctxError;

    const employees = context.employees ?? [];
    const templates = context.shift_templates ?? [];

    if (employees.length === 0 || templates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Bu şubede personel veya vardiya şablonu bulunamadı." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2) Gemini'den TASLAK plan iste (yapılandırılmış JSON çıktı)
    const prompt = `Sen bir vardiya planlama asistanısın. Aşağıdaki verilere göre ${week_start} tarihinden başlayan 7 günlük bir vardiya taslağı öner.

Personel: ${JSON.stringify(employees)}
İzinli oldukları tarihler (bu tarihlerde ASLA vardiya atama): ${JSON.stringify(context.leave_conflicts)}
Zaten atanmış vardiyalar (tekrar atama, çakıştırma): ${JSON.stringify(context.existing_assignments)}
Vardiya şablonları: ${JSON.stringify(templates)}

Sadece şu JSON formatında, başka hiçbir açıklama olmadan cevap ver:
{"assignments": [{"user_id": "...", "work_date": "YYYY-MM-DD", "shift_template_id": "..."}]}

Her personele haftada en fazla 6 gün, en az 1 gün dinlenme olacak şekilde adil dağıt.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const draft = JSON.parse(rawText);
    const proposedAssignments = draft.assignments ?? [];

    // 3) SUNUCU TARAFI DOĞRULAMA - LLM çıktısına asla ham güvenmiyoruz
    const validEmployeeIds = new Set(employees.map((e: any) => e.user_id));
    const validTemplateIds = new Set(templates.map((t: any) => t.id));
    const leaveMap: Record<string, { start: string; end: string }[]> = {};
    for (const l of context.leave_conflicts ?? []) {
      leaveMap[l.user_id] = leaveMap[l.user_id] ?? [];
      leaveMap[l.user_id].push({ start: l.start_date, end: l.end_date });
    }
    const existingSet = new Set(
      (context.existing_assignments ?? []).map((a: any) => `${a.user_id}_${a.work_date}`)
    );

    const weekStartDate = new Date(week_start);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    const validated: any[] = [];
    const rejected: any[] = [];
    const seenInDraft = new Set<string>();

    for (const item of proposedAssignments) {
      const key = `${item.user_id}_${item.work_date}`;
      const reasons: string[] = [];

      if (!validEmployeeIds.has(item.user_id)) reasons.push("geçersiz personel");
      if (!validTemplateIds.has(item.shift_template_id)) reasons.push("geçersiz vardiya şablonu");
      const workDate = new Date(item.work_date);
      if (isNaN(workDate.getTime()) || workDate < weekStartDate || workDate > weekEndDate)
        reasons.push("hafta dışı tarih");
      if (existingSet.has(key)) reasons.push("zaten atanmış");
      if (seenInDraft.has(key)) reasons.push("taslakta tekrar");
      const leaves = leaveMap[item.user_id] ?? [];
      if (leaves.some((l) => item.work_date >= l.start && item.work_date <= l.end))
        reasons.push("izinli olduğu tarih");

      if (reasons.length === 0) {
        validated.push(item);
        seenInDraft.add(key);
      } else {
        rejected.push({ ...item, reasons });
      }
    }

    // 4) Doğrulanmış vardiyaları TASLAK (kilitsiz, source=ai_agent) olarak ekle
    if (validated.length > 0) {
      const rows = validated.map((v) => ({
        company_id,
        branch_id,
        user_id: v.user_id,
        shift_template_id: v.shift_template_id,
        work_date: v.work_date,
        source: "ai_agent",
        is_locked: false,
      }));
      const { error: insertError } = await supabase.from("shift_assignments").insert(rows);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted_count: validated.length,
        rejected_count: rejected.length,
        rejected_details: rejected,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Shift agent error:", e);
    const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});