import {
  BarChart3,
  Gamepad2,
  Heart,
  Home,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { PageDefinition, PageId } from "../../types/navigation";
import styles from "./Sidebar.module.css";

const icons = {
  home: Home,
  games: Gamepad2,
  favorites: Heart,
  stats: BarChart3,
  health: ShieldCheck,
  settings: Settings,
} satisfies Record<PageId, typeof Home>;

type SidebarProps = {
  activePageId: PageId;
  pages: PageDefinition[];
  onNavigate: (pageId: PageId) => void;
};

export function Sidebar({ activePageId, pages, onNavigate }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <aside className={isExpanded ? styles.sidebar : `${styles.sidebar} ${styles.collapsed}`}>
      <div className={styles.brandRow}>
        <button
          className={styles.menuButton}
          type="button"
          aria-label={isExpanded ? "Menüyü daralt" : "Menüyü aç"}
          onClick={() => setIsExpanded((current) => !current)}
        >
          <Menu size={22} />
        </button>
        <div className={styles.brand}>
          <Sparkles size={20} />
          <span>BGaming</span>
        </div>
      </div>

      <nav className={styles.navigation} aria-label="Ana menü">
        {pages.map((page) => {
          const Icon = icons[page.id];
          const isActive = page.id === activePageId;

          return (
            <button
              key={page.id}
              className={isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}
              type="button"
              title={page.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNavigate(page.id)}
            >
              <Icon className={styles.navIcon} size={21} />
              <span className={styles.navLabel}>{page.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
