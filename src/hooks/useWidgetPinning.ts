import { useEffect, useState } from "react";
import { getAppSettings, saveAppSettings } from "../services/settingsService";
import {
  getCurrentWidgetPosition,
  restoreWidgetPosition,
  type DesktopWidgetKind,
} from "../services/widgetWindowService";
import type { AppSettings } from "../types/settings";

type WidgetPlacement = {
  pinned: boolean;
  x: number | null;
  y: number | null;
};

export function useWidgetPinning(kind: DesktopWidgetKind) {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void getAppSettings().then(async (settings) => {
      const placement = getWidgetPlacement(kind, settings);
      if (placement.pinned) {
        await restoreWidgetPosition(placement.x, placement.y);
      }
      if (isMounted) {
        setIsPinned(placement.pinned);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [kind]);

  const togglePinned = async () => {
    const pinned = !isPinned;
    if (!pinned) {
      await saveAppSettings(createWidgetPinUpdate(kind, false));
      setIsPinned(false);
      return;
    }

    const position = await getCurrentWidgetPosition();
    await saveAppSettings(createWidgetPinUpdate(kind, true, position?.x ?? null, position?.y ?? null));
    setIsPinned(true);
  };

  return { isPinned, togglePinned };
}

function getWidgetPlacement(kind: DesktopWidgetKind, settings: AppSettings): WidgetPlacement {
  if (kind === "quickLauncher") {
    return {
      pinned: settings.quickLauncherWidgetPinned,
      x: settings.quickLauncherWidgetPositionX,
      y: settings.quickLauncherWidgetPositionY,
    };
  }

  return {
    pinned: settings.surpriseWidgetPinned,
    x: settings.surpriseWidgetPositionX,
    y: settings.surpriseWidgetPositionY,
  };
}

function createWidgetPinUpdate(
  kind: DesktopWidgetKind,
  pinned: boolean,
  x: number | null = null,
  y: number | null = null,
): Partial<AppSettings> {
  if (kind === "quickLauncher") {
    return {
      quickLauncherWidgetPinned: pinned,
      ...(pinned ? { quickLauncherWidgetPositionX: x, quickLauncherWidgetPositionY: y } : {}),
    };
  }

  return {
    surpriseWidgetPinned: pinned,
    ...(pinned ? { surpriseWidgetPositionX: x, surpriseWidgetPositionY: y } : {}),
  };
}
