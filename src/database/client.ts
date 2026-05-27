import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { appConfig } from "../app/config";
import { getErrorMessage } from "../utils/errorMessage";
import { isTauriRuntime } from "../utils/tauriRuntime";

let database: Database | null = null;
let databaseUrl: string | null = null;
let writeQueue: Promise<void> = Promise.resolve();

type AppStoragePaths = {
  databaseUrl: string;
  coversDir: string;
};

export async function getDatabase() {
  if (!database) {
    database = await Database.load(await getDatabaseUrl());
    await configureDatabaseConnection(database);
  }

  return database;
}

export async function closeDatabaseConnection() {
  if (!database) {
    return;
  }

  try {
    await database.close();
  } finally {
    database = null;
  }
}

export async function runDatabaseWrite<T>(operation: () => Promise<T>): Promise<T> {
  const queuedOperation = writeQueue.then(
    () => retryLockedDatabaseOperation(operation),
    () => retryLockedDatabaseOperation(operation),
  );

  writeQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  );

  return queuedOperation;
}

async function retryLockedDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isDatabaseLockedError(error) || attempt === 5) {
        throw error;
      }

      await wait(180 + attempt * 260);
    }
  }

  throw lastError;
}

async function configureDatabaseConnection(activeDatabase: Database) {
  for (const statement of [
    "PRAGMA busy_timeout = 10000",
    "PRAGMA journal_mode = WAL",
    "PRAGMA foreign_keys = ON",
  ]) {
    try {
      await activeDatabase.execute(statement);
    } catch (error) {
      console.warn(`Database connection setting failed: ${statement}`, error);
    }
  }
}

function isDatabaseLockedError(error: unknown) {
  const message = getErrorMessage(error).toLocaleLowerCase("en-US");
  return message.includes("database is locked") || message.includes("database table is locked");
}

function wait(durationMs: number) {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

async function getDatabaseUrl() {
  if (databaseUrl) {
    return databaseUrl;
  }

  if (!isTauriRuntime()) {
    databaseUrl = appConfig.databaseUrl;
    return databaseUrl;
  }

  const paths = await invoke<AppStoragePaths>("get_app_storage_paths");
  databaseUrl = paths.databaseUrl;
  return databaseUrl;
}
