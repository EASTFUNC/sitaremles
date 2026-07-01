import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useTheme } from "../lib/ThemeContext";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
};

export default function AppButton({ title, onPress, variant = "primary", disabled, loading }: Props) {
  const { colors } = useTheme();

  const bg = variant === "primary" ? colors.accent : variant === "secondary" ? colors.bgElevated : "transparent";
  const textColor = variant === "primary" ? colors.accentContrast : colors.text;
  const borderColor = variant === "ghost" ? "transparent" : variant === "secondary" ? colors.border : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
});