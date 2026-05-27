import { importExternalGames, type FileImportSummary, type ImportedGameInput } from "../database/repositories/gameRepository";
import { ensureDatabaseReady } from "../database/ready";
import { fetchMetadataForTitle } from "./metadataService";

export type BulkAddInput = {
  text: string;
  platformName: string;
  isInstalled: boolean;
  enrichMetadata: boolean;
};

export type BulkAddSummary = FileImportSummary & {
  parsed: number;
  metadataFound: number;
  metadataMissing: number;
};

export async function bulkAddGames(input: BulkAddInput): Promise<BulkAddSummary> {
  await ensureDatabaseReady();
  const titles = parseBulkTitles(input.text);
  const games: ImportedGameInput[] = [];
  let metadataFound = 0;
  let metadataMissing = 0;

  for (const title of titles) {
    const metadata = input.enrichMetadata ? await fetchMetadataForTitle(title) : null;
    const hasMetadata = Boolean(
      metadata?.coverPath || metadata?.releaseYear !== null || (metadata?.genres.length ?? 0) > 0,
    );

    if (input.enrichMetadata && hasMetadata) {
      metadataFound += 1;
    } else if (input.enrichMetadata) {
      metadataMissing += 1;
    }

    games.push({
      title,
      releaseYear: metadata?.releaseYear ?? null,
      genreNames: metadata?.genres ?? [],
      platformNames: [input.platformName],
      coverPath: metadata?.coverPath ?? null,
      isPlayed: false,
      isCompleted: false,
      isFavorite: false,
      isInstalled: input.isInstalled,
      notes: null,
      personalRating: null,
      externalId: null,
      externalSource: null,
    });
  }

  const summary = await importExternalGames(games);
  return {
    ...summary,
    parsed: titles.length,
    metadataFound,
    metadataMissing,
  };
}

function parseBulkTitles(text: string) {
  return Array.from(
    new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  );
}
