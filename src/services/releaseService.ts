import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../utils/tauriRuntime";

type GithubReleaseInfo = {
  version: string;
  url: string;
};

export type AvailableRelease = {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
};

const browserPreviewVersion = "1.0.0";

export async function getApplicationVersion() {
  return isTauriRuntime() ? getVersion() : browserPreviewVersion;
}

export function formatDisplayVersion(version: string) {
  const cleanVersion = normalizeVersion(version);
  return cleanVersion.endsWith(".0") ? cleanVersion.slice(0, -2) : cleanVersion;
}

export async function checkForAvailableRelease(): Promise<AvailableRelease | null> {
  if (!isTauriRuntime()) return null;

  const [currentVersion, latestRelease] = await Promise.all([
    getApplicationVersion(),
    invoke<GithubReleaseInfo>("fetch_latest_github_release"),
  ]);

  if (compareVersions(latestRelease.version, currentVersion) <= 0) return null;

  return {
    currentVersion,
    latestVersion: normalizeVersion(latestRelease.version),
    releaseUrl: latestRelease.url,
  };
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left).split(".").map(Number);
  const rightParts = normalizeVersion(right).split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, "").split("-")[0];
}
