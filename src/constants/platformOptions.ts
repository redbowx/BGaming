export const platformOptions = [
  "Steam",
  "Epic Games",
  "GOG",
  "Ubisoft Connect",
  "EA App",
  "Amazon Games",
  "Amazon Luna",
  "Diğer",
  "Manuel / Bilinmeyen",
] as const;

export type KnownPlatformOption = (typeof platformOptions)[number];
