import { invoke } from "@tauri-apps/api/core";
import { countGamesUsingCover } from "../database/repositories/gameRepository";
import { deleteStoredCover } from "./coverService";
import { updateManualGame } from "./gameService";
import { getAppSettings } from "./settingsService";
import type { Game } from "../types/game";
import { getGenreDisplayName, isUsefulGenreName } from "../utils/genreDisplay";
import { isTauriRuntime } from "../utils/tauriRuntime";

type MetadataMode = "cover" | "missing";

type FetchedMetadata = {
  coverPath: string | null;
  coverDownloaded: boolean;
  genres: string[];
  releaseYear: number | null;
  message: string;
};

export type GameMetadataLookup = FetchedMetadata;

export type CoverCandidate = {
  url: string;
  source: string;
  matchedTitle: string;
  width: number | null;
  height: number | null;
};

export type MetadataApplyResult = {
  game: Game;
  changed: boolean;
  coverUpdated: boolean;
  genresUpdated: boolean;
  yearUpdated: boolean;
  message: string;
};

export type MetadataBatchResult = {
  processed: number;
  updated: number;
  coversUpdated: number;
  genresUpdated: number;
  yearsUpdated: number;
  errors: number;
};

export type MetadataBatchProgress = MetadataBatchResult & {
  total: number;
  remaining: number;
  currentTitle: string | null;
};

type MetadataBatchProgressHandler = (progress: MetadataBatchProgress) => void;

type MetadataApiKeys = {
  rawgApiKey: string | null;
  steamGridDbApiKey: string | null;
};

export async function refreshGameCover(game: Game): Promise<MetadataApplyResult> {
  return fetchAndApplyMetadata(game, "cover", await getMetadataApiKeys());
}

export async function findGameCoverCandidates(game: Game): Promise<CoverCandidate[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  const apiKeys = await getMetadataApiKeys();
  return invoke<CoverCandidate[]>("fetch_cover_candidates", {
    steamAppId: game.steamAppId,
    title: game.title,
    steamGridDbApiKey: apiKeys.steamGridDbApiKey,
  });
}

export async function applyGameCoverCandidate(game: Game, candidate: CoverCandidate): Promise<MetadataApplyResult> {
  if (!isTauriRuntime()) {
    throw new Error("Kapak seçimi masaüstü uygulamasında çalışır.");
  }

  const coverPath = await invoke<string>("store_cover_candidate", {
    url: candidate.url,
    title: game.title,
  });
  const updatedGame = await updateManualGame({
    id: game.id,
    title: game.title,
    releaseYear: game.releaseYear,
    coverPath,
    usePlaceholderCover: false,
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
    turkishLanguageSupport: game.turkishLanguageSupport,
    turkishPatchAvailable: game.turkishPatchAvailable,
    genreNames: game.genreNames ?? [],
    platformNames: game.platformNames ?? [],
  });

  if (game.coverPath && game.coverPath !== coverPath) {
    const usageCount = await countGamesUsingCover(game.coverPath);
    if (usageCount === 0) {
      await deleteStoredCover(game.coverPath);
    }
  }

  return {
    game: updatedGame,
    changed: true,
    coverUpdated: true,
    genresUpdated: false,
    yearUpdated: false,
    message: `${candidate.source} kapağı uygulandı.`,
  };
}

export async function refreshMissingGameMetadata(game: Game): Promise<MetadataApplyResult> {
  return fetchAndApplyMetadata(game, "missing", await getMetadataApiKeys());
}

export async function enrichGamesMetadata(
  games: Game[],
  mode: MetadataMode,
  onProgress?: MetadataBatchProgressHandler,
): Promise<MetadataBatchResult> {
  const result: MetadataBatchResult = {
    processed: 0,
    updated: 0,
    coversUpdated: 0,
    genresUpdated: 0,
    yearsUpdated: 0,
    errors: 0,
  };
  const total = games.length;
  const metadataApiKeys = await getMetadataApiKeys();
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
      const update = await fetchAndApplyMetadata(game, mode, metadataApiKeys);
      if (update.changed) result.updated += 1;
      if (update.coverUpdated) result.coversUpdated += 1;
      if (update.genresUpdated) result.genresUpdated += 1;
      if (update.yearUpdated) result.yearsUpdated += 1;
    } catch {
      result.errors += 1;
    }

    result.processed += 1;
    emitProgress(game.title);
    await yieldToInterface();
  }

  return result;
}

export async function fetchMetadataForTitle(title: string, steamAppId: number | null = null): Promise<GameMetadataLookup> {
  if (!isTauriRuntime()) {
    return createEmptyMetadata(`${title} için metadata masaüstü uygulamasında denenebilir.`);
  }

  try {
    const metadata = await invoke<FetchedMetadata>("fetch_game_metadata", {
      steamAppId,
      title,
      ...(await getMetadataApiInvokeArgs()),
    });

    return {
      ...metadata,
      genres: normalizeMetadataGenreNames(metadata.genres),
    };
  } catch (error) {
    return createEmptyMetadata(error instanceof Error ? error.message : String(error));
  }
}

async function fetchAndApplyMetadata(
  game: Game,
  mode: MetadataMode,
  metadataApiKeys: MetadataApiKeys,
): Promise<MetadataApplyResult> {
  if (!isTauriRuntime()) {
    return {
      game,
      changed: false,
      coverUpdated: false,
      genresUpdated: false,
      yearUpdated: false,
      message: "Metadata yenileme masaustu Tauri uygulamasinda calisir.",
    };
  }

  const metadata = await invoke<FetchedMetadata>("fetch_game_metadata", {
    steamAppId: game.steamAppId,
    title: game.title,
    metadataApiKey: metadataApiKeys.rawgApiKey,
    steamGridDbApiKey: metadataApiKeys.steamGridDbApiKey,
  });
  const shouldUpdateCover = Boolean(
    metadata.coverPath && (mode === "cover" || !game.coverPath || game.usePlaceholderCover),
  );
  const metadataGenres = normalizeMetadataGenreNames(metadata.genres);
  const currentUsefulGenres = (game.genreNames ?? []).filter(isUsefulGenreName).map(getGenreDisplayName);
  const mergedGenres = mergeNameLists(currentUsefulGenres, metadataGenres);
  const shouldUpdateGenres =
    mode === "missing" &&
    metadataGenres.length > 0 &&
    mergedGenres.length > currentUsefulGenres.length;
  const shouldUpdateYear = mode === "missing" && game.releaseYear === null && metadata.releaseYear !== null;

  if (!shouldUpdateCover && !shouldUpdateGenres && !shouldUpdateYear) {
    return {
      game,
      changed: false,
      coverUpdated: false,
      genresUpdated: false,
      yearUpdated: false,
      message: metadata.message || "Uygulanacak yeni metadata bulunamadı.",
    };
  }

  const updatedGame = await updateManualGame({
    id: game.id,
    title: game.title,
    releaseYear: shouldUpdateYear ? metadata.releaseYear : game.releaseYear,
    coverPath: shouldUpdateCover ? metadata.coverPath : game.coverPath,
    usePlaceholderCover: shouldUpdateCover ? false : game.usePlaceholderCover,
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
    turkishLanguageSupport: game.turkishLanguageSupport,
    turkishPatchAvailable: game.turkishPatchAvailable,
    genreNames: shouldUpdateGenres ? mergedGenres : game.genreNames ?? [],
    platformNames: game.platformNames ?? [],
  });

  if (shouldUpdateCover && game.coverPath && game.coverPath !== metadata.coverPath) {
    const usageCount = await countGamesUsingCover(game.coverPath);
    if (usageCount === 0) {
      await deleteStoredCover(game.coverPath);
    }
  }

  return {
    game: updatedGame,
    changed: true,
    coverUpdated: shouldUpdateCover,
    genresUpdated: shouldUpdateGenres,
    yearUpdated: shouldUpdateYear,
    message: metadata.message ? `Metadata güncellendi. ${metadata.message}` : "Metadata güncellendi.",
  };
}

function mergeNameLists(first: string[] = [], second: string[] = []) {
  return Array.from(new Set([...first, ...second].map((name) => name.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
}

function createEmptyMetadata(message: string): GameMetadataLookup {
  return {
    coverPath: null,
    coverDownloaded: false,
    genres: [],
    releaseYear: null,
    message,
  };
}

function yieldToInterface() {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

async function getMetadataApiKeys(): Promise<MetadataApiKeys> {
  try {
    const settings = await getAppSettings();
    const rawgApiKey = settings.metadataApiKey.trim();
    const steamGridDbApiKey = settings.steamGridDbApiKey.trim();

    return {
      rawgApiKey: rawgApiKey.length > 0 ? rawgApiKey : null,
      steamGridDbApiKey: steamGridDbApiKey.length > 0 ? steamGridDbApiKey : null,
    };
  } catch {
    return {
      rawgApiKey: null,
      steamGridDbApiKey: null,
    };
  }
}

async function getMetadataApiInvokeArgs() {
  const keys = await getMetadataApiKeys();

  return {
    metadataApiKey: keys.rawgApiKey,
    steamGridDbApiKey: keys.steamGridDbApiKey,
  };
}

function normalizeMetadataGenreNames(genreNames: string[] = []) {
  return mergeNameLists([], genreNames.map(getGenreDisplayName).filter(isUsefulGenreName));
}
