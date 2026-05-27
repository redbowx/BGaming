const genreTranslations: Record<string, string> = {
  action: "Aksiyon",
  "action adventure": "Aksiyon Macera",
  "action-adventure": "Aksiyon Macera",
  adventure: "Macera",
  arcade: "Arcade",
  anime: "Anime",
  atmospheric: "Atmosferik",
  "2d fighting": "Dövüş",
  "2d dövüş": "Dövüş",
  "animation & modeling": "Animasyon ve Modelleme",
  "animation and modeling": "Animasyon ve Modelleme",
  "audio production": "Ses Üretimi",
  "base building": "Üs Kurma",
  "battle royale": "Battle Royale",
  "board games": "Masa Oyunu",
  building: "İnşa",
  casual: "Basit Eğlence",
  card: "Kart Oyunu",
  "card game": "Kart Oyunu",
  "choices matter": "Seçim Odaklı",
  "city builder": "Şehir Kurma",
  "colony sim": "Koloni Simülasyonu",
  competitive: "Rekabetçi",
  "co-op": "Eşli Oyun",
  crafting: "Üretim",
  cyberpunk: "Cyberpunk",
  "design & illustration": "Tasarım ve İllüstrasyon",
  difficult: "Zorlayıcı",
  education: "Eğitim",
  educational: "Eğitici",
  "early access": "Erken Erişim",
  exploration: "Keşif",
  family: "Aile",
  fantasy: "Fantastik",
  fighting: "Dövüş",
  football: "Spor",
  fps: "Birinci Şahıs Nişancı",
  "free to play": "Ücretsiz Oyna",
  gore: "Kanlı İçerik",
  "hack and slash": "Hack and Slash",
  "hack & slash": "Hack and Slash",
  horror: "Korku",
  indie: "Bağımsız",
  "local co-op": "Yerel Eşli Oyun",
  loot: "Loot",
  management: "Yönetim",
  "massively multiplayer": "Devasa Çok Oyunculu",
  medieval: "Orta Çağ",
  metroidvania: "Metroidvania",
  mmo: "Devasa Çok Oyunculu",
  moba: "MOBA",
  multiplayer: "Çok Oyunculu",
  music: "Müzik",
  nudity: "Çıplaklık",
  "online co-op": "Çevrimiçi Eşli Oyun",
  "open world": "Açık Dünya",
  parkour: "Parkur",
  "photo editing": "Fotoğraf Düzenleme",
  platformer: "Platform",
  "post-apocalyptic": "Kıyamet Sonrası",
  "point & click": "İşaretle ve Tıkla",
  puzzle: "Bulmaca",
  racing: "Yarış",
  "real-time strategy": "Gerçek Zamanlı Strateji",
  rts: "Gerçek Zamanlı Strateji",
  "role-playing": "Rol Yapma",
  "role-playing (rpg)": "Rol Yapma",
  roguelike: "Roguelike",
  roguelite: "Roguelite",
  rpg: "RYO",
  ryo: "RYO",
  sandbox: "Sandbox",
  shooter: "Nişancı",
  simulation: "Simülasyon",
  singleplayer: "Tek Oyunculu",
  "sci-fi": "Bilim Kurgu",
  soccer: "Spor",
  "software training": "Yazılım Eğitimi",
  "souls-like": "Souls-like",
  sports: "Spor",
  stealth: "Gizlilik",
  "story rich": "Hikâye Odaklı",
  strategy: "Strateji",
  survival: "Hayatta Kalma",
  "survival horror": "Hayatta Kalma Korku",
  tactical: "Taktiksel",
  "third-person shooter": "Üçüncü Şahıs Nişancı",
  "third person": "Üçüncü Şahıs",
  "tower defense": "Kule Savunma",
  "turn-based": "Sıra Tabanlı",
  "turn-based strategy": "Sıra Tabanlı Strateji",
  "turn-based strategy (tbs)": "Sıra Tabanlı Strateji",
  utilities: "Araçlar",
  "video production": "Video Üretimi",
  "visual novel": "Görsel Roman",
  vr: "VR",
  violent: "Şiddet",
  "sexual content": "Cinsel İçerik",
  zombies: "Zombi",
};

const visibleGenreDisplayNames = new Set(
  [
    "Aile",
    "Açık Dünya",
    "Aksiyon",
    "Aksiyon Macera",
    "Anime",
    "Animasyon ve Modelleme",
    "Arcade",
    "Atmosferik",
    "Bağımsız",
    "Basit Eğlence",
    "Battle Royale",
    "Bilim Kurgu",
    "Birinci Şahıs Nişancı",
    "Bulmaca",
    "Çevrimiçi Eşli Oyun",
    "Çok Oyunculu",
    "Cyberpunk",
    "Devasa Çok Oyunculu",
    "Dövüş",
    "Eğitici",
    "Erken Erişim",
    "Eşli Oyun",
    "Fantastik",
    "Gerçek Zamanlı Strateji",
    "Gizlilik",
    "Görsel Roman",
    "Hack and Slash",
    "Hayatta Kalma",
    "Hayatta Kalma Korku",
    "Hikâye Odaklı",
    "İnşa",
    "İşaretle ve Tıkla",
    "Kart Oyunu",
    "Keşif",
    "Koloni Simülasyonu",
    "Korku",
    "Kule Savunma",
    "Kıyamet Sonrası",
    "Loot",
    "Macera",
    "Masa Oyunu",
    "Metroidvania",
    "MOBA",
    "Müzik",
    "Nişancı",
    "Orta Çağ",
    "Parkur",
    "Platform",
    "Rekabetçi",
    "Roguelike",
    "Roguelite",
    "Rol Yapma",
    "RYO",
    "Sandbox",
    "Seçim Odaklı",
    "Simülasyon",
    "Souls-like",
    "Spor",
    "Strateji",
    "Sıra Tabanlı",
    "Sıra Tabanlı Strateji",
    "Taktiksel",
    "Tek Oyunculu",
    "Ücretsiz Oyna",
    "Üçüncü Şahıs",
    "Üçüncü Şahıs Nişancı",
    "Üretim",
    "Üs Kurma",
    "VR",
    "Yarış",
    "Yönetim",
    "Zombi",
    "Zorlayıcı",
  ].map(normalizeGenreKey),
);

const noisyGenrePatterns = [
  /^\(?\?\)?$/,
  /^\d+$/,
  /^\d+d$/,
  /^\d+d\s+/,
  /^\d{4}'?ler$/,
  /^\d{4}s$/,
  /^\d+\.\s*dünya savaşı$/,
  /^world war\s+[ivx0-9]+$/,
  /^steam\s+/,
  /^full controller support$/,
  /^controller$/,
  /^achievements?$/,
];

export function getGenreDisplayName(genreName: string) {
  const cleanName = genreName.trim();
  return genreTranslations[normalizeGenreKey(cleanName)] ?? cleanName;
}

export function isUsefulGenreName(genreName: string) {
  const cleanName = genreName.trim();
  if (!cleanName) return false;

  const rawKey = normalizeGenreKey(cleanName);
  const displayKey = normalizeGenreKey(getGenreDisplayName(cleanName));
  const hasCuratedTranslation = genreTranslations[rawKey] !== undefined;
  const looksNoisy = noisyGenrePatterns.some((pattern) => pattern.test(rawKey) || pattern.test(displayKey));

  if (hasCuratedTranslation && visibleGenreDisplayNames.has(displayKey)) {
    return true;
  }

  return !looksNoisy && visibleGenreDisplayNames.has(displayKey);
}

export function compareGenreNamesByDisplay(first: string, second: string) {
  return getGenreDisplayName(first).localeCompare(getGenreDisplayName(second), "tr", {
    sensitivity: "base",
  });
}

export function formatGenreNames(genreNames: string[] = []) {
  return genreNames.filter(isUsefulGenreName).map(getGenreDisplayName);
}

function normalizeGenreKey(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}
