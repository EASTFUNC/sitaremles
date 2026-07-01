import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors, ThemeColors } from "./theme";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  colors: lightColors,
  toggleTheme: () => {},
});

const STORAGE_KEY = "sitaremles-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark") {
        setMode(stored);
      }
    });
  }, []);

  function toggleTheme() {
    const next = mode === "light" ? "dark" : "light";
    setMode(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }

  const colors = mode === "light" ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}