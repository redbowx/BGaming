import { Minimize2 } from "lucide-react";
import { useState } from "react";
import { MiniLauncher } from "../components/launcher/MiniLauncher";
import { ReleaseUpdateNotice } from "../components/common/ReleaseUpdateNotice";
import { Sidebar } from "../components/sidebar/Sidebar";
import { setMiniWindowMode } from "../services/windowModeService";
import type { PageDefinition, PageId } from "../types/navigation";
import styles from "./AppLayout.module.css";

type AppLayoutProps = {
  activePage: PageDefinition;
  pages: PageDefinition[];
  onNavigate: (pageId: PageId) => void;
};

export function AppLayout({ activePage, pages, onNavigate }: AppLayoutProps) {
  const [isMiniMode, setIsMiniMode] = useState(false);
  const PageComponent = activePage.component;

  const toggleMiniMode = async (enabled: boolean) => {
    await setMiniWindowMode(enabled);
    setIsMiniMode(enabled);
  };

  if (isMiniMode) {
    return <MiniLauncher onExit={() => toggleMiniMode(false)} />;
  }

  return (
    <div className={styles.shell}>
      <Sidebar
        activePageId={activePage.id}
        pages={pages}
        onNavigate={onNavigate}
      />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Kişisel oyun kütüphanesi</p>
            <h1 className={styles.title}>{activePage.label}</h1>
          </div>
          <button className={styles.miniModeButton} type="button" onClick={() => void toggleMiniMode(true)}>
            <Minimize2 size={17} />
            Mini Mod
          </button>
        </header>
        <section className={styles.content}>
          <PageComponent />
        </section>
        <ReleaseUpdateNotice />
      </main>
    </div>
  );
}
