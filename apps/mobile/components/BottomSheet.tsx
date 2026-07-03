import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { X } from "lucide-react-native";
import { useTheme } from "../lib/ThemeContext";
import type { ReactNode } from "react";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

export default function BottomSheet({ visible, onClose, title, children }: Props) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.bgElevated, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={{ fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 16, color: colors.text }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, padding: 20, maxHeight: "80%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
});