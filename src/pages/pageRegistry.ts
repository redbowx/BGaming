import { CollectionHealthPage } from "./CollectionHealthPage";
import { FavoritesPage } from "./FavoritesPage";
import { GamesPage } from "./GamesPage";
import { HomePage } from "./HomePage";
import { SettingsPage } from "./SettingsPage";
import { StatsPage } from "./StatsPage";
import type { PageDefinition } from "../types/navigation";

export const pageRegistry: PageDefinition[] = [
  { id: "home", label: "Anasayfa", component: HomePage },
  { id: "games", label: "Oyunlarım", component: GamesPage },
  { id: "favorites", label: "Favoriler", component: FavoritesPage },
  { id: "stats", label: "İstatistikler", component: StatsPage },
  { id: "health", label: "Koleksiyon Sağlığı", component: CollectionHealthPage },
  { id: "settings", label: "Ayarlar", component: SettingsPage },
];
