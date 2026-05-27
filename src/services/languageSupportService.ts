import { invoke } from "@tauri-apps/api/core";
import { saveGameDetails } from "./gameService";
import type { Game, TurkishLanguageSupport } from "../types/game";
import { isTauriRuntime } from "../utils/tauriRuntime";

type FetchedLanguageInfo = {
  turkishLanguageSupport: TurkishLanguageSupport;
  message: string;
};

export type LanguageSupportApplyResult = {
  game: Game;
  changed: boolean;
  unresolved: boolean;
  message: string;
};

export type LanguageSupportBatchResult = {
  processed: number;
  updated: number;
  unresolved: number;
  errors: number;
  messages: string[];
};

export type LanguageSupportBatchProgress = LanguageSupportBatchResult & {
  total: number;
  remaining: number;
  currentTitle: string | null;
};

type LanguageSupportBatchProgressHandler = (progress: LanguageSupportBatchProgress) => void;

export async function refreshGameLanguageSupport(game: Game): Promise<LanguageSupportApplyResult> {
  if (!isTauriRuntime()) {
    return {
      game,
      changed: false,
      unresolved: true,
      message: "Dil bilgisi yenileme masaüstü uygulamasında çalışır.",
    };
  }

  const languageInfo = await invoke<FetchedLanguageInfo>("fetch_game_language_info", {
    steamAppId: game.steamAppId,
    title: game.title,
  });

  if (languageInfo.turkishLanguageSupport === "unknown") {
    return {
      game,
      changed: false,
      unresolved: true,
      message: languageInfo.message,
    };
  }

  const patchAvailable = languageInfo.turkishLanguageSupport === "no" ? game.turkishPatchAvailable : false;
  const changed =
    game.turkishLanguageSupport !== languageInfo.turkishLanguageSupport ||
    game.turkishPatchAvailable !== patchAvailable;

  if (!changed) {
    return {
      game,
      changed: false,
      unresolved: false,
      message: languageInfo.message,
    };
  }

  const updatedGame = await saveGameDetails({
    id: game.id,
    isPlayed: game.isPlayed,
    isCompleted: game.isCompleted,
    isFavorite: game.isFavorite,
    isCurrentlyPlaying: game.isCurrentlyPlaying,
    isAbandoned: game.isAbandoned,
    isWishlisted: game.isWishlisted,
    neverShowInRandom: game.neverShowInRandom,
    multiplayerType: game.multiplayerType,
    steamDeckCompatible: game.steamDeckCompatible,
    personalRating: game.personalRating,
    notes: game.notes,
    estimatedLength: game.estimatedLength,
    releaseYear: game.releaseYear,
    turkishLanguageSupport: languageInfo.turkishLanguageSupport,
    turkishPatchAvailable: patchAvailable,
  });

  return {
    game: updatedGame,
    changed: true,
    unresolved: false,
    message: languageInfo.message,
  };
}

export async function enrichGamesLanguageSupport(
  games: Game[],
  onProgress?: LanguageSupportBatchProgressHandler,
): Promise<LanguageSupportBatchResult> {
  const result: LanguageSupportBatchResult = {
    processed: 0,
    updated: 0,
    unresolved: 0,
    errors: 0,
    messages: [],
  };
  const total = games.length;
  const emitProgress = (currentTitle: string | null) => {
    onProgress?.({
      ...result,
      total,
      remaining: Math.max(total - result.processed, 0),
      currentTitle,
    });
  };

  emitProgress(null);

  for (const game of games) {
    emitProgress(game.title);

    try {
      const update = await refreshGameLanguageSupport(game);
      if (update.changed) result.updated += 1;
      if (update.unresolved) {
        result.unresolved += 1;
        pushBatchMessage(result.messages, `${game.title}: ${update.message}`);
      }
    } catch (error) {
      result.errors += 1;
      pushBatchMessage(
        result.messages,
        `${game.title}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    result.processed += 1;
    emitProgress(game.title);
    await waitBetweenSteamLookups();
  }

  return result;
}

function pushBatchMessage(messages: string[], message: string) {
  if (messages.length >= 8) return;
  const cleanMessage = message.trim();
  if (cleanMessage) {
    messages.push(cleanMessage);
  }
}

function waitBetweenSteamLookups() {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, 160);
  });
}
