export type ThemeColors = {
  bg: string;
  bgElevated: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentContrast: string;
  success: string;
};

export const lightColors: ThemeColors = {
  bg: "#F7F8FA",
  bgElevated: "#FFFFFF",
  text: "#0B1220",
  textSecondary: "#4B5A6E",
  border: "#C9D2DE",
  accent: "#2E5AAC",
  accentContrast: "#FFFFFF",
  success: "#1F9D74",
};

export const darkColors: ThemeColors = {
  bg: "#0B1220",
  bgElevated: "#1E3A5F",
  text: "#F1F4F8",
  textSecondary: "#9AA9BD",
  border: "#2C3F58",
  accent: "#5B8DEF",
  accentContrast: "#0B1220",
  success: "#2FC090",
};