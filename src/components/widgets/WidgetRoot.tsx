import type { DesktopWidgetKind } from "../../services/widgetWindowService";
import { QuickLauncherWidget } from "./QuickLauncherWidget";
import { SurpriseWidget } from "./SurpriseWidget";

export function WidgetRoot({ kind }: { kind: DesktopWidgetKind }) {
  return kind === "quickLauncher" ? <QuickLauncherWidget /> : <SurpriseWidget />;
}
