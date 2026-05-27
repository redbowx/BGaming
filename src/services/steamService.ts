import { invoke } from "@tauri-apps/api/core";
import {
  importSteamGames,
  type SteamGameImportInput,
  type SteamImportSummary,
} from "../database/repositories/gameRepository";
import { ensureDatabaseReady } from "../database/ready";
import { isTauriRuntime } from "../utils/tauriRuntime";

export type SteamConnectionResult = {
  steamId: string;
  displayName: string;
  gameCount: number;
};

export type SteamFetchedGame = {
  appId: number;
  name: string;
  coverPath: string | null;
  coverDownloaded: boolean;
  coverError: string | null;
};

export type SteamLibraryResult = {
  steamId: string;
  games: SteamFetchedGame[];
};

export type SteamImportResult = SteamImportSummary & {
  fetched: number;
  steamId: string;
};

export async function testSteamConnection(apiKey: string, steamProfile: string): Promise<SteamConnectionResult> {
  ensureTauriRuntime();
  await ensureDatabaseReady();

  return invoke<SteamConnectionResult>("test_steam_connection", {
    apiKey: apiKey.trim(),
    steamProfile: steamProfile.trim(),
  });
}

export async function fetchAndImportSteamLibrary(
  apiKey: string,
  steamProfile: string,
): Promise<SteamImportResult> {
  ensureTauriRuntime();
  await ensureDatabaseReady();

  const library = await invoke<SteamLibraryResult>("fetch_steam_library", {
    apiKey: apiKey.trim(),
    steamProfile: steamProfile.trim(),
  });
  const summary = await importSteamGames(library.games.map(mapSteamGameInput));

  return {
    ...summary,
    fetched: library.games.length,
    steamId: library.steamId,
  };
}

function mapSteamGameInput(game: SteamFetchedGame): SteamGameImportInput {
  return {
    appId: game.appId,
    name: game.name,
    coverPath: game.coverPath,
    coverDownloaded: game.coverDownloaded,
  };
}

function ensureTauriRuntime() {
  if (!isTauriRuntime()) {
    throw new Error("Steam entegrasyonu masaustu Tauri uygulamasinda calisir.");
  }
}
