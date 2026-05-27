import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { initializeLibraryData } from "../../services/libraryInitializationService";
import {
  applyThemePreferences,
  getThemePreferences,
  saveThemePreferences,
  type ThemePreferences,
} from "../../services/themeService";
import type { AccentTheme, ThemeMode } from "../../types/theme";

type ThemeContextValue = ThemePreferences & {
  isThemeReady: boolean;
  setThemeMode: (themeMode: ThemeMode) => Promise<void>;
  setAccentTheme: (accentTheme: AccentTheme) => Promise<void>;
  setCustomAccentTheme: (from: string, to: string) => Promise<void>;
};

const defaultPreferences: ThemePreferences = {
  themeMode: "dark",
  accentTheme: "purpleNeon",
  customAccentFrom: "#a855f7",
  customAccentTo: "#22d3ee",
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<ThemePreferences>(defaultPreferences);
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    applyThemePreferences(defaultPreferences);

    void initializeLibraryData()
      .then((result) => {
        if (result.status === "failed") {
          console.error("Database initialization failed", result.error);
        }

        return getThemePreferences();
      })
      .then((savedPreferences) => {
        setPreferences(savedPreferences);
        applyThemePreferences(savedPreferences);
      })
      .finally(() => setIsThemeReady(true));
  }, []);

  const updatePreferences = useCallback(async (nextPreferences: ThemePreferences) => {
    setPreferences(nextPreferences);
    applyThemePreferences(nextPreferences);
    await saveThemePreferences(nextPreferences);
  }, []);

  const setThemeMode = useCallback(
    async (themeMode: ThemeMode) => {
      await updatePreferences({ ...preferences, themeMode });
    },
    [preferences, updatePreferences],
  );

  const setAccentTheme = useCallback(
    async (accentTheme: AccentTheme) => {
      await updatePreferences({ ...preferences, accentTheme });
    },
    [preferences, updatePreferences],
  );

  const setCustomAccentTheme = useCallback(
    async (customAccentFrom: string, customAccentTo: string) => {
      await updatePreferences({
        ...preferences,
        accentTheme: "custom",
        customAccentFrom,
        customAccentTo,
      });
    },
    [preferences, updatePreferences],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...preferences,
      isThemeReady,
      setThemeMode,
      setAccentTheme,
      setCustomAccentTheme,
    }),
    [isThemeReady, preferences, setAccentTheme, setCustomAccentTheme, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeSettings() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useThemeSettings must be used inside ThemeProvider");
  }

  return context;
}
