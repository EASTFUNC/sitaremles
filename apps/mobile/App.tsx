import { useEffect, useState } from "react";
import { View, Text, TextInput, Button, FlatList, StyleSheet, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!session) {
    return <LoginScreen />;
  }
  return <MainTabs />;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SITAREMLES GiriÅŸ</Text>
      <TextInput
        style={styles.input}
        placeholder="E-posta"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Åifre"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      <Button title="GiriÅŸ Yap" onPress={handleLogin} />
    </View>
  );
}
function MainTabs() {
  const [tab, setTab] = useState<"shifts" | "checkin" | "leave">("checkin");
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === "shifts" && <WeeklyShiftsScreen />}
        {tab === "checkin" && <CheckInScreen />}
        {tab === "leave" && <LeaveRequestScreen />}
      </View>
      <View style={styles.tabBar}>
        <Button title="Giriş-Çıkış" onPress={() => setTab("checkin")} />
        <Button title="Vardiyam" onPress={() => setTab("shifts")} />
        <Button title="İzinlerim" onPress={() => setTab("leave")} />
      </View>
    </View>
  );
}

function CheckInScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleScan({ data }: { data: string }) {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    setResult("");

    try {
      const payload = JSON.parse(data);
      const branchId = payload.branch_id;
      if (!branchId) throw new Error("QR kod geçerli bir şube içermiyor.");

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Konum izni verilmedi.");

      const loc = await Location.getCurrentPositionAsync({});

      const { data: rpcResult, error } = await supabase.rpc("record_attendance", {
        p_branch_id: branchId,
        p_event_type: "check_in",
        p_latitude: loc.coords.latitude,
        p_longitude: loc.coords.longitude,
        p_qr_payload: data,
      });

      if (error) throw error;

      if (rpcResult.within_geofence) {
        setResult(`Giriş kaydedildi. Şubeye mesafe: ${rpcResult.distance_m} metre.`);
      } else {
        setResult(`Uyarı: Şube dışından giriş algılandı (mesafe: ${rpcResult.distance_m} metre). Kayıt oluşturuldu, yönetici bilgilendirilecek.`);
      }
    } catch (e: any) {
      setResult(`Hata: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (!permission) {
    return <View style={styles.container}><Text>Kamera izni kontrol ediliyor...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Kamera İzni Gerekli</Text>
        <Button title="İzin Ver" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {!scanned ? (
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleScan}
        />
      ) : (
        <View style={styles.container}>
          <Text style={styles.title}>{loading ? "Ä°ÅŸleniyor..." : "SonuÃ§"}</Text>
          <Text style={{ marginBottom: 20 }}>{result}</Text>
          <Button
            title="Tekrar Okut"
            onPress={() => {
              setScanned(false);
              setResult("");
            }}
          />
        </View>
      )}
    </View>
  );
}
function LeaveRequestScreen() {
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [balances, setBalances] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();

    const { data: types } = await supabase
      .from("leave_types")
      .select("id, name")
      .eq("company_id", profile?.company_id);

    const { data: requests } = await supabase
      .from("leave_requests")
      .select("id, start_date, end_date, status, leave_types(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setLeaveTypes(types ?? []);
    const { data: balanceData } = await supabase.rpc("get_leave_balances", { p_user_id: userId });
    setBalances(balanceData ?? []);
    setMyRequests(requests ?? []);
    if (types && types.length > 0) setSelectedTypeId(types[0].id);
    setLoading(false);
  }

  async function submitRequest() {
    setMessage("");
    if (!selectedTypeId || !startDate || !endDate) {
      setMessage("Lütfen tüm alanları doldurun (tarih formatı: YYYY-AA-GG, örn. 2026-07-15).");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .single();

    const { error } = await supabase.from("leave_requests").insert({
      company_id: profile?.company_id,
      user_id: userId,
      leave_type_id: selectedTypeId,
      start_date: startDate,
      end_date: endDate,
    });

    if (error) {
      setMessage(`Hata: ${error.message}`);
    } else {
      setMessage("Talep gönderildi.");
      setStartDate("");
      setEndDate("");
      loadData();
    }
  }

  if (loading) {
    return <View style={styles.container}><Text>Yükleniyor...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>İzin Talebi Oluştur</Text>
      <View style={{ marginBottom: 16 }}>
        {balances.map((b) => (
          <Text key={b.leave_type_id}>
            {b.leave_type_name}: {b.remaining_days} / {b.entitled_days} gün kaldı
          </Text>
        ))}
      </View>

      <Text>İzin Türü:</Text>
      {leaveTypes.map((t) => (
        <Button
          key={t.id}
          title={selectedTypeId === t.id ? `✓ ${t.name}` : t.name}
          onPress={() => setSelectedTypeId(t.id)}
        />
      ))}

      <TextInput
        style={styles.input}
        placeholder="Başlangıç Tarihi (2026-07-15)"
        value={startDate}
        onChangeText={setStartDate}
      />
      <TextInput
        style={styles.input}
        placeholder="Bitiş Tarihi (2026-07-18)"
        value={endDate}
        onChangeText={setEndDate}
      />

      <Button title="Talep Gönder" onPress={submitRequest} />
      {message ? <Text style={{ marginVertical: 10 }}>{message}</Text> : null}

      <Text style={[styles.title, { fontSize: 18, marginTop: 30 }]}>Taleplerim</Text>
      <FlatList
        data={myRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardDate}>{item.leave_types?.name}</Text>
            <Text>{item.start_date} → {item.end_date}</Text>
            <Text>
              Durum: {item.status === "pending" ? "Beklemede" : item.status === "approved" ? "Onaylandı" : "Reddedildi"}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text>Henüz talebiniz yok.</Text>}
      />
    </View>
  );
}
function WeeklyShiftsScreen() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShifts();
  }, []);

  async function loadShifts() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { data, error } = await supabase
      .from("shift_assignments")
      .select("id, work_date, branches(name), shift_templates(name, start_time, end_time)")
      .eq("user_id", userId)
      .order("work_date", { ascending: true });

    if (error) console.log("Hata:", error.message);
    setShifts(data ?? []);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>HaftalÄ±k Vardiyam</Text>
      {loading ? (
        <Text>YÃ¼kleniyor...</Text>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardDate}>{item.work_date}</Text>
              <Text>Åube: {item.branches?.name}</Text>
              <Text>
                {item.shift_templates?.name} ({item.shift_templates?.start_time} - {item.shift_templates?.end_time})
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text>HenÃ¼z vardiya atamasÄ± yok.</Text>}
        />
      )}
      <Button title="Ã‡Ä±kÄ±ÅŸ Yap" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 12, borderRadius: 6 },
  card: { padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 10 },
  cardDate: { fontWeight: "bold", marginBottom: 4 },
  tabBar: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#ddd" },
});