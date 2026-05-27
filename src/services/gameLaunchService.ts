import { invoke } from "@tauri-apps/api/core";
import type { Game } from "../types/game";
import { isTauriRuntime } from "../utils/tauriRuntime";

type LaunchGameResult = {
  message: string;
};

const installPathMarker = "Yüklü oyun taramasında bulundu:";

type InstalledGameStateResult = {
  id: number;
  isInstalled: boolean;
};

type InstalledGameStateInput = {
  id: number;
  steamAppId: number | null;
  installPath: string | null;
  platformNames: string[];
  isInstalled: boolean;
};

export async function launchGame(game: Game) {
  if (!isTauriRuntime()) {
    throw new Error("Oyun başlatma sadece masaüstü uygulamasında çalışır.");
  }

  const installPath = extractInstallPath(game);
  const shouldLaunchViaSteam = isSteamOwnedGame(game);

  if ((!game.steamAppId || !shouldLaunchViaSteam) && !installPath) {
    throw new Error(
      "Bu oyun Steam dışı görünüyor ve çalıştırma yolu kayıtlı değil. Yüklü Oyunları Tara ile oyun klasörünü kaydetmen gerekir.",
    );
  }

  const result = await invoke<LaunchGameResult>("launch_game", {
    steamAppId: game.steamAppId,
    launchViaSteam: shouldLaunchViaSteam,
    installPath,
    platformNames: game.platformNames ?? [],
    title: game.title,
  });

  return result.message;
}

export async function revealGameFolder(game: Game) {
  if (!isTauriRuntime()) {
    throw new Error("Klasör açma sadece masaüstü uygulamasında çalışır.");
  }

  const result = await invoke<LaunchGameResult>("reveal_game_folder", {
    steamAppId: game.steamAppId,
    installPath: extractInstallPath(game),
    platformNames: game.platformNames ?? [],
    title: game.title,
  });

  return result.message;
}

export async function selectGameInstallFolder() {
  if (!isTauriRuntime()) {
    throw new Error("Klasör seçme sadece masaüstü uygulamasında çalışır.");
  }

  return invoke<string | null>("select_scan_folder");
}

export async function checkInstalledGameStates(games: Game[]) {
  if (!isTauriRuntime()) {
    return games.map((game) => ({ id: game.id, isInstalled: game.isInstalled }));
  }

  const payload: InstalledGameStateInput[] = games.map((game) => ({
    id: game.id,
    steamAppId: game.steamAppId,
    installPath: extractInstallPath(game),
    platformNames: game.platformNames ?? [],
    isInstalled: game.isInstalled,
  }));

  return invoke<InstalledGameStateResult[]>("check_installed_game_states", { games: payload });
}

export function writeGameInstallPath(notes: string | null, installPath: string) {
  const cleanPath = installPath.trim();
  const preservedNotes = (notes ?? "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(installPathMarker))
    .join("\n")
    .trim();

  return [preservedNotes, `${installPathMarker} ${cleanPath}`].filter(Boolean).join("\n");
}

function isSteamOwnedGame(game: Game) {
  if (!game.steamAppId) {
    return false;
  }

  if (game.source === "steam") {
    return true;
  }

  return (game.platformNames ?? []).some((platformName) => platformName.toLocaleLowerCase("tr-TR") === "steam");
}

function extractInstallPath(game: Game) {
  const notes = game.notes?.trim();
  if (!notes) {
    return null;
  }

  const markerIndex = notes.lastIndexOf(installPathMarker);
  if (markerIndex < 0) {
    return null;
  }

  const value = notes.slice(markerIndex + installPathMarker.length).split(/\r?\n/)[0]?.trim();
  return value || null;
}
