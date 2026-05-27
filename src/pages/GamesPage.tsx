import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { GameCard } from "../components/game/GameCard";
import { CustomSelect } from "../components/common/CustomSelect";
import { GameDetailModal } from "../components/game/GameDetailModal";
import { GameFormModal } from "../components/game/GameFormModal";
import { LibraryImportModal } from "../components/game/LibraryImportModal";
import {
  createManualGame,
  getGames,
  reconcileInstalledGameStates,
  removeGame,
  saveGameInstallFolder,
  saveGameDetails,
  updateManualGame,
} from "../services/gameService";
import { getGenres, getPlatforms } from "../services/libraryMetadataService";
import {
  applyGameCoverCandidate,
  findGameCoverCandidates,
  refreshMissingGameMetadata,
  type CoverCandidate,
} from "../services/metadataService";
import { refreshGameLanguageSupport } from "../services/languageSupportService";
import { getAppSettings, saveAppSettings } from "../services/settingsService";
import { launchGame, revealGameFolder, selectGameInstallFolder } from "../services/gameLaunchService";
import { syncTrustedInstalledGames } from "../services/installedScanService";
import type {
  Game,
  GameFormInput,
  Genre,
  MultiplayerType,
  Platform,
  SteamDeckCompatibility,
} from "../types/game";
import type { GridColumns } from "../types/settings";
import { compareGenreNamesByDisplay, getGenreDisplayName, isUsefulGenreName } from "../utils/genreDisplay";
import { normalizeTitle } from "../utils/normalizeTitle";
import styles from "./GamesPage.module.css";

type TriStateFilter = "all" | "yes" | "no";

type GameFilters = {
  search: string;
  genreNames: string[];
  releaseYear: string;
  platformName: string;
  played: TriStateFilter;
  completed: TriStateFilter;
  favorite: TriStateFilter;
  rating: TriStateFilter;
  multiplayerType: "all" | MultiplayerType;
  steamDeckCompatible: "all" | SteamDeckCompatibility;
  currentlyPlaying: TriStateFilter;
  abandoned: TriStateFilter;
};

const pageSize = 12;
const gridColumnOptions: GridColumns[] = [4, 5, 6];
const gridColumnLabels: Record<GridColumns, string> = {
  4: "4'lü sıralama",
  5: "5'li sıralama",
  6: "6'lı sıralama",
};
const emptyFilters: GameFilters = {
  search: "",
  genreNames: [],
  releaseYear: "all",
  platformName: "all",
  played: "all",
  completed: "all",
  favorite: "all",
  rating: "all",
  multiplayerType: "all",
  steamDeckCompatible: "all",
  currentlyPlaying: "all",
  abandoned: "all",
};

export function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [filters, setFilters] = useState<GameFilters>(emptyFilters);
  const [gridColumns, setGridColumns] = useState<GridColumns>(5);
  const [showAllGames, setShowAllGames] = useState(true);
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingGame, setEditingGame] = useState<Game | undefined>();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    void Promise.all([getGames(), getGenres(), getPlatforms(), getAppSettings()])
      .then(([loadedGames, loadedGenres, loadedPlatforms, settings]) => {
        setGames(loadedGames);
        setGenres(loadedGenres);
        setPlatforms(loadedPlatforms);
        setGridColumns(settings.gridColumns);
        setShowAllGames(settings.showAllGames);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const refreshLibrary = async () => {
    const [loadedGames, loadedGenres, loadedPlatforms] = await Promise.all([
      getGames(),
      getGenres(),
      getPlatforms(),
    ]);

    setGames(loadedGames);
    setGenres(loadedGenres);
    setPlatforms(loadedPlatforms);
    return loadedGames;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const releaseYears = useMemo(
    () =>
      [...new Set(games.map((game) => game.releaseYear).filter((year): year is number => year !== null))]
        .sort((a, b) => b - a),
    [games],
  );
  const sortedGenres = useMemo(
    () =>
      [...genres]
        .filter((genre) => isUsefulGenreName(genre.name))
        .sort((first, second) => compareGenreNamesByDisplay(first.name, second.name)),
    [genres],
  );

  const filteredGames = useMemo(
    () =>
      games
        .filter((game) => !showInstalledOnly || game.isInstalled)
        .filter((game) => matchesFilters(game, filters)),
    [filters, games, showInstalledOnly],
  );

  const totalPages = Math.max(1, Math.ceil(filteredGames.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const visibleGames = useMemo(() => {
    if (showAllGames) {
      return filteredGames;
    }

    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredGames.slice(startIndex, startIndex + pageSize);
  }, [filteredGames, safeCurrentPage, showAllGames]);

  const handleGridColumnsChange = async (value: GridColumns) => {
    setGridColumns(value);
    await saveAppSettings({ gridColumns: value });
  };

  const handleShowAllGamesChange = async (value: boolean) => {
    setShowAllGames(value);
    setCurrentPage(1);
    await saveAppSettings({ showAllGames: value });
  };

  const syncInstalledLibrary = async (sourceGames: Game[], announce: boolean) => {
    const scanSummary = await syncTrustedInstalledGames();
    const reconciledGames = await reconcileInstalledGameStates(scanSummary.games);
    const removedCount = sourceGames.filter((game) => {
      const updatedGame = reconciledGames.find((item) => item.id === game.id);
      return game.isInstalled && updatedGame && !updatedGame.isInstalled;
    }).length;

    setGames(reconciledGames);
    if (!announce) {
      return;
    }

    const messages = [
      scanSummary.added > 0 ? `${scanSummary.added} yeni kurulu oyun bulundu` : null,
      scanSummary.installMarksSuggested > 0 ? `${scanSummary.installMarksSuggested} mevcut oyun yüklü işaretlendi` : null,
      removedCount > 0 ? `${removedCount} kaldırılmış oyun listeden çıkarıldı` : null,
    ].filter(Boolean);
    setNotice(messages.length > 0 ? `${messages.join(". ")}.` : "Yüklü oyunlar güncel görünüyor.");
    window.setTimeout(() => setNotice(null), 4200);
  };

  const handleShowInstalledOnlyChange = async (value: boolean) => {
    setShowInstalledOnly(value);
    setCurrentPage(1);

    if (!value) {
      return;
    }

    try {
      setNotice("Steam, Epic Games, Ubisoft Connect ve EA App kurulumları okunuyor...");
      await syncInstalledLibrary(games, true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Yüklü oyunlar doğrulanamadı.");
      window.setTimeout(() => setNotice(null), 4200);
    }
  };

  useEffect(() => {
    if (!showInstalledOnly) {
      return;
    }

    const handleFocus = () => {
      void syncInstalledLibrary(games, false).catch(() => undefined);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [games, showInstalledOnly]);

  const updateFilter = <Key extends keyof GameFilters>(key: Key, value: GameFilters[Key]) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  };

  const toggleGenre = (genreName: string) => {
    setFilters((currentFilters) => {
      const isSelected = currentFilters.genreNames.includes(genreName);

      return {
        ...currentFilters,
        genreNames: isSelected
          ? currentFilters.genreNames.filter((name) => name !== genreName)
          : [...currentFilters.genreNames, genreName],
      };
    });
  };

  const handleUpdateLibraryClick = () => {
    setIsImportModalOpen(true);
  };

  const handleSaveGame = async (input: Parameters<typeof saveGameDetails>[0]) => {
    const updatedGame = await saveGameDetails(input);

    setGames((currentGames) =>
      currentGames.map((game) => (game.id === updatedGame.id ? updatedGame : game)),
    );
    setSelectedGame(updatedGame);
  };

  const handlePlayInstalledGame = async (game: Game) => {
    try {
      const launchMessage = await launchGame(game);
      const updatedGame = await saveGameDetails({
        id: game.id,
        isPlayed: game.isPlayed,
        isCompleted: game.isCompleted,
        isFavorite: game.isFavorite,
        isCurrentlyPlaying: true,
        isAbandoned: game.isAbandoned,
        isWishlisted: game.isWishlisted,
        neverShowInRandom: game.neverShowInRandom,
        multiplayerType: game.multiplayerType,
        steamDeckCompatible: game.steamDeckCompatible,
        personalRating: game.personalRating,
        notes: game.notes,
        estimatedLength: game.estimatedLength,
        releaseYear: game.releaseYear,
      });

      setGames((currentGames) =>
        currentGames.map((item) => (item.id === updatedGame.id ? updatedGame : item)),
      );
      setSelectedGame((currentGame) =>
        currentGame?.id === updatedGame.id ? updatedGame : currentGame,
      );
      setNotice(launchMessage);
      window.setTimeout(() => setNotice(null), 2800);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Oyun başlatılamadı.");
      window.setTimeout(() => setNotice(null), 4200);
    }
  };

  const handleOpenGameFolder = async (game: Game) => {
    try {
      const message = await revealGameFolder(game);
      setNotice(message);
      window.setTimeout(() => setNotice(null), 2800);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Oyun klasörü açılamadı.");
      window.setTimeout(() => setNotice(null), 4200);
    }
  };

  const handleSelectInstallFolder = async (game: Game) => {
    const folder = await selectGameInstallFolder();
    if (!folder) {
      return "Klasör seçilmedi.";
    }

    const updatedGame = await saveGameInstallFolder(game, folder);
    setGames((currentGames) =>
      currentGames.map((item) => (item.id === updatedGame.id ? updatedGame : item)),
    );
    setSelectedGame(updatedGame);

    return "Oyun klasörü kaydedildi ve oyun yüklü olarak işaretlendi.";
  };

  const handleSaveGameForm = async (input: GameFormInput) => {
    let savedGame: Game;

    if (formMode === "edit" && editingGame) {
      savedGame = await updateManualGame({ ...input, id: editingGame.id });
    } else {
      savedGame = await createManualGame(input);
    }

    const loadedGames = await refreshLibrary();
    setSelectedGame(loadedGames.find((game) => game.id === savedGame.id) ?? savedGame);
    setFormMode(null);
    setEditingGame(undefined);
  };

  const handleEditGame = (game: Game) => {
    setEditingGame(game);
    setSelectedGame(null);
    setFormMode("edit");
  };

  const handleDeleteGame = async (game: Game) => {
    await removeGame(game);
    await refreshLibrary();
    setSelectedGame(null);
  };

  const handleApplyCoverCandidate = async (game: Game, candidate: CoverCandidate) => {
    const result = await applyGameCoverCandidate(game, candidate);
    const loadedGames = await refreshLibrary();
    setSelectedGame(loadedGames.find((item) => item.id === result.game.id) ?? result.game);
    return result.message;
  };

  const handleRefreshMetadata = async (game: Game) => {
    const result = await refreshMissingGameMetadata(game);
    const loadedGames = await refreshLibrary();
    setSelectedGame(loadedGames.find((item) => item.id === result.game.id) ?? result.game);
    return result.message;
  };

  const handleRefreshLanguageSupport = async (game: Game) => {
    const result = await refreshGameLanguageSupport(game);
    const loadedGames = await refreshLibrary();
    setSelectedGame(loadedGames.find((item) => item.id === result.game.id) ?? result.game);
    return result.message;
  };

  return (
    <div className={styles.page}>
      <section className={styles.library}>
        <div className={styles.toolbar}>
          <div>
            <h2>Oyunlarım</h2>
            <p>
              {isLoading
                ? "Kütüphane yükleniyor"
                : `${filteredGames.length} / ${games.length} oyun gösteriliyor`}
            </p>
          </div>

          <div className={styles.controls}>
            <CustomSelect
              className={styles.selectControl}
              value={String(gridColumns)}
              ariaLabel="Görünüm seçimi"
              options={gridColumnOptions.map((option) => ({
                label: gridColumnLabels[option],
                value: String(option),
              }))}
              onChange={(value) => void handleGridColumnsChange(Number(value) as GridColumns)}
            />

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showAllGames}
                onChange={(event) => void handleShowAllGamesChange(event.target.checked)}
              />
              Tümünü Göster
            </label>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showInstalledOnly}
                onChange={(event) => void handleShowInstalledOnlyChange(event.target.checked)}
              />
              Yüklü Oyunlar
            </label>
          </div>
        </div>

        {visibleGames.length > 0 ? (
          <div
            className={styles.grid}
            style={{ "--game-grid-columns": gridColumns } as CSSProperties}
          >
            {visibleGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onClick={setSelectedGame}
                onPlay={handlePlayInstalledGame}
                onOpenFolder={handleOpenGameFolder}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {isLoading
              ? "Oyunlar hazırlanıyor."
              : "Bu filtrelerle eşleşen oyun bulunamadı. Filtreleri temizleyip tekrar deneyebilirsin."}
          </div>
        )}

        {!showAllGames ? (
          <div className={styles.pagination}>
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Önceki
            </button>
            <span className={styles.pageNumber}>
              {safeCurrentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              Sonraki
            </button>
          </div>
        ) : null}
      </section>

      <aside className={styles.sidePanel}>
        <button
          className={styles.addButton}
          type="button"
          onClick={() => {
            setEditingGame(undefined);
            setFormMode("create");
          }}
        >
          Oyun Ekle
        </button>

        <button className={styles.updateButton} type="button" onClick={handleUpdateLibraryClick}>
          Kütüphaneyi Güncelle
        </button>
        <button className={styles.updateButton} type="button" onClick={handleUpdateLibraryClick}>
          Toplu Oyun Ekle
        </button>
        <button className={styles.updateButton} type="button" onClick={handleUpdateLibraryClick}>
          Yüklü Oyunları Tara
        </button>
        {notice ? <div className={styles.notice}>{notice}</div> : null}

        <div className={styles.field}>
          <label htmlFor="game-search">Arama</label>
          <input
            id="game-search"
            type="search"
            value={filters.search}
            placeholder="Oyun adı ara"
            onChange={(event) => updateFilter("search", event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label>Tür</label>
          <div className={styles.multiSelectList}>
            {sortedGenres.length > 0 ? (
              sortedGenres.map((genre) => (
                <label key={genre.id} className={styles.compactCheckbox}>
                  <input
                    type="checkbox"
                    checked={filters.genreNames.includes(genre.name)}
                    onChange={() => toggleGenre(genre.name)}
                  />
                  {getGenreDisplayName(genre.name)}
                </label>
              ))
            ) : (
              <span className={styles.mutedText}>Kayıtlı tür bulunamadı.</span>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <CustomSelect
            id="release-year"
            label="Çıkış yılı"
            value={filters.releaseYear}
            options={[
              { label: "Tüm yıllar", value: "all" },
              ...releaseYears.map((year) => ({ label: String(year), value: String(year) })),
            ]}
            onChange={(value) => updateFilter("releaseYear", value)}
          />
        </div>

        <div className={styles.field}>
          <CustomSelect
            id="platform"
            label="Platform"
            value={filters.platformName}
            options={[
              { label: "Tüm platformlar", value: "all" },
              ...platforms.map((platform) => ({ label: platform.name, value: platform.name })),
            ]}
            onChange={(value) => updateFilter("platformName", value)}
          />
        </div>

        <FilterSelect
          id="played-filter"
          label="Oynanma durumu"
          value={filters.played}
          yesLabel="Oynandı"
          noLabel="Oynanmadı"
          onChange={(value) => updateFilter("played", value)}
        />
        <FilterSelect
          id="completed-filter"
          label="Bitiş durumu"
          value={filters.completed}
          yesLabel="Bitti"
          noLabel="Bitmedi"
          onChange={(value) => updateFilter("completed", value)}
        />
        <FilterSelect
          id="favorite-filter"
          label="Favoriler"
          value={filters.favorite}
          yesLabel="Favoriler"
          noLabel="Favori olmayanlar"
          onChange={(value) => updateFilter("favorite", value)}
        />
        <FilterSelect
          id="rating-filter"
          label="Kişisel puan"
          value={filters.rating}
          yesLabel="Puanı olanlar"
          noLabel="Puanı olmayanlar"
          onChange={(value) => updateFilter("rating", value)}
        />

        <div className={styles.field}>
          <CustomSelect
            id="multiplayer-type"
            label="Oyuncu tipi"
            value={filters.multiplayerType}
            options={[
              { label: "Tümü", value: "all" },
              { label: "Tek oyunculu", value: "singleplayer" },
              { label: "Çok oyunculu", value: "multiplayer" },
              { label: "İkisi de", value: "both" },
              { label: "Bilinmiyor", value: "unknown" },
            ]}
            onChange={(value) => updateFilter("multiplayerType", value as GameFilters["multiplayerType"])}
          />
        </div>

        <div className={styles.field}>
          <CustomSelect
            id="steam-deck"
            label="Steam Deck uyumluluğu"
            value={filters.steamDeckCompatible}
            options={[
              { label: "Tümü", value: "all" },
              { label: "Uyumlu", value: "yes" },
              { label: "Uyumlu değil", value: "no" },
              { label: "Bilinmiyor", value: "unknown" },
            ]}
            onChange={(value) =>
              updateFilter("steamDeckCompatible", value as GameFilters["steamDeckCompatible"])
            }
          />
        </div>

        <FilterSelect
          id="currently-playing-filter"
          label="Şu an oynuyorum"
          value={filters.currentlyPlaying}
          yesLabel="Evet"
          noLabel="Hayır"
          onChange={(value) => updateFilter("currentlyPlaying", value)}
        />
        <FilterSelect
          id="abandoned-filter"
          label="Yarım bıraktım"
          value={filters.abandoned}
          yesLabel="Evet"
          noLabel="Hayır"
          onChange={(value) => updateFilter("abandoned", value)}
        />

        <button className={styles.clearButton} type="button" onClick={() => setFilters(emptyFilters)}>
          Filtreleri temizle
        </button>
      </aside>

      {selectedGame ? (
        <GameDetailModal
          game={selectedGame}
          platforms={platforms}
          onClose={() => setSelectedGame(null)}
          onSave={handleSaveGame}
          onEdit={handleEditGame}
          onDelete={handleDeleteGame}
          onFindCoverCandidates={findGameCoverCandidates}
          onApplyCoverCandidate={handleApplyCoverCandidate}
          onRefreshMetadata={handleRefreshMetadata}
          onRefreshLanguageSupport={handleRefreshLanguageSupport}
          onSelectInstallFolder={handleSelectInstallFolder}
        />
      ) : null}

      {formMode ? (
        <GameFormModal
          mode={formMode}
          game={editingGame}
          genres={genres}
          platforms={platforms}
          onClose={() => {
            setFormMode(null);
            setEditingGame(undefined);
          }}
          onSave={handleSaveGameForm}
        />
      ) : null}

      {isImportModalOpen ? (
        <LibraryImportModal
          onClose={() => setIsImportModalOpen(false)}
          onImported={async () => {
            await refreshLibrary();
            setNotice("Kütüphanedeki oyunlar güncellendi.");
            window.setTimeout(() => setNotice(null), 2800);
          }}
        />
      ) : null}
    </div>
  );
}

type FilterSelectProps = {
  id: string;
  label: string;
  value: TriStateFilter;
  yesLabel: string;
  noLabel: string;
  onChange: (value: TriStateFilter) => void;
};

function FilterSelect({ id, label, value, yesLabel, noLabel, onChange }: FilterSelectProps) {
  return (
    <div className={styles.field}>
      <CustomSelect
        id={id}
        label={label}
        value={value}
        options={[
          { label: "Tümü", value: "all" },
          { label: yesLabel, value: "yes" },
          { label: noLabel, value: "no" },
        ]}
        onChange={(nextValue) => onChange(nextValue as TriStateFilter)}
      />
    </div>
  );
}

function matchesFilters(game: Game, filters: GameFilters) {
  const normalizedSearch = normalizeTitle(filters.search);

  if (normalizedSearch && !normalizeTitle(game.title).includes(normalizedSearch)) {
    return false;
  }

  if (
    filters.genreNames.length > 0 &&
    !filters.genreNames.every((genreName) => game.genreNames?.includes(genreName))
  ) {
    return false;
  }

  if (filters.releaseYear !== "all" && game.releaseYear !== Number(filters.releaseYear)) {
    return false;
  }

  if (
    filters.platformName !== "all" &&
    !(game.platformNames ?? []).includes(filters.platformName)
  ) {
    return false;
  }

  return (
    matchesTriState(game.isPlayed, filters.played) &&
    matchesTriState(game.isCompleted, filters.completed) &&
    matchesTriState(game.isFavorite, filters.favorite) &&
    matchesTriState(game.personalRating !== null, filters.rating) &&
    matchesTriState(game.isCurrentlyPlaying, filters.currentlyPlaying) &&
    matchesTriState(game.isAbandoned, filters.abandoned) &&
    (filters.multiplayerType === "all" || game.multiplayerType === filters.multiplayerType) &&
    (filters.steamDeckCompatible === "all" ||
      game.steamDeckCompatible === filters.steamDeckCompatible)
  );
}

function matchesTriState(value: boolean, filter: TriStateFilter) {
  return filter === "all" || (filter === "yes" ? value : !value);
}
