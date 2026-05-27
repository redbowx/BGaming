import { invoke } from "@tauri-apps/api/core";
import {
  importExternalGames,
  type FileImportSummary,
  type ImportedGameInput,
} from "../database/repositories/gameRepository";
import { ensureDatabaseReady } from "../database/ready";
import { isTauriRuntime } from "../utils/tauriRuntime";

export type ImportKind = "csv" | "json" | "playnite";

type ImportFileResult = {
  path: string;
  content: string;
};

type RawGameRecord = Record<string, unknown>;

type ParsedImport = {
  games: ImportedGameInput[];
  parsedRows: number;
  skippedRows: number;
  errors: number;
};

const titleKeys = ["siralamaismi", "isim", "name", "title", "oyunadi", "gamename", "game"];
const genreKeys = ["turler", "tur", "genres", "genre", "categories", "kategori"];
const platformKeys = ["platformlar", "platform", "platforms", "platformsname"];
const sourceKeys = ["kaynaklar", "kaynak", "source", "sources", "library", "store"];
const releaseKeys = ["cikistarihi", "cikisyili", "releaseyear", "releasedate", "year", "date"];
const favoriteKeys = ["favori", "isfavorite", "favorite", "favourite"];
const installedKeys = ["kurulu", "isinstalled", "installed"];
const completedKeys = ["tamamlandi", "iscompleted", "completed", "finished"];
const playedKeys = ["oynandi", "isplayed", "played"];
const completionStatusKeys = ["tamamlanmadurumu", "completionstatus", "completion", "status"];
const notesKeys = ["notlar", "not", "notes", "note", "comment"];
const ratingKeys = ["kullanicipuani", "puan", "personalrating", "rating", "score", "userscore"];
const coverKeys = ["kapak", "kapakyolu", "coverpath", "cover", "image", "icon", "backgroundimage", "coverimage"];
const externalIdKeys = ["id", "playniteid", "externalid", "external_id"];

export async function importLibraryFile(kind: ImportKind): Promise<FileImportSummary & { parsed: number }> {
  ensureTauriRuntime();
  await ensureDatabaseReady();
  const file = await invoke<ImportFileResult | null>("select_import_file", { kind });

  if (!file) {
    return createEmptySummary(0);
  }

  const parsed = await parseImportFile(kind, file);
  const summary = await importExternalGames(parsed.games);

  return {
    ...summary,
    parsed: parsed.parsedRows,
    skipped: summary.skipped + parsed.skippedRows,
    errors: summary.errors + parsed.errors,
  };
}

function createEmptySummary(parsed: number): FileImportSummary & { parsed: number } {
  return {
    added: 0,
    existing: 0,
    updated: 0,
    platformsUpdated: 0,
    skipped: 0,
    duplicateCandidates: 0,
    errors: 0,
    parsed,
  };
}

async function parseImportFile(kind: ImportKind, file: ImportFileResult): Promise<ParsedImport> {
  const fileName = file.path.toLocaleLowerCase("tr-TR");
  const content = file.content.replace(/^\uFEFF/, "");
  const trimmedContent = content.trimStart();
  const shouldParseCsv =
    kind === "csv" ||
    fileName.endsWith(".csv") ||
    (kind === "playnite" && !trimmedContent.startsWith("{") && !trimmedContent.startsWith("[") && looksLikeCsv(content));

  if (shouldParseCsv) {
    return normalizeRecords(parseCsv(content), file.path, kind);
  }

  try {
    const json = JSON.parse(content) as unknown;
    return normalizeRecords(extractJsonRecords(json, kind), file.path, kind);
  } catch {
    throw new Error("Dosya JSON olarak okunamadı. Playnite için CSV dosyası seçtiysen Playnite içe aktar seçeneğini kullanabilirsin.");
  }
}

function parseCsv(content: string): RawGameRecord[] {
  const lines = content.split(/\r?\n/).filter((row) => row.trim().length > 0);
  const delimiter = detectDelimiter(lines[0] ?? "");
  const rows = lines.map((line) => parseCsvLine(line, delimiter));
  const headers = rows.shift()?.map((header) => normalizeKey(header)) ?? [];

  if (!headers.some((header) => titleKeys.includes(header))) {
    throw new Error(
      "CSV dosyasında oyun adı kolonu bulunamadı. Desteklenen kolonlar: Sıralama İsmi, İsim, Name, Title, Oyun Adı.",
    );
  }

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

function detectDelimiter(headerLine: string) {
  const semicolonCount = countOutsideQuotes(headerLine, ";");
  const commaCount = countOutsideQuotes(headerLine, ",");
  return semicolonCount >= commaCount ? ";" : ",";
}

function countOutsideQuotes(line: string, delimiter: string) {
  let count = 0;
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      index += 1;
    } else if (character === '"') {
      isQuoted = !isQuoted;
    } else if (character === delimiter && !isQuoted) {
      count += 1;
    }
  }

  return count;
}

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      isQuoted = !isQuoted;
    } else if (character === delimiter && !isQuoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

function looksLikeCsv(content: string) {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  return countOutsideQuotes(firstLine, ";") > 0 || countOutsideQuotes(firstLine, ",") > 1;
}

function extractJsonRecords(json: unknown, kind: ImportKind): RawGameRecord[] {
  if (Array.isArray(json)) return json.filter(isRecord);
  if (!isRecord(json)) return [];

  const candidateKeys =
    kind === "playnite"
      ? ["games", "Games", "items", "Items", "library", "Library", "PlayniteLibrary"]
      : ["games", "Games", "items", "Items"];

  for (const key of candidateKeys) {
    const value = json[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }

  return [json];
}

async function normalizeRecords(records: RawGameRecord[], filePath: string, kind: ImportKind): Promise<ParsedImport> {
  const baseDir = filePath.replace(/[\\/][^\\/]*$/, "");
  const games: ImportedGameInput[] = [];
  let skippedRows = 0;
  let errors = 0;

  for (const record of records) {
    try {
      const title = getString(record, titleKeys);
      if (!title) {
        skippedRows += 1;
        continue;
      }

      const rawCoverPath = getString(record, coverKeys);
      const coverPath = rawCoverPath ? await copyImportCover(resolveRelativePath(rawCoverPath, baseDir)) : null;
      const completionState = getCompletionState(record);
      const sourcePlatforms = getStringList(record, sourceKeys);
      const platformNames = normalizePlatformNames([...getStringList(record, platformKeys), ...sourcePlatforms]);
      const externalId = getString(record, externalIdKeys) || null;

      games.push({
        title,
        releaseYear: getYear(record),
        genreNames: sortUnique(getStringList(record, genreKeys)),
        platformNames,
        coverPath,
        isPlayed: getBoolean(record, playedKeys, completionState.isPlayed),
        isCompleted: getBoolean(record, completedKeys, completionState.isCompleted),
        isFavorite: getBoolean(record, favoriteKeys, false),
        isInstalled: getBoolean(record, installedKeys, false),
        notes: getString(record, notesKeys) || null,
        personalRating: getRating(record),
        externalId,
        externalSource: externalId ? getExternalSource(kind) : null,
      });
    } catch {
      errors += 1;
    }
  }

  return {
    games,
    parsedRows: records.length,
    skippedRows,
    errors,
  };
}

async function copyImportCover(path: string) {
  try {
    return await invoke<string | null>("copy_import_cover", { path });
  } catch {
    return null;
  }
}

function getString(record: RawGameRecord, keys: string[]) {
  for (const key of keys) {
    const value = getValue(record, key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return "";
}

function getStringList(record: RawGameRecord, keys: string[]) {
  for (const key of keys) {
    const value = getValue(record, key);
    if (Array.isArray(value)) return value.map(formatListValue).filter(Boolean);
    if (typeof value === "string" && value.trim()) return splitList(value);
  }

  return [];
}

function getYear(record: RawGameRecord) {
  const rawValue = getFirstValue(record, releaseKeys);
  if (typeof rawValue === "number" && rawValue >= 1970 && rawValue <= 2100) return rawValue;
  if (typeof rawValue === "string") {
    const year = rawValue.match(/\b(19|20)\d{2}\b/)?.[0];
    const parsed = Number(year);
    return parsed >= 1970 && parsed <= 2100 ? parsed : null;
  }

  return null;
}

function getRating(record: RawGameRecord) {
  const value = getFirstValue(record, ratingKeys);
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  const normalized = parsed > 10 && parsed <= 100 ? Math.round(parsed / 10) : Math.round(parsed);
  return normalized >= 1 && normalized <= 10 ? normalized : null;
}

function getCompletionState(record: RawGameRecord) {
  const value = getString(record, completionStatusKeys);
  const normalized = normalizeText(value);

  if (!normalized) return { isPlayed: false, isCompleted: false };
  if (normalized.includes("tamamlanmadi") || normalized.includes("notcompleted")) {
    return { isPlayed: false, isCompleted: false };
  }
  if (normalized.includes("tamam") || normalized.includes("completed") || normalized.includes("finished")) {
    return { isPlayed: true, isCompleted: true };
  }
  if (normalized.includes("yarim") || normalized.includes("abandoned")) {
    return { isPlayed: true, isCompleted: false };
  }
  if (normalized.includes("oynaniyor") || normalized.includes("playing") || normalized.includes("played")) {
    return { isPlayed: true, isCompleted: false };
  }
  if (normalized.includes("oynanmadi") || normalized.includes("unplayed") || normalized.includes("notplayed")) {
    return { isPlayed: false, isCompleted: false };
  }

  return { isPlayed: false, isCompleted: false };
}

function getBoolean(record: RawGameRecord, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = getValue(record, key);
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") {
      const normalized = normalizeText(value);
      if (["true", "1", "yes", "evet", "var", "kurulu", "installed", "favori"].includes(normalized)) return true;
      if (["false", "0", "no", "hayir", "yok", "degil", "notinstalled"].includes(normalized)) return false;
    }
  }

  return fallback;
}

function getFirstValue(record: RawGameRecord, keys: string[]) {
  for (const key of keys) {
    const value = getValue(record, key);
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return null;
}

function getValue(record: RawGameRecord, normalizedKey: string) {
  const entry = Object.entries(record).find(([key]) => normalizeKey(key) === normalizedKey);
  return entry?.[1];
}

function normalizeKey(key: string) {
  return normalizeText(key).replace(/[^a-z0-9]/g, "");
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

function splitList(value: string) {
  return value
    .split(/[|;,/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePlatformNames(values: string[]) {
  return sortUnique(values.map(normalizePlatformName).filter(Boolean));
}

function normalizePlatformName(value: string) {
  const cleanValue = value.trim();
  const normalized = normalizeKey(cleanValue);

  if (!normalized) return "";
  if (normalized.includes("steam")) return "Steam";
  if (normalized.includes("epic")) return "Epic Games";
  if (normalized.includes("gog")) return "GOG";
  if (normalized.includes("ubisoft")) return "Ubisoft Connect";
  if (["ea", "eaapp", "origin"].includes(normalized) || normalized.includes("electronicarts")) return "EA App";
  if (normalized === "amazonluna") return "Amazon Luna";
  if (["amazon", "amazongames"].includes(normalized)) return "Amazon Games";
  if (["diger", "other"].includes(normalized)) return "Diğer";
  if (["manual", "manuel", "unknown", "bilinmeyen"].includes(normalized)) return "Manuel / Bilinmeyen";

  return cleanValue;
}

function sortUnique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
}

function formatListValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (isRecord(value)) {
    const name = getString(value, ["name", "title", "isim"]);
    return name.trim();
  }
  return "";
}

function resolveRelativePath(path: string, baseDir: string) {
  if (/^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\")) return path;
  return `${baseDir}\\${path}`;
}

function getExternalSource(kind: ImportKind) {
  if (kind === "playnite") return "playnite";
  return kind;
}

function isRecord(value: unknown): value is RawGameRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureTauriRuntime() {
  if (!isTauriRuntime()) {
    throw new Error("Dosya içe aktarma işlemleri masaüstü Tauri uygulamasında çalışır.");
  }
}
