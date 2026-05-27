export type ThemeMode = "dark" | "light";

export type AccentTheme =
  | "purpleNeon"
  | "orange"
  | "blue"
  | "green"
  | "gray"
  | "red"
  | "pink"
  | "teal"
  | "custom";

export type ThemeTokens = {
  mode: ThemeMode;
  accent: AccentTheme;
};
