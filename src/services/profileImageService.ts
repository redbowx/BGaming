import { invoke } from "@tauri-apps/api/core";
import type { Game } from "../types/game";
import { isTauriRuntime } from "../utils/tauriRuntime";
import { getGames } from "./gameService";
import { calculateLibraryStats, type LibraryStats } from "./statsService";

export type ShareableProfileImage = {
  dataUrl: string;
  fileName: string;
};

export type ProfileImagePeriod = "month" | "year";

export async function createShareableProfileImage(period: ProfileImagePeriod): Promise<ShareableProfileImage> {
  const games = await getGames();
  const filteredGames = filterGamesByPeriod(games, period);
  const stats = calculateLibraryStats(filteredGames);
  const periodLabel = getPeriodLabel(period);
  await document.fonts?.ready;

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Profil görseli oluşturulamadı.");
  }

  const theme = readThemeColors();
  const featuredGames = selectFeaturedGames(filteredGames);
  drawBackground(context, canvas, theme);
  drawHeader(context, stats, periodLabel, theme);
  drawMetrics(context, stats, theme);
  drawCompletion(context, stats, theme);
  drawDistributions(context, stats, theme);
  drawFeaturedGames(context, featuredGames, theme);
  drawFooter(context, theme);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    fileName: `BGaming-profil-${period}-${new Date().toISOString().slice(0, 10)}.png`,
  };
}

export async function saveShareableProfileImage(image: ShareableProfileImage) {
  if (!isTauriRuntime()) {
    throw new Error("Profil görseli kaydetme yalnızca masaüstü uygulamasında çalışır.");
  }

  const encoded = image.dataUrl.split(",")[1];
  if (!encoded) {
    throw new Error("Profil görseli kaydedilecek biçime dönüştürülemedi.");
  }

  const binary = window.atob(encoded);
  const bytes = Array.from(binary, (character) => character.charCodeAt(0));
  return invoke<string | null>("save_profile_image", { defaultFileName: image.fileName, bytes });
}

type ProfileTheme = {
  accent: string;
  accent2: string;
  panel: string;
  text: string;
  muted: string;
};

function readThemeColors(): ProfileTheme {
  const styles = window.getComputedStyle(document.documentElement);
  return {
    accent: styles.getPropertyValue("--color-accent").trim() || "#a855f7",
    accent2: styles.getPropertyValue("--color-accent-2").trim() || "#22d3ee",
    panel: "#202635",
    text: "#f8fafc",
    muted: "#aab4c4",
  };
}

function selectFeaturedGames(games: Game[]) {
  return [...games]
    .sort((first, second) => {
      const firstScore = Number(first.isCurrentlyPlaying) * 8 + Number(first.isFavorite) * 4 + Number(first.isCompleted) * 2;
      const secondScore = Number(second.isCurrentlyPlaying) * 8 + Number(second.isFavorite) * 4 + Number(second.isCompleted) * 2;
      return secondScore - firstScore || first.title.localeCompare(second.title, "tr");
    })
    .slice(0, 4);
}

function drawBackground(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, theme: ProfileTheme) {
  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#10141f");
  background.addColorStop(0.58, "#181d2a");
  background.addColorStop(1, "#0d1018");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawGlow(context, 170, 130, 370, theme.accent, 0.28);
  drawGlow(context, 910, 180, 300, theme.accent2, 0.23);
  drawGlow(context, 950, 1180, 310, theme.accent, 0.18);
}

function drawHeader(context: CanvasRenderingContext2D, stats: LibraryStats, periodLabel: string, theme: ProfileTheme) {
  context.fillStyle = theme.muted;
  context.font = "800 22px Arial";
  context.fillText("KİŞİSEL OYUN KÜTÜPHANESİ", 68, 82);

  const accent = context.createLinearGradient(68, 0, 480, 0);
  accent.addColorStop(0, theme.accent);
  accent.addColorStop(1, theme.accent2);
  context.fillStyle = accent;
  context.font = "900 66px Arial";
  context.fillText("BGaming", 68, 155);

  context.fillStyle = theme.text;
  context.font = "800 33px Arial";
  context.fillText(`${periodLabel} Profilim`, 68, 205);
  context.fillStyle = theme.muted;
  context.font = "600 21px Arial";
  context.fillText(`${stats.totalGames} oyun kütüphaneye eklendi`, 68, 241);
}

function drawMetrics(context: CanvasRenderingContext2D, stats: LibraryStats, theme: ProfileTheme) {
  const metrics = [
    ["Toplam Oyun", stats.totalGames],
    ["Bitirilen", stats.completedGames],
    ["Favori", stats.favoriteGames],
    ["Yüklü", stats.installedGames],
  ];
  const cardWidth = 221;
  metrics.forEach(([label, value], index) => {
    const x = 68 + index * (cardWidth + 18);
    drawPanel(context, x, 282, cardWidth, 132);
    context.fillStyle = theme.muted;
    context.font = "700 17px Arial";
    context.fillText(String(label), x + 18, 316);
    context.fillStyle = theme.text;
    context.font = "900 48px Arial";
    context.fillText(String(value), x + 18, 375);
  });
}

function drawCompletion(context: CanvasRenderingContext2D, stats: LibraryStats, theme: ProfileTheme) {
  const percent = stats.totalGames === 0 ? 0 : Math.round((stats.completedGames / stats.totalGames) * 100);
  drawPanel(context, 68, 442, 944, 142);
  context.fillStyle = theme.text;
  context.font = "800 23px Arial";
  context.fillText("Tamamlanma ilerlemesi", 92, 480);
  context.fillStyle = theme.muted;
  context.font = "800 22px Arial";
  context.fillText(`%${percent}`, 935, 480);
  roundedRect(context, 92, 508, 896, 22, 11);
  context.fillStyle = "rgba(255,255,255,0.1)";
  context.fill();
  if (percent > 0) {
    const progress = context.createLinearGradient(92, 0, 988, 0);
    progress.addColorStop(0, theme.accent);
    progress.addColorStop(1, theme.accent2);
    roundedRect(context, 92, 508, Math.max(22, 896 * percent / 100), 22, 11);
    context.fillStyle = progress;
    context.fill();
  }
  context.fillStyle = theme.muted;
  context.font = "600 17px Arial";
  context.fillText(`${stats.playedGames} oynandı | ${stats.currentlyPlayingGames} şu an oynanıyor | ${stats.favoriteGames} favori`, 92, 560);
}

function drawDistributions(context: CanvasRenderingContext2D, stats: LibraryStats, theme: ProfileTheme) {
  drawPanel(context, 68, 610, 457, 278);
  drawPanel(context, 555, 610, 457, 278);
  drawRankList(context, "Öne çıkan türler", stats.genreDistribution.slice(0, 5), 92, theme);
  drawRankList(context, "Platformlar", stats.platformDistribution.slice(0, 5), 579, theme);
}

function drawFeaturedGames(context: CanvasRenderingContext2D, games: Game[], theme: ProfileTheme) {
  drawPanel(context, 68, 916, 944, 304);
  context.fillStyle = theme.text;
  context.font = "800 23px Arial";
  context.fillText("Öne çıkan oyunlarım", 92, 958);

  games.forEach((game, index) => {
    const y = 1002 + index * 47;
    const gradient = context.createLinearGradient(92, y, 112, y);
    gradient.addColorStop(0, theme.accent);
    gradient.addColorStop(1, theme.accent2);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(102, y + 9, 6, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = theme.text;
    context.font = "700 19px Arial";
    context.fillText(trimText(context, game.title, 570), 124, y + 15);
    context.fillStyle = theme.muted;
    context.font = "600 16px Arial";
    const labels = [
      game.isCurrentlyPlaying ? "Şu an oynuyorum" : null,
      game.isFavorite ? "Favori" : null,
      game.releaseYear ? String(game.releaseYear) : null,
    ].filter(Boolean).join("  |  ");
    context.fillText(labels || "Kütüphanemde", 710, y + 15);
  });
}

function drawFooter(context: CanvasRenderingContext2D, theme: ProfileTheme) {
  const gradient = context.createLinearGradient(68, 0, 1012, 0);
  gradient.addColorStop(0, theme.accent);
  gradient.addColorStop(1, theme.accent2);
  context.fillStyle = gradient;
  roundedRect(context, 68, 1264, 944, 3, 2);
  context.fill();
  context.fillStyle = theme.muted;
  context.font = "700 17px Arial";
  context.fillText("BGaming ile oluşturuldu", 68, 1308);
  context.textAlign = "right";
  context.fillText(new Date().toLocaleDateString("tr-TR"), 1012, 1308);
  context.textAlign = "left";
}

function drawRankList(context: CanvasRenderingContext2D, title: string, items: Array<{ label: string; count: number }>, x: number, theme: ProfileTheme) {
  context.fillStyle = theme.text;
  context.font = "800 22px Arial";
  context.fillText(title, x, 651);
  if (items.length === 0) {
    context.fillStyle = theme.muted;
    context.font = "600 18px Arial";
    context.fillText("Veri yok", x, 694);
    return;
  }
  items.forEach((item, index) => {
    const y = 692 + index * 36;
    context.fillStyle = theme.muted;
    context.font = "700 17px Arial";
    context.fillText(trimText(context, item.label, 295), x, y);
    context.fillStyle = theme.text;
    context.textAlign = "right";
    context.fillText(String(item.count), x + 405, y);
    context.textAlign = "left";
  });
}

function drawPanel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  roundedRect(context, x, y, width, height, 22);
  context.fillStyle = "rgba(32,38,53,0.9)";
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.1)";
  context.lineWidth = 1;
  context.stroke();
}

function drawGlow(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, opacity: number) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, withOpacity(color, opacity));
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function withOpacity(color: string, opacity: number) {
  if (color.startsWith("#")) {
    const value = color.slice(1);
    const hex = value.length === 3 ? value.split("").map((item) => item + item).join("") : value;
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    return `rgba(${red},${green},${blue},${opacity})`;
  }
  return color;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function trimText(context: CanvasRenderingContext2D, text: string, width: number) {
  if (context.measureText(text).width <= width) return text;
  let truncated = text;
  while (truncated.length > 1 && context.measureText(`${truncated}...`).width > width) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}

function filterGamesByPeriod(games: Game[], period: ProfileImagePeriod) {
  const now = new Date();
  return games.filter((game) => {
    const createdAt = new Date(game.createdAt);
    if (Number.isNaN(createdAt.getTime()) || createdAt.getFullYear() !== now.getFullYear()) {
      return false;
    }

    return period === "year" || createdAt.getMonth() === now.getMonth();
  });
}

function getPeriodLabel(period: ProfileImagePeriod) {
  const now = new Date();
  return period === "month"
    ? now.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
    : String(now.getFullYear());
}
