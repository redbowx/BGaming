import { invoke } from "@tauri-apps/api/core";
import type { Game } from "../types/game";
import { formatGenreNames } from "../utils/genreDisplay";
import { isTauriRuntime } from "../utils/tauriRuntime";
import { getGames } from "./gameService";

export type ExportReportFormat = "csv" | "json";

type LibraryReportSummary = {
  totalGames: number;
  installedGames: number;
  favoriteGames: number;
  playedGames: number;
  completedGames: number;
  currentlyPlayingGames: number;
  gamesWithoutCover: number;
  gamesWithoutGenre: number;
};

const installPathMarker = "Yüklü oyun taramasında bulundu:";

export async function exportLibraryReport(format: ExportReportFormat) {
  if (!isTauriRuntime()) {
    throw new Error("Rapor dışa aktarma yalnızca masaüstü uygulamasında çalışır.");
  }

  const games = await getGames();
  if (games.length === 0) {
    throw new Error("Rapor oluşturmak için kütüphanede oyun bulunmuyor.");
  }

  const exportedAt = new Date().toISOString();
  const report = {
    exportedAt,
    summary: createSummary(games),
    games: games.map(toReportGame),
  };
  const content = format === "csv" ? toCsv(report.games) : JSON.stringify(report, null, 2);
  const date = exportedAt.slice(0, 10);

  return invoke<string | null>("save_text_report", {
    defaultFileName: `BGaming-kutuphane-raporu-${date}.${format}`,
    content,
    extension: format,
  });
}

function createSummary(games: Game[]): LibraryReportSummary {
  return {
    totalGames: games.length,
    installedGames: games.filter((game) => game.isInstalled).length,
    favoriteGames: games.filter((game) => game.isFavorite).length,
    playedGames: games.filter((game) => game.isPlayed).length,
    completedGames: games.filter((game) => game.isCompleted).length,
    currentlyPlayingGames: games.filter((game) => game.isCurrentlyPlaying).length,
    gamesWithoutCover: games.filter((game) => !game.coverPath || game.usePlaceholderCover).length,
    gamesWithoutGenre: games.filter((game) => (game.genreNames ?? []).length === 0).length,
  };
}

function toReportGame(game: Game) {
  return {
    title: game.title,
    releaseYear: game.releaseYear,
    platforms: game.platformNames ?? [],
    genres: formatGenreNames(game.genreNames ?? []),
    isPlayed: game.isPlayed,
    isCompleted: game.isCompleted,
    isFavorite: game.isFavorite,
    isInstalled: game.isInstalled,
    isCurrentlyPlaying: game.isCurrentlyPlaying,
    isAbandoned: game.isAbandoned,
    turkishLanguageSupport: game.turkishLanguageSupport,
    turkishPatchAvailable: game.turkishPatchAvailable,
    personalRating: game.personalRating,
    notes: getUserNotes(game.notes),
    source: game.source,
    steamAppId: game.steamAppId,
  };
}

function getUserNotes(notes: string | null) {
  if (!notes) return "";

  return notes
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(installPathMarker))
    .join("\n")
    .trim();
}

function toCsv(games: ReturnType<typeof toReportGame>[]) {
  const columns: Array<{ title: string; value: (game: ReturnType<typeof toReportGame>) => unknown }> = [
    { title: "Oyun Adı", value: (game) => game.title },
    { title: "Çıkış Yılı", value: (game) => game.releaseYear ?? "" },
    { title: "Platformlar", value: (game) => game.platforms.join(", ") },
    { title: "Türler", value: (game) => game.genres.join(", ") },
    { title: "Oynandı", value: (game) => toTurkishBoolean(game.isPlayed) },
    { title: "Bitti", value: (game) => toTurkishBoolean(game.isCompleted) },
    { title: "Favori", value: (game) => toTurkishBoolean(game.isFavorite) },
    { title: "Yüklü", value: (game) => toTurkishBoolean(game.isInstalled) },
    { title: "Şu An Oynuyorum", value: (game) => toTurkishBoolean(game.isCurrentlyPlaying) },
    { title: "Yarım Bırakıldı", value: (game) => toTurkishBoolean(game.isAbandoned) },
    { title: "Türkçe Dil Desteği", value: (game) => translateLanguageSupport(game.turkishLanguageSupport) },
    { title: "Türkçe Yama", value: (game) => toTurkishBoolean(game.turkishPatchAvailable) },
    { title: "Kişisel Puan", value: (game) => game.personalRating ?? "" },
    { title: "Notlar", value: (game) => game.notes },
    { title: "Kaynak", value: (game) => game.source },
    { title: "Steam AppID", value: (game) => game.steamAppId ?? "" },
  ];
  const lines = [
    columns.map((column) => escapeCsv(column.title)).join(";"),
    ...games.map((game) => columns.map((column) => escapeCsv(column.value(game))).join(";")),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

function toTurkishBoolean(value: boolean) {
  return value ? "Evet" : "Hayır";
}

function translateLanguageSupport(value: Game["turkishLanguageSupport"]) {
  if (value === "yes") return "Var";
  if (value === "no") return "Yok";
  return "Bilinmiyor";
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}
