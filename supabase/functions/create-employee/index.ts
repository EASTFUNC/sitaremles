import { createClient } from "npm:@supabase/supabase-js@2";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization")!;

    // 1) Çağıranın kim olduğunu, normal (anon key + kullanıcı token'ı) client ile doğrula
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Kimlik doğrulanamadı");

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("company_id")
      .eq("id", caller.id)
      .single();

    const { data: isCompanyAdmin } = await callerClient.rpc("has_any_role", {
      p_company_id: callerProfile?.company_id,
      p_role_codes: ["company_admin"],
    });

    if (!isCompanyAdmin) {
      throw new Error("Bu islem icin sirket admini olmaniz gerekiyor");
    }

    // 2) İstek gövdesini oku
    const body = await req.json();
    const {
      email, full_name, branch_id, role_code,
      tc_kimlik_no, birth_date, address, contract_type,
      blood_type, emergency_contact_name, emergency_contact_phone,
    } = body;

    if (!email || !full_name || !role_code) {
      throw new Error("E-posta, ad soyad ve rol zorunlu");
    }

    // 3) YÖNETİCİ YETKİLİ client ile (service role) yeni hesabı oluştur
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tempPassword = generateTempPassword();

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (createError) throw createError;

    const newUserId = newUser.user.id;

    // 4) Profil oluştur
    const { error: profileError } = await adminClient.from("profiles").insert({
      id: newUserId,
      company_id: callerProfile?.company_id,
      branch_id: branch_id ?? null,
      full_name,
    });
    if (profileError) throw profileError;

    // 5) Rol ata
    const { data: roleRow } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", role_code)
      .single();

    await adminClient.from("user_roles").insert({
      user_id: newUserId,
      company_id: callerProfile?.company_id,
      role_id: roleRow?.id,
    });

    // 6) Özlük bilgileri verildiyse ekle
    if (tc_kimlik_no) {
      const { error: legalError } = await adminClient.from("employee_legal_details").insert({
        user_id: newUserId,
        company_id: callerProfile?.company_id,
        tc_kimlik_no,
        birth_date: birth_date || null,
        address: address || null,
        contract_type: contract_type || "belirsiz_sureli",
        blood_type: blood_type || null,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
      });
      if (legalError) throw legalError;
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId, temp_password: tempPassword }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});