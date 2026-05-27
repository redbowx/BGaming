import { invoke } from "@tauri-apps/api/core";
import { importExternalGames, type FileImportSummary, type ImportedGameInput } from "../database/repositories/gameRepository";
import { ensureDatabaseReady } from "../database/ready";
import type { Game } from "../types/game";
import { normalizeTitle } from "../utils/normalizeTitle";
import { getGames } from "./gameService";
import { isTauriRuntime } from "../utils/tauriRuntime";

export type InstalledGameCandidate = {
  title: string;
  platformName: string;
  installPath: string;
  status: "new" | "existingInstalled" | "existingNotInstalled";
  selected: boolean;
};

export type InstalledScanSummary = FileImportSummary & {
  foundNew: number;
  existing: number;
  installMarksSuggested: number;
};

type RawInstalledGameCandidate = {
  title: string;
  platformName: string;
  installPath: string;
};

export async function selectInstalledScanFolder() {
  ensureTauriRuntime();
  return invoke<string | null>("select_scan_folder");
}

export async function scanInstalledGames(extraFolder: string | null = null): Promise<InstalledGameCandidate[]> {
  ensureTauriRuntime();
  await ensureDatabaseReady();
  const [rawCandidates, games] = await Promise.all([
    invoke<RawInstalledGameCandidate[]>("scan_installed_games", { extraFolder }),
    getGames(),
  ]);
  return classifyCandidates(rawCandidates, games);
}

export async function scanTrustedInstalledGames(): Promise<InstalledGameCandidate[]> {
  ensureTauriRuntime();
  await ensureDatabaseReady();
  const [rawCandidates, games] = await Promise.all([
    invoke<RawInstalledGameCandidate[]>("scan_trusted_installed_games"),
    getGames(),
  ]);
  return classifyCandidates(rawCandidates, games);
}

export async function importInstalledCandidates(
  candidates: InstalledGameCandidate[],
  fallbackPlatformName: string,
): Promise<InstalledScanSummary> {
  await ensureDatabaseReady();
  const selectedCandidates = candidates.filter((candidate) => candidate.selected);
  const gamesToImport: ImportedGameInput[] = selectedCandidates
    .filter((candidate) => candidate.status !== "existingInstalled")
    .map((candidate) => ({
      title: candidate.title,
      releaseYear: null,
      genreNames: [],
      platformNames: [candidate.platformName || fallbackPlatformName],
      coverPath: null,
      isPlayed: false,
      isCompleted: false,
      isFavorite: false,
      isInstalled: true,
      notes: candidate.installPath ? `Yüklü oyun taramasında bulundu: ${candidate.installPath}` : null,
      personalRating: null,
      externalId: null,
      externalSource: null,
    }));

  const summary = await importExternalGames(gamesToImport);
  return {
    ...summary,
    foundNew: selectedCandidates.filter((candidate) => candidate.status === "new").length,
    existing: candidates.filter((candidate) => candidate.status !== "new").length,
    installMarksSuggested: candidates.filter((candidate) => candidate.status === "existingNotInstalled").length,
  };
}

export async function scanAndImportInstalledGames(
  extraFolder: string | null = null,
  fallbackPlatformName = "Manuel / Bilinmeyen",
): Promise<InstalledScanSummary & { games: Game[] }> {
  const candidates = await scanInstalledGames(extraFolder);
  const importSummary = await importInstalledCandidates(candidates, fallbackPlatformName);
  const games = await getGames();

  return {
    ...importSummary,
    games,
  };
}

export async function syncTrustedInstalledGames(): Promise<InstalledScanSummary & { games: Game[] }> {
  const candidates = await scanTrustedInstalledGames();
  const importSummary = await importInstalledCandidates(candidates, "Manuel / Bilinmeyen");
  const games = await getGames();

  return {
    ...importSummary,
    games,
  };
}

function classifyCandidates(rawCandidates: RawInstalledGameCandidate[], games: Game[]) {
  const seen = new Set<string>();
  const gamesByTitle = new Map(games.map((game) => [game.normalizedTitle, game]));
  const gamesByCompactTitle = new Map(games.map((game) => [compactTitleKey(game.title), game]));
  const candidates: InstalledGameCandidate[] = [];

  for (const rawCandidate of rawCandidates) {
    const title = rawCandidate.title.trim();
    if (!title) continue;

    const normalizedTitle = normalizeTitle(title);
    const compactTitle = compactTitleKey(title);
    const key = `${compactTitle || normalizedTitle}::${rawCandidate.platformName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const existingGame = gamesByTitle.get(normalizedTitle) ?? gamesByCompactTitle.get(compactTitle);
    const status = existingGame
      ? existingGame.isInstalled
        ? "existingInstalled"
        : "existingNotInstalled"
      : "new";

    candidates.push({
      title: existingGame?.title ?? title,
      platformName: rawCandidate.platformName || "Manuel / Bilinmeyen",
      installPath: rawCandidate.installPath,
      status,
      selected: status !== "existingInstalled",
    });
  }

  return candidates.sort((first, second) => first.title.localeCompare(second.title, "tr"));
}

function compactTitleKey(title: string) {
  return normalizeTitle(title).replace(/[^a-z0-9]+/g, "");
}

function ensureTauriRuntime() {
  if (!isTauriRuntime()) {
    throw new Error("Yüklü oyun tarama işlemi masaüstü Tauri uygulamasında çalışır.");
  }
}
