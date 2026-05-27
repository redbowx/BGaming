import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./tauriRuntime";

export function getCoverSource(path: string | null) {
  if (!path) {
    return null;
  }

  return isTauriRuntime() ? convertFileSrc(path) : path;
}
