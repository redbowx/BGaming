import { GameLibraryListPage } from "../components/game/GameLibraryListPage";
import { getFavoriteGames } from "../services/gameService";

export function FavoritesPage() {
  return (
    <GameLibraryListPage
      title="Favori oyunlar"
      description="Favori olarak isaretlenen oyunlar listeleniyor."
      emptyMessage="Henüz favori oyun yok."
      loadGames={getFavoriteGames}
    />
  );
}
