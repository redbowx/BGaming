const platformLogoModules = import.meta.glob("../assets/platforms/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const platformLogoMap: Record<string, string> = {
  steam: "steam",
  "epic games": "epic-games",
  "epic games store": "epic-games",
  gog: "gog",
  ea: "ea",
  "ea app": "ea",
  origin: "ea",
  "ubisoft connect": "ubisoft-connect",
  ubisoft: "ubisoft-connect",
  "amazon luna": "amazon-luna",
  luna: "amazon-luna",
  manuel: "manual",
  manual: "manual",
  bilinmeyen: "unknown",
  unknown: "unknown",
};

export function getPlatformLogo(platformName: string) {
  const logoName = platformLogoMap[normalizePlatformName(platformName)] ?? "unknown";
  return platformLogoModules[`../assets/platforms/${logoName}.svg`] ?? null;
}

function normalizePlatformName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
