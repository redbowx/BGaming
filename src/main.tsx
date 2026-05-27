import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { App } from "./app/App";
import { ThemeProvider } from "./app/theme/ThemeProvider";
import { WidgetRoot } from "./components/widgets/WidgetRoot";
import type { DesktopWidgetKind } from "./services/widgetWindowService";
import { disableContextMenu } from "./utils/disableContextMenu";
import { isTauriRuntime } from "./utils/tauriRuntime";
import "./styles/global.css";

disableContextMenu();

function resolveWidgetKind(): DesktopWidgetKind | null {
  if (isTauriRuntime()) {
    const label = getCurrentWebviewWindow().label;
    if (label === "quick-launcher-widget") return "quickLauncher";
    if (label === "surprise-widget") return "surprise";
  }

  const browserPreviewKind = new URLSearchParams(window.location.search).get("widget");
  return browserPreviewKind === "quickLauncher" || browserPreviewKind === "surprise"
    ? browserPreviewKind
    : null;
}

const widgetKind = resolveWidgetKind();
document.documentElement.classList.toggle("widgetWindow", widgetKind !== null);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {widgetKind === "quickLauncher" || widgetKind === "surprise" ? (
      <ThemeProvider>
        <WidgetRoot kind={widgetKind} />
      </ThemeProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
