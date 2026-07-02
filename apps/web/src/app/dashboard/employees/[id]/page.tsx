import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data: isAdmin } = await supabase.rpc("has_any_role", {
    p_company_id: adminProfile?.company_id,
    p_role_codes: ["company_admin"],
  });

  const { data: employee } = await supabase
    .from("profiles")
    .select("id, full_name, employee_code, phone, hire_date, status")
    .eq("id", id)
    .single();

  const { data: legalDetails } = isAdmin
    ? await supabase.from("employee_legal_details").select("*").eq("user_id", id).maybeSingle()
    : { data: null };

  const { data: documentTypes } = await supabase
    .from("document_types")
    .select("id, name, is_required")
    .eq("company_id", adminProfile?.company_id)
    .eq("is_active", true)
    .order("sort_order");

  const { data: uploadedDocs } = await supabase
    .from("employee_documents")
    .select("id, document_type_id, file_path, uploaded_at")
    .eq("user_id", id);

  const uploadedMap: Record<string, any> = {};
  uploadedDocs?.forEach((d) => (uploadedMap[d.document_type_id] = d));

  async function saveLegalDetails(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    await supabase.from("employee_legal_details").upsert({
      user_id: id,
      company_id: adminProfile?.company_id,
      tc_kimlik_no: formData.get("tc_kimlik_no") as string,
      birth_date: (formData.get("birth_date") as string) || null,
      address: (formData.get("address") as string) || null,
      contract_type: formData.get("contract_type") as string,
      blood_type: (formData.get("blood_type") as string) || null,
      emergency_contact_name: (formData.get("emergency_contact_name") as string) || null,
      emergency_contact_phone: (formData.get("emergency_contact_phone") as string) || null,
    });

    revalidatePath(`/dashboard/employees/${id}`);
  }

  async function uploadDocument(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    const file = formData.get("file") as File;
    const documentTypeId = formData.get("document_type_id") as string;
    if (!file || file.size === 0) return;

    const filePath = `${id}/${documentTypeId}_${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("employee-documents")
      .upload(filePath, file);

    if (!uploadError) {
      await supabase.from("employee_documents").insert({
        company_id: adminProfile?.company_id,
        user_id: id,
        document_type_id: documentTypeId,
        file_path: filePath,
        uploaded_by: user.id,
      });
    }

    revalidatePath(`/dashboard/employees/${id}`);
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <h1>{employee?.full_name} — Özlük Dosyası</h1>

      {isAdmin ? (
        <form
          action={saveLegalDetails}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            padding: 20,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--bg-elevated)",
            marginBottom: 24,
          }}
        >
          <h3 style={{ gridColumn: "1 / -1", marginTop: 0 }}>Özlük Bilgileri</h3>
          <Field label="T.C. Kimlik No" name="tc_kimlik_no" defaultValue={legalDetails?.tc_kimlik_no} />
          <Field label="Doğum Tarihi" name="birth_date" type="date" defaultValue={legalDetails?.birth_date} />
          <Field label="Adres" name="address" defaultValue={legalDetails?.address} span2 />
          <Field label="Sözleşme Tipi" name="contract_type" defaultValue={legalDetails?.contract_type ?? "belirsiz_sureli"} />
          <Field label="Kan Grubu" name="blood_type" defaultValue={legalDetails?.blood_type} />
          <Field label="Acil Durum Kişisi" name="emergency_contact_name" defaultValue={legalDetails?.emergency_contact_name} />
          <Field label="Acil Durum Telefonu" name="emergency_contact_phone" defaultValue={legalDetails?.emergency_contact_phone} />
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" style={saveButtonStyle}>Özlük Bilgilerini Kaydet</button>
          </div>
        </form>
      ) : (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          T.C. Kimlik ve özlük detaylarını yalnızca şirket admini görüntüleyebilir.
        </p>
      )}

      <h3>İşe Alım Belgeleri</h3>
      {documentTypes?.map((dt) => {
        const uploaded = uploadedMap[dt.id];
        return (
          <div
            key={dt.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 12,
              border: "1px solid var(--border)",
              borderRadius: 8,
              marginBottom: 8,
              background: "var(--bg-elevated)",
            }}
          >
            <div>
              <strong>{dt.name}</strong>{" "}
              {dt.is_required && <span style={{ color: "#D64545", fontSize: 12 }}>(Zorunlu)</span>}
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {uploaded ? `Yüklendi: ${new Date(uploaded.uploaded_at).toLocaleDateString("tr-TR")}` : "Henüz yüklenmedi"}
              </div>
            </div>
            <form action={uploadDocument} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="hidden" name="document_type_id" value={dt.id} />
              <input type="file" name="file" style={{ fontSize: 12 }} />
              <button type="submit" style={{ padding: "6px 12px", fontSize: 12 }}>
                Yükle
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text", span2 = false }: any) {
  return (
    <label style={{ fontSize: 13, color: "var(--text-secondary)", gridColumn: span2 ? "1 / -1" : "auto" }}>
      {label}
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        style={{
          display: "block",
          width: "100%",
          padding: 8,
          marginTop: 4,
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--text)",
        }}
      />
    </label>
  );
}

const saveButtonStyle: React.CSSProperties = {
  padding: "10px 24px",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  border: "none",
  borderRadius: 8,
  fontWeight: 500,
  cursor: "pointer",
};