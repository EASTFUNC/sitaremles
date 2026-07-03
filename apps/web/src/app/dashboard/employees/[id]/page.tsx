import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { IdCard, FileText } from "lucide-react";
import DocumentUploadRow from "@/components/DocumentUploadRow";

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

  const signedUrls: Record<string, string | null> = {};
  if (uploadedDocs && uploadedDocs.length > 0) {
    await Promise.all(
      uploadedDocs.map(async (d) => {
        const { data } = await supabase.storage.from("employee-documents").createSignedUrl(d.file_path, 300);
        signedUrls[d.document_type_id] = data?.signedUrl ?? null;
      })
    );
  }

  const statusLabels: Record<string, string> = {
    application: "Başvuru",
    onboarding: "İşe Alım Süreci",
    active: "Çalışıyor",
    on_leave: "İzinli",
    terminated: "Ayrıldı",
    blacklisted: "Kara Liste",
  };

  async function updateStatus(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    await supabase.from("profiles").update({ status: formData.get("status") as string }).eq("id", id);
    revalidatePath(`/dashboard/employees/${id}`);
  }

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

    const { data: existing } = await supabase
      .from("employee_documents")
      .select("id, file_path")
      .eq("user_id", id)
      .eq("document_type_id", documentTypeId)
      .maybeSingle();

    if (existing) {
      await supabase.storage.from("employee-documents").remove([existing.file_path]);
      await supabase.from("employee_documents").delete().eq("id", existing.id);
    }

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

  async function deleteDocument(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const docId = formData.get("doc_id") as string;
    const filePath = formData.get("file_path") as string;

    await supabase.storage.from("employee-documents").remove([filePath]);
    await supabase.from("employee_documents").delete().eq("id", docId);

    revalidatePath(`/dashboard/employees/${id}`);
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", fontFamily: "var(--font-body)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={avatarStyle}>
          <IdCard size={18} color="var(--accent)" strokeWidth={1.75} />
        </div>
        <div>
          <h1 style={{ marginBottom: 2 }}>{employee?.full_name}</h1>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Özlük Dosyası
          </span>
        </div>
      </div>

      {isAdmin && (
        <form action={updateStatus} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Çalışma Durumu:</span>
          <select name="status" defaultValue={employee?.status} style={{ ...inputStyle, width: "auto", marginTop: 0 }}>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="submit" style={smallButtonStyle}>Güncelle</button>
        </form>
      )}

      {isAdmin ? (
        <div style={sectionCardStyle}>
          <h3 style={{ marginTop: 0, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <IdCard size={15} strokeWidth={1.75} color="var(--accent)" />
            Özlük Bilgileri
          </h3>
          <form action={saveLegalDetails} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
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
        </div>
      ) : (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          T.C. Kimlik ve özlük detaylarını yalnızca şirket admini görüntüleyebilir.
        </p>
      )}

      <h3 style={{ marginTop: 28, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <FileText size={15} strokeWidth={1.75} color="var(--accent)" />
        İşe Alım Belgeleri
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {documentTypes?.map((dt) => (
          <DocumentUploadRow
            key={dt.id}
            documentTypeId={dt.id}
            name={dt.name}
            isRequired={dt.is_required}
            uploadedAt={uploadedMap[dt.id]?.uploaded_at ?? null}
            viewUrl={signedUrls[dt.id] ?? null}
            docId={uploadedMap[dt.id]?.id ?? null}
            filePath={uploadedMap[dt.id]?.file_path ?? null}
            isAdmin={!!isAdmin}
            action={uploadDocument}
            onDelete={deleteDocument}
          />
        ))}
      </div>
    </div>
  );
}

function Field({ label, name, defaultValue, type = "text", span2 = false }: any) {
  return (
    <label style={{ fontSize: 12.5, color: "var(--text-secondary)", gridColumn: span2 ? "1 / -1" : "auto" }}>
      {label}
      <input type={type} name={name} defaultValue={defaultValue ?? ""} style={inputStyle} />
    </label>
  );
}

const avatarStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: "color-mix(in srgb, var(--accent) 15%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const sectionCardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "var(--bg-elevated)",
};
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 8,
  marginTop: 4,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 13,
};
const saveButtonStyle: React.CSSProperties = {
  padding: "9px 22px",
  background: "var(--accent)",
  color: "var(--accent-contrast)",
  border: "none",
  borderRadius: 8,
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};
const smallButtonStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  fontSize: 12,
  cursor: "pointer",
};