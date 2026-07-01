import { useEffect, useState } from "react";
import { View, Text, TextInput, Button, FlatList, StyleSheet } from "react-native";
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
  return <WeeklyShiftsScreen />;
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
      <Text style={styles.title}>SITAREMLES Giriş</Text>
      <TextInput
        style={styles.input}
        placeholder="E-posta"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Şifre"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      <Button title="Giriş Yap" onPress={handleLogin} />
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
      <Text style={styles.title}>Haftalık Vardiyam</Text>
      {loading ? (
        <Text>Yükleniyor...</Text>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardDate}>{item.work_date}</Text>
              <Text>Şube: {item.branches?.name}</Text>
              <Text>
                {item.shift_templates?.name} ({item.shift_templates?.start_time} - {item.shift_templates?.end_time})
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text>Henüz vardiya ataması yok.</Text>}
        />
      )}
      <Button title="Çıkış Yap" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 12, borderRadius: 6 },
  card: { padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 10 },
  cardDate: { fontWeight: "bold", marginBottom: 4 },
});