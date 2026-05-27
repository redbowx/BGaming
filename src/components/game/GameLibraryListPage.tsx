import { useEffect, useState } from "react";
import { GameCard } from "./GameCard";
import { GameDetailModal } from "./GameDetailModal";
import { GameFormModal } from "./GameFormModal";
import {
  removeGame,
  saveGameInstallFolder,
  saveGameDetails,
  updateManualGame,
} from "../../services/gameService";
import { selectGameInstallFolder } from "../../services/gameLaunchService";
import { getGenres, getPlatforms } from "../../services/libraryMetadataService";
import {
  applyGameCoverCandidate,
  findGameCoverCandidates,
  refreshMissingGameMetadata,
  type CoverCandidate,
} from "../../services/metadataService";
import { refreshGameLanguageSupport } from "../../services/languageSupportService";
import type { Game, GameFormInput, Genre, Platform } from "../../types/game";
import styles from "./GameLibraryListPage.module.css";

type GameLibraryListPageProps = {
  title: string;
  description: string;
  emptyMessage: string;
  loadGames: () => Promise<Game[]>;
};

export function GameLibraryListPage({
  title,
  description,
  emptyMessage,
  loadGames,
}: GameLibraryListPageProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [editingGame, setEditingGame] = useState<Game | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    const [loadedGames, loadedGenres, loadedPlatforms] = await Promise.all([
      loadGames(),
      getGenres(),
      getPlatforms(),
    ]);
    setGames(loadedGames);
    setGenres(loadedGenres);
    setPlatforms(loadedPlatforms);
    return loadedGames;
  };

  useEffect(() => {
    void refresh().finally(() => setIsLoading(false));
  }, []);

  const handleSaveGame = async (input: Parameters<typeof saveGameDetails>[0]) => {
    const updatedGame = await saveGameDetails(input);
    const loadedGames = await refresh();
    setSelectedGame(loadedGames.find((game) => game.id === updatedGame.id) ?? null);
  };

  const handleSaveGameForm = async (input: GameFormInput) => {
    if (!editingGame) return;

    const updatedGame = await updateManualGame({ ...input, id: editingGame.id });
    const loadedGames = await refresh();
    setSelectedGame(loadedGames.find((game) => game.id === updatedGame.id) ?? null);
    setEditingGame(undefined);
  };

  const handleDeleteGame = async (game: Game) => {
    await removeGame(game);
    await refresh();
    setSelectedGame(null);
  };

  const handleApplyCoverCandidate = async (game: Game, candidate: CoverCandidate) => {
    const result = await applyGameCoverCandidate(game, candidate);
    const loadedGames = await refresh();
    setSelectedGame(loadedGames.find((item) => item.id === result.game.id) ?? result.game);
    return result.message;
  };

  const handleRefreshMetadata = async (game: Game) => {
    const result = await refreshMissingGameMetadata(game);
    const loadedGames = await refresh();
    setSelectedGame(loadedGames.find((item) => item.id === result.game.id) ?? result.game);
    return result.message;
  };

  const handleRefreshLanguageSupport = async (game: Game) => {
    const result = await refreshGameLanguageSupport(game);
    const loadedGames = await refresh();
    setSelectedGame(loadedGames.find((item) => item.id === result.game.id) ?? result.game);
    return result.message;
  };

  const handleSelectInstallFolder = async (game: Game) => {
    const folder = await selectGameInstallFolder();
    if (!folder) {
      return "Klasör seçilmedi.";
    }

    const updatedGame = await saveGameInstallFolder(game, folder);
    const loadedGames = await refresh();
    setSelectedGame(loadedGames.find((item) => item.id === updatedGame.id) ?? updatedGame);

    return "Oyun klasörü kaydedildi ve oyun yüklü olarak işaretlendi.";
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h2>{title}</h2>
          <p>{isLoading ? "Yükleniyor" : description}</p>
        </div>
        <span>{games.length} oyun</span>
      </header>

      {games.length > 0 ? (
        <div className={styles.grid}>
          {games.map((game) => (
            <GameCard key={game.id} game={game} onClick={setSelectedGame} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>{isLoading ? "Oyunlar hazırlaniyor." : emptyMessage}</div>
      )}

      {selectedGame ? (
        <GameDetailModal
          game={selectedGame}
          platforms={platforms}
          onClose={() => setSelectedGame(null)}
          onSave={handleSaveGame}
          onEdit={(game) => {
            setEditingGame(game);
            setSelectedGame(null);
          }}
          onDelete={handleDeleteGame}
          onFindCoverCandidates={findGameCoverCandidates}
          onApplyCoverCandidate={handleApplyCoverCandidate}
          onRefreshMetadata={handleRefreshMetadata}
          onRefreshLanguageSupport={handleRefreshLanguageSupport}
          onSelectInstallFolder={handleSelectInstallFolder}
        />
      ) : null}

      {editingGame ? (
        <GameFormModal
          mode="edit"
          game={editingGame}
          genres={genres}
          platforms={platforms}
          onClose={() => setEditingGame(undefined)}
          onSave={handleSaveGameForm}
        />
      ) : null}
    </div>
  );
}
