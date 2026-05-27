import { invoke } from "@tauri-apps/api/core";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppSettings } from "../types/settings";
import { isTauriRuntime } from "../utils/tauriRuntime";

export type DesktopWidgetKind = "quickLauncher" | "surprise";

export async function setDesktopWidgetOpen(
  kind: DesktopWidgetKind,
  open: boolean,
) {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("set_widget_open", { kind, open });
}

export async function startWidgetDragging() {
  if (!isTauriRuntime()) {
    return;
  }

  await getCurrentWindow().startDragging();
}

export async function getCurrentWidgetPosition() {
  if (!isTauriRuntime()) {
    return null;
  }

  return getCurrentWindow().outerPosition();
}

export async function restoreWidgetPosition(x: number | null, y: number | null) {
  if (!isTauriRuntime() || x === null || y === null) {
    return;
  }

  await getCurrentWindow().setPosition(new PhysicalPosition(x, y));
}

export async function restoreEnabledWidgets(settings: AppSettings) {
  await Promise.all([
    settings.quickLauncherWidgetEnabled
      ? setDesktopWidgetOpen("quickLauncher", true)
      : Promise.resolve(),
    settings.surpriseWidgetEnabled
      ? setDesktopWidgetOpen("surprise", true)
      : Promise.resolve(),
  ]);
}
