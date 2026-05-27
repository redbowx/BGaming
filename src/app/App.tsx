import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "../layouts/AppLayout";
import { pageRegistry } from "../pages/pageRegistry";
import { ThemeProvider } from "./theme/ThemeProvider";
import type { PageId } from "../types/navigation";
import { getAppSettings } from "../services/settingsService";
import { restoreEnabledWidgets } from "../services/widgetWindowService";
import { applyCloseButtonBehavior } from "../services/closeBehaviorService";

export function App() {
  const [activePageId, setActivePageId] = useState<PageId>("home");

  useEffect(() => {
    void getAppSettings()
      .then(async (settings) => {
        await applyCloseButtonBehavior(settings.closeButtonBehavior);
        await restoreEnabledWidgets(settings);
      })
      .catch(() => undefined);
  }, []);

  const activePage = useMemo(
    () => pageRegistry.find((page) => page.id === activePageId) ?? pageRegistry[0],
    [activePageId],
  );

  return (
    <ThemeProvider>
      <AppLayout
        activePage={activePage}
        pages={pageRegistry}
        onNavigate={setActivePageId}
      />
    </ThemeProvider>
  );
}
