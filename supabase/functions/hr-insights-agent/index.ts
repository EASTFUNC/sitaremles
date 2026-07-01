Deno.serve(async (req) => {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiApiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY tanımlı değil" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const model = "gemini-2.5-flash";

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Merhaba, sen SITAREMLES adlı bir İK yazılımının test asistanısın. Sadece 'Bağlantı başarılı' yaz." }] }],
      }),
    }
  );

  const data = await geminiResponse.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Cevap alınamadı";

  return new Response(JSON.stringify({ success: true, model, reply: text }), {
    headers: { "Content-Type": "application/json" },
  });
});