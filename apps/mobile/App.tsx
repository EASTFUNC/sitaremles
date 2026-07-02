import { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, ScrollView, Pressable } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useFonts } from "expo-font";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "./lib/supabase";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";
import type { ThemeColors } from "./lib/theme";
import AppButton from "./components/AppButton";
import type { Session } from "@supabase/supabase-js";

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    IBMPlexMono_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthGate />
    </ThemeProvider>
  );
}

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!checked) return null;
  if (!session) return <LoginScreen />;
  return <MainTabs />;
}

function LoginScreen() {
  const { colors, mode, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", paddingHorizontal: 24 }}>
      <Pressable
        onPress={toggleTheme}
        style={{ position: "absolute", top: 60, right: 24, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
      >
        <Ionicons name={mode === "light" ? "moon-outline" : "sunny-outline"} size={16} color={colors.text} />
      </Pressable>

      <Text style={{ fontFamily: "SpaceGrotesk_700Bold", fontSize: 30, color: colors.text, marginBottom: 6 }}>
        SITAREMLES
      </Text>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: colors.textSecondary, marginBottom: 32 }}>
        Doğrulanmış operasyon yönetimi
      </Text>

      <TextInput
        placeholder="E-posta"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgElevated,
          color: colors.text,
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
          fontFamily: "Inter_400Regular",
        }}
      />
      <TextInput
        placeholder="Şifre"
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgElevated,
          color: colors.text,
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
          fontFamily: "Inter_400Regular",
        }}
      />

      {error ? <Text style={{ color: "#D64545", marginBottom: 12, fontFamily: "Inter_400Regular" }}>{error}</Text> : null}

      <AppButton title="Giriş Yap" onPress={handleLogin} loading={loading} />
    </View>
  );
}

function MainTabs() {
  const { colors, mode, toggleTheme } = useTheme();
  const [tab, setTab] = useState<"home" | "checkin" | "shifts" | "leave" | "expense" | "tasks" | "payroll" | "notifications">("home");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const tabs: { key: typeof tab; label: string; icon: any }[] = [
    { key: "home", label: "Ana Sayfa", icon: "home-outline" },
    { key: "checkin", label: "Giriş-Çıkış", icon: "location-outline" },
    { key: "shifts", label: "Vardiyam", icon: "calendar-outline" },
    { key: "leave", label: "İzinlerim", icon: "document-text-outline" },
    { key: "expense", label: "Avans", icon: "card-outline" },
    { key: "tasks", label: "Görevlerim", icon: "checkbox-outline" },
    { key: "payroll", label: "Bordrom", icon: "receipt-outline" },
  ];

  const currentLabel = tab === "notifications" ? "Bildirimler" : tabs.find((t) => t.key === tab)?.label ?? "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 50,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.bgElevated,
        }}
      >
        <Pressable onPress={() => setDrawerOpen(true)} hitSlop={10}>
          <Ionicons name="menu-outline" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 16, color: colors.text }}>
          {currentLabel}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Pressable onPress={() => setTab("notifications")} hitSlop={10}>
            <NotificationBellButton colors={colors} />
          </Pressable>
          <Pressable onPress={toggleTheme} hitSlop={10}>
            <Ionicons name={mode === "light" ? "moon-outline" : "sunny-outline"} size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "home" && <HomeScreen />}
        {tab === "checkin" && <CheckInScreen />}
        {tab === "shifts" && <WeeklyShiftsScreen />}
        {tab === "leave" && <LeaveRequestScreen />}
        {tab === "expense" && <ExpenseRequestScreen />}
        {tab === "tasks" && <TasksScreen />}
        {tab === "payroll" && <PayrollScreen />}
        {tab === "notifications" && <NotificationsScreen />}
      </View>

      {drawerOpen && (
        <>
          <Pressable
            onPress={() => setDrawerOpen(false)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
          />
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: 240,
              backgroundColor: colors.bgElevated,
              borderRightWidth: 1,
              borderRightColor: colors.border,
              paddingTop: 60,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ fontFamily: "SpaceGrotesk_700Bold", fontSize: 18, color: colors.text, paddingHorizontal: 8, marginBottom: 20 }}>
              SITAREMLES
            </Text>
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    setTab(t.key);
                    setDrawerOpen(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: active ? colors.accent : "transparent",
                    marginBottom: 4,
                  }}
                >
                  <Ionicons name={t.icon} size={18} color={active ? colors.accentContrast : colors.text} />
                  <Text style={{ color: active ? colors.accentContrast : colors.text, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function CheckInScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();
  const styles = createStyles(colors);

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
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.text, fontFamily: "Inter_400Regular" }}>Kamera izni kontrol ediliyor...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Kamera İzni Gerekli</Text>
        <AppButton title="İzin Ver" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {!scanned ? (
        <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handleScan} />
      ) : (
        <View style={styles.container}>
          <Text style={styles.title}>{loading ? "İşleniyor..." : "Sonuç"}</Text>
          <View style={styles.card}>
            <Text style={{ color: colors.text, fontFamily: "Inter_400Regular", lineHeight: 20 }}>{result}</Text>
          </View>
          <AppButton title="Tekrar Okut" onPress={() => { setScanned(false); setResult(""); }} variant="secondary" />
        </View>
      )}
    </View>
  );
}
function HomeScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, company_id")
      .eq("id", userId)
      .single();
    setFullName(profile?.full_name ?? "");

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("roles(code)")
      .eq("user_id", userId)
      .eq("company_id", profile?.company_id);
    const roleCodes = (rolesData ?? []).map((r: any) => r.roles?.code);
    const managerRoles = ["company_admin", "store_manager", "regional_manager"];
    const managerFlag = roleCodes.some((r: string) => managerRoles.includes(r));
    setIsManager(managerFlag);

    if (managerFlag) {
      const { count: employeeCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", profile?.company_id);

      const todayStart = new Date().toISOString().slice(0, 10);
      const { data: todayCheckins } = await supabase
        .from("attendance_logs")
        .select("user_id")
        .eq("company_id", profile?.company_id)
        .eq("event_type", "check_in")
        .gte("event_time", todayStart);
      const activeToday = new Set((todayCheckins ?? []).map((c: any) => c.user_id)).size;

      const { count: pendingLeave } = await supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", profile?.company_id)
        .eq("status", "pending");

      const { count: pendingTasks } = await supabase
        .from("task_assignments")
        .select("id", { count: "exact", head: true })
        .eq("company_id", profile?.company_id)
        .neq("status", "completed");

      setStats({ employeeCount: employeeCount ?? 0, activeToday, pendingLeave: pendingLeave ?? 0, pendingTasks: pendingTasks ?? 0 });
    } else {
      const periodStart = new Date().toISOString().slice(0, 7) + "-01";
      const { data: balanceData } = await supabase.rpc("get_leave_balances", { p_user_id: userId });
      const remainingTotal = (balanceData ?? []).reduce((sum: number, b: any) => sum + (b.remaining_days ?? 0), 0);

      const { data: checkins } = await supabase
        .from("attendance_logs")
        .select("event_time")
        .eq("user_id", userId)
        .eq("event_type", "check_in")
        .gte("event_time", periodStart);
      const workedDays = new Set((checkins ?? []).map((c: any) => c.event_time.slice(0, 10))).size;

      const { count: pendingTasks } = await supabase
        .from("task_assignments")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .neq("status", "completed");

      setStats({ workedDays, remainingTotal, pendingTasks: pendingTasks ?? 0 });
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 }}>Hoş geldin,</Text>
      <Text style={styles.title}>{fullName}</Text>

      {isManager ? (
        <View style={homeStyles.grid}>
          <StatCard colors={colors} icon="people-outline" label="Toplam Personel" value={stats.employeeCount} />
          <StatCard colors={colors} icon="checkmark-circle-outline" label="Bugün Aktif" value={stats.activeToday} accent={colors.success} />
          <StatCard colors={colors} icon="document-text-outline" label="Bekleyen İzin Talebi" value={stats.pendingLeave} />
          <StatCard colors={colors} icon="checkbox-outline" label="Bekleyen Görev" value={stats.pendingTasks} />
        </View>
      ) : (
        <View style={homeStyles.grid}>
          <StatCard colors={colors} icon="calendar-outline" label="Bu Ay Çalışılan Gün" value={stats.workedDays} />
          <StatCard colors={colors} icon="document-text-outline" label="Kalan İzin (Toplam)" value={stats.remainingTotal} accent={colors.success} />
          <StatCard colors={colors} icon="checkbox-outline" label="Bekleyen Görevin" value={stats.pendingTasks} />
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatCard({ colors, icon, label, value, accent }: { colors: ThemeColors; icon: any; label: string; value: number | undefined; accent?: string }) {
  return (
    <View style={[homeStyles.card, { borderColor: colors.border, backgroundColor: colors.bgElevated }]}>
      <Ionicons name={icon} size={20} color={accent ?? colors.accent} />
      <Text style={{ fontFamily: "IBMPlexMono_400Regular", fontSize: 26, color: colors.text, marginTop: 10 }}>
        {value ?? 0}
      </Text>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

const homeStyles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 24 },
  card: { width: "47%", borderWidth: 1, borderRadius: 14, padding: 16 },
});
function NotificationBellButton({ colors }: { colors: ThemeColors }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .eq("is_read", false);
    setUnreadCount(count ?? 0);
  }

  return (
    <View style={{ position: "relative" }}>
      <Ionicons name="notifications-outline" size={18} color={colors.text} />
      {unreadCount > 0 && (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -6,
            backgroundColor: "#D64545",
            borderRadius: 8,
            minWidth: 16,
            height: 16,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: "white", fontSize: 9, fontFamily: "Inter_600SemiBold" }}>{unreadCount}</Text>
        </View>
      )}
    </View>
  );
}

function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, is_read, created_at")
      .eq("user_id", userData.user?.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications(data ?? []);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bildirimler</Text>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => !item.is_read && markAsRead(item.id)} style={styles.card}>
            <Text style={[styles.cardTitle, !item.is_read && { color: colors.accent }]}>{item.title}</Text>
            <Text style={styles.cardText}>{item.body}</Text>
            <Text style={{ fontSize: 10, color: colors.textSecondary, fontFamily: "IBMPlexMono_400Regular", marginTop: 4 }}>
              {new Date(item.created_at).toLocaleString("tr-TR")}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Henüz bildirim yok.</Text>}
      />
    </View>
  );
}
function WeeklyShiftsScreen() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const styles = createStyles(colors);

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
      <Text style={styles.title}>Haftalık Vardiyam</Text>
      {loading ? (
        <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.work_date}</Text>
              <Text style={styles.cardText}>Şube: {item.branches?.name}</Text>
              <Text style={styles.cardText}>
                {item.shift_templates?.name} ({item.shift_templates?.start_time} - {item.shift_templates?.end_time})
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Henüz vardiya ataması yok.</Text>}
        />
      )}
      <AppButton title="Çıkış Yap" onPress={() => supabase.auth.signOut()} variant="secondary" />
    </View>
  );
}

function LeaveRequestScreen() {
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const { colors } = useTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", userId).single();
    const { data: types } = await supabase.from("leave_types").select("id, name").eq("company_id", profile?.company_id);
    const { data: balanceData } = await supabase.rpc("get_leave_balances", { p_user_id: userId });
    setBalances(balanceData ?? []);
    const { data: requests } = await supabase
      .from("leave_requests")
      .select("id, start_date, end_date, status, leave_types(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setLeaveTypes(types ?? []);
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
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", userId).single();
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

  function statusBadge(status: string) {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: "Beklemede", color: colors.accent },
      approved: { label: "Onaylandı", color: colors.success },
      rejected: { label: "Reddedildi", color: "#D64545" },
    };
    const s = map[status] ?? map.pending;
    return (
      <View style={[styles.badge, { backgroundColor: `${s.color}22` }]}>
        <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>İzin Talebi Oluştur</Text>

      <View style={{ marginBottom: 8 }}>
        {balances.map((b) => (
          <Text key={b.leave_type_id} style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 2 }}>
            {b.leave_type_name}: {b.remaining_days} / {b.entitled_days} gün kaldı
          </Text>
        ))}
      </View>

      <Text style={styles.label}>İzin Türü</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {leaveTypes.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setSelectedTypeId(t.id)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: selectedTypeId === t.id ? colors.accent : colors.border,
              backgroundColor: selectedTypeId === t.id ? colors.accent : "transparent",
            }}
          >
            <Text style={{ color: selectedTypeId === t.id ? colors.accentContrast : colors.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {t.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Başlangıç Tarihi</Text>
      <TextInput style={styles.input} placeholder="2026-07-15" placeholderTextColor={colors.textSecondary} value={startDate} onChangeText={setStartDate} />
      <Text style={styles.label}>Bitiş Tarihi</Text>
      <TextInput style={styles.input} placeholder="2026-07-18" placeholderTextColor={colors.textSecondary} value={endDate} onChangeText={setEndDate} />

      <AppButton title="Talep Gönder" onPress={submitRequest} />
      {message ? <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 10 }}>{message}</Text> : null}

      <Text style={styles.subtitle}>Taleplerim</Text>
      {myRequests.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.leave_types?.name}</Text>
          <Text style={styles.cardText}>{item.start_date} → {item.end_date}</Text>
          {statusBadge(item.status)}
        </View>
      ))}
      {myRequests.length === 0 && <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Henüz talebiniz yok.</Text>}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function ExpenseRequestScreen() {
  const [requestType, setRequestType] = useState<"advance" | "expense">("advance");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const { data: userData } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("expense_requests")
      .select("id, request_type, amount, description, status, created_at")
      .eq("user_id", userData.user?.id)
      .order("created_at", { ascending: false });
    setMyRequests(data ?? []);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function submitRequest() {
    setMessage("");
    if (!amount) {
      setMessage("Lütfen tutar girin.");
      return;
    }
    setUploading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", userId).single();
    let receiptUrl: string | null = null;

    if (imageUri) {
      const fileName = `${userId}_${Date.now()}.jpg`;
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage.from("receipts").upload(fileName, blob, { contentType: "image/jpeg" });
      if (uploadError) {
        setMessage(`Fotoğraf yüklenemedi: ${uploadError.message}`);
        setUploading(false);
        return;
      }
      receiptUrl = fileName;
    }

    const { error } = await supabase.from("expense_requests").insert({
      company_id: profile?.company_id,
      user_id: userId,
      request_type: requestType,
      amount: Number(amount),
      description,
      receipt_url: receiptUrl,
    });

    setUploading(false);

    if (error) {
      setMessage(`Hata: ${error.message}`);
    } else {
      setMessage("Talep gönderildi.");
      setAmount("");
      setDescription("");
      setImageUri(null);
      loadRequests();
    }
  }

  function statusBadge(status: string) {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: "Beklemede", color: colors.accent },
      approved: { label: "Onaylandı", color: colors.success },
      rejected: { label: "Reddedildi", color: "#D64545" },
    };
    const s = map[status] ?? map.pending;
    return (
      <View style={[styles.badge, { backgroundColor: `${s.color}22` }]}>
        <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Avans / Masraf Talebi</Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {(["advance", "expense"] as const).map((type) => (
          <Pressable
            key={type}
            onPress={() => setRequestType(type)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: requestType === type ? colors.accent : colors.border,
              backgroundColor: requestType === type ? colors.accent : "transparent",
            }}
          >
            <Text style={{ color: requestType === type ? colors.accentContrast : colors.text, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {type === "advance" ? "Avans" : "Masraf"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Tutar (₺)</Text>
      <TextInput style={styles.input} placeholder="0" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={amount} onChangeText={setAmount} />
      <Text style={styles.label}>Açıklama</Text>
      <TextInput style={styles.input} placeholder="Örn. Yemek" placeholderTextColor={colors.textSecondary} value={description} onChangeText={setDescription} />

      <AppButton title={imageUri ? "Fiş Seçildi ✓" : "Fiş Fotoğrafı Seç"} onPress={pickImage} variant="secondary" />
      <AppButton title={uploading ? "Gönderiliyor..." : "Talep Gönder"} onPress={submitRequest} disabled={uploading} />

      {message ? <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 10 }}>{message}</Text> : null}

      <Text style={styles.subtitle}>Taleplerim</Text>
      {myRequests.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.request_type === "advance" ? "Avans" : "Masraf"}: {item.amount} ₺</Text>
          <Text style={styles.cardText}>{item.description}</Text>
          {statusBadge(item.status)}
        </View>
      ))}
      {myRequests.length === 0 && <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Henüz talebiniz yok.</Text>}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function TasksScreen() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("task_assignments")
      .select("id, due_date, status, checklist_template_id, checklist_templates(title), branches(name)")
      .eq("assigned_to", userData.user?.id)
      .order("due_date", { ascending: true });
    setTasks(data ?? []);
    setLoading(false);
  }

  async function openTask(task: any) {
    setSelectedTask(task);
    const { data: itemsData } = await supabase
      .from("checklist_items")
      .select("id, label, sort_order")
      .eq("checklist_template_id", task.checklist_template_id)
      .order("sort_order", { ascending: true });
    setItems(itemsData ?? []);
    const { data: existingResults } = await supabase
      .from("task_item_results")
      .select("checklist_item_id, is_checked")
      .eq("task_assignment_id", task.id);
    const resultMap: Record<string, boolean> = {};
    existingResults?.forEach((r) => (resultMap[r.checklist_item_id] = r.is_checked));
    setResults(resultMap);
  }

  async function toggleItem(itemId: string) {
    const newValue = !results[itemId];
    setResults({ ...results, [itemId]: newValue });
    const { data: existing } = await supabase
      .from("task_item_results")
      .select("id")
      .eq("task_assignment_id", selectedTask.id)
      .eq("checklist_item_id", itemId)
      .maybeSingle();
    if (existing) {
      await supabase.from("task_item_results").update({ is_checked: newValue }).eq("id", existing.id);
    } else {
      await supabase.from("task_item_results").insert({ task_assignment_id: selectedTask.id, checklist_item_id: itemId, is_checked: newValue });
    }
  }

  async function completeTask() {
    await supabase.from("task_assignments").update({ status: "completed" }).eq("id", selectedTask.id);
    setSelectedTask(null);
    loadTasks();
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Yükleniyor...</Text>
      </View>
    );
  }

  if (selectedTask) {
    const allChecked = items.length > 0 && items.every((i) => results[i.id]);
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{selectedTask.checklist_templates?.title}</Text>
        {items.map((item) => (
          <Pressable key={item.id} onPress={() => toggleItem(item.id)} style={[styles.card, { flexDirection: "row", alignItems: "center", gap: 10 }]}>
            <Ionicons name={results[item.id] ? "checkbox" : "square-outline"} size={20} color={results[item.id] ? colors.success : colors.textSecondary} />
            <Text style={{ color: colors.text, fontFamily: "Inter_400Regular", flex: 1 }}>{item.label}</Text>
          </Pressable>
        ))}
        <AppButton title="Görevi Tamamla" onPress={completeTask} disabled={!allChecked} />
        <AppButton title="Geri Dön" onPress={() => setSelectedTask(null)} variant="secondary" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Görevlerim</Text>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.checklist_templates?.title}</Text>
            <Text style={styles.cardText}>Şube: {item.branches?.name} — Son Tarih: {item.due_date}</Text>
            <Text style={styles.cardText}>
              Durum: {item.status === "pending" ? "Beklemede" : item.status === "completed" ? "Tamamlandı" : "Devam Ediyor"}
            </Text>
            {item.status !== "completed" && (
              <View style={{ marginTop: 8 }}>
                <AppButton title="Aç" onPress={() => openTask(item)} variant="secondary" />
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Henüz görev atanmadı.</Text>}
      />
    </View>
  );
}

function PayrollScreen() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("payroll_approvals")
      .select("id, period, status, approved_at")
      .eq("user_id", userData.user?.id)
      .order("period", { ascending: false });
    setRecords(data ?? []);
    setLoading(false);
  }

  async function approveRecord(id: string) {
    await supabase.from("payroll_approvals").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", id);
    loadRecords();
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bordro / Puantaj Onayı</Text>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.period}</Text>
            <Text style={styles.cardText}>
              Durum: {item.status === "approved" ? `Onaylandı (${new Date(item.approved_at).toLocaleDateString("tr-TR")})` : "Beklemede"}
            </Text>
            {item.status === "pending" && (
              <View style={{ marginTop: 8 }}>
                <AppButton title="Okudum, Onaylıyorum" onPress={() => approveRecord(item.id)} />
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular" }}>Henüz bordro kaydınız yok.</Text>}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, paddingTop: 70, paddingHorizontal: 20, backgroundColor: colors.bg },
    title: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 22, color: colors.text, marginBottom: 20 },
    subtitle: { fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 17, color: colors.text, marginTop: 28, marginBottom: 12 },
    label: { fontFamily: "Inter_500Medium", fontSize: 13, color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      color: colors.text,
      padding: 12,
      marginBottom: 4,
      borderRadius: 10,
      fontFamily: "Inter_400Regular",
    },
    card: { padding: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated, borderRadius: 12, marginBottom: 10 },
    cardTitle: { fontFamily: "SpaceGrotesk_600SemiBold", color: colors.text, marginBottom: 4, fontSize: 15 },
    cardText: { fontFamily: "Inter_400Regular", color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6 },
    badgeText: { fontFamily: "IBMPlexMono_400Regular", fontSize: 11 },
  });
}