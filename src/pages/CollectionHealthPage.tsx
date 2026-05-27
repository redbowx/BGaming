import { useEffect, useState } from "react";
import { GameDetailModal } from "../components/game/GameDetailModal";
import { useRef } from "react";
import { GameFormModal } from "../components/game/GameFormModal";
import { MergeDuplicateModal } from "../components/game/MergeDuplicateModal";
import {
  dismissDuplicate,
  getCollectionHealthReport,
  mergeDuplicate,
  type CollectionHealthReport,
  type DuplicateSuspicion,
} from "../services/collectionHealthService";
import { removeGame, saveGameDetails, saveGameInstallFolder, updateManualGame } from "../services/gameService";
import { selectGameInstallFolder } from "../services/gameLaunchService";
import { getGenres, getPlatforms } from "../services/libraryMetadataService";
import {
  applyGameCoverCandidate,
  enrichGamesMetadata,
  findGameCoverCandidates,
  refreshMissingGameMetadata,
  type CoverCandidate,
  type MetadataBatchProgress,
} from "../services/metadataService";
import {
  enrichGamesLanguageSupport,
  refreshGameLanguageSupport,
  type LanguageSupportBatchProgress,
} from "../services/languageSupportService";
import type { Game, GameFormInput, Genre, Platform } from "../types/game";
import { getErrorMessage } from "../utils/errorMessage";
import styles from "./CollectionHealthPage.module.css";

const emptyReport: CollectionHealthReport = {
  missingCovers: [],
  missingGenres: [],
  missingYears: [],
  missingPlatforms: [],
  missingTurkishLanguage: [],
  duplicateSuspicions: [],
};

type BatchActionId = "covers" | "genres" | "years" | "language";

type BatchProgressState = MetadataBatchProgress & {
  actionId: BatchActionId;
  label: string;
  unresolved?: number;
  messages?: string[];
};

export function CollectionHealthPage() {
  const [report, setReport] = useState<CollectionHealthReport>(emptyReport);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [editingGame, setEditingGame] = useState<Game | undefined>();
  const [mergeTarget, setMergeTarget] = useState<DuplicateSuspicion | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mergeToast, setMergeToast] = useState<string | null>(null);
  const mergeToastTimeoutRef = useRef<number | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgressState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    const [nextReport, nextGenres, nextPlatforms] = await Promise.all([
      getCollectionHealthReport(),
      getGenres(),
      getPlatforms(),
    ]);

    setReport(nextReport);
    setGenres(nextGenres);
    setPlatforms(nextPlatforms);
    return nextReport;
  };

  useEffect(() => {
    void refresh().finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (mergeToastTimeoutRef.current !== null) {
        window.clearTimeout(mergeToastTimeoutRef.current);
      }
    };
  }, []);

  const showMergeToast = (message: string) => {
    if (mergeToastTimeoutRef.current !== null) {
      window.clearTimeout(mergeToastTimeoutRef.current);
    }

    setMergeToast(message);
    mergeToastTimeoutRef.current = window.setTimeout(() => {
      setMergeToast(null);
      mergeToastTimeoutRef.current = null;
    }, 3000);
  };

  const handleSaveGame = async (input: Parameters<typeof saveGameDetails>[0]) => {
    const updatedGame = await saveGameDetails(input);
    const nextReport = await refresh();
    setSelectedGame(findGameInReport(nextReport, updatedGame.id));
  };

  const handleSaveGameForm = async (input: GameFormInput) => {
    if (!editingGame) return;

    const updatedGame = await updateManualGame({ ...input, id: editingGame.id });
    const nextReport = await refresh();
    setSelectedGame(findGameInReport(nextReport, updatedGame.id));
    setEditingGame(undefined);
  };

  const handleDeleteGame = async (game: Game) => {
    await removeGame(game);
    await refresh();
    setSelectedGame(null);
  };

  const handleDismissDuplicate = async (suspicion: DuplicateSuspicion) => {
    setReport((currentReport) => ({
      ...currentReport,
      duplicateSuspicions: currentReport.duplicateSuspicions.filter((item) => item.id !== suspicion.id),
    }));

    try {
      await dismissDuplicate(suspicion.gameA.id, suspicion.gameB.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Duplicate kaydı güncellenemedi.");
      await refresh();
    }
  };

  const handleMergeDuplicate = async (primaryGameId: number, secondaryGameId: number) => {
    try {
      await mergeDuplicate(primaryGameId, secondaryGameId);
      await refresh();
      setMergeTarget(null);
      setSelectedGame(null);
      showMergeToast("Oyunlar başarıyla birleştirildi.");
    } catch (error) {
      console.error("Duplicate merge failed", error);
      setNotice(getErrorMessage(error, "Duplicate kayıtlar birleştirilemedi."));
      window.setTimeout(() => setNotice(null), 5200);
      throw error;
    }
  };

  const handleApplyCoverCandidate = async (game: Game, candidate: CoverCandidate) => {
    const result = await applyGameCoverCandidate(game, candidate);
    const nextReport = await refresh();
    setSelectedGame(findGameInReport(nextReport, result.game.id) ?? result.game);
    return result.message;
  };

  const handleRefreshMetadata = async (game: Game) => {
    const result = await refreshMissingGameMetadata(game);
    const nextReport = await refresh();
    setSelectedGame(findGameInReport(nextReport, result.game.id) ?? result.game);
    return result.message;
  };

  const handleRefreshLanguageSupport = async (game: Game) => {
    const result = await refreshGameLanguageSupport(game);
    const nextReport = await refresh();
    setSelectedGame(findGameInReport(nextReport, result.game.id) ?? result.game);
    return result.message;
  };

  const handleSelectInstallFolder = async (game: Game) => {
    const folder = await selectGameInstallFolder();
    if (!folder) {
      return "Klasör seçilmedi.";
    }

    const updatedGame = await saveGameInstallFolder(game, folder);
    const nextReport = await refresh();
    setSelectedGame(findGameInReport(nextReport, updatedGame.id) ?? updatedGame);

    return "Oyun klasörü kaydedildi ve oyun yüklü olarak işaretlendi.";
  };

  const handleBatchMetadata = async (
    actionId: BatchActionId,
    games: Game[],
    mode: "cover" | "missing",
    label: string,
  ) => {
    if (batchProgress) return;

    setNotice(null);
    setBatchProgress({
      actionId,
      label,
      total: games.length,
      processed: 0,
      remaining: games.length,
      updated: 0,
      coversUpdated: 0,
      genresUpdated: 0,
      yearsUpdated: 0,
      errors: 0,
      currentTitle: null,
    });

    try {
      const result = await enrichGamesMetadata(games, mode, (progress) => {
        setBatchProgress({
          ...progress,
          actionId,
          label,
        });
      });
      await refresh();
      setNotice(
        `${result.processed} oyun işlendi, ${result.updated} oyun güncellendi, ${result.coversUpdated} kapak, ${result.genresUpdated} tür, ${result.yearsUpdated} yıl tamamlandı, ${result.errors} hata.`,
      );
      window.setTimeout(() => setNotice(null), 4200);
    } finally {
      window.setTimeout(() => {
        setBatchProgress((currentProgress) => (currentProgress?.actionId === actionId ? null : currentProgress));
      }, 900);
    }
  };

  const handleBatchLanguageSupport = async (games: Game[]) => {
    if (batchProgress) return;

    setNotice(null);
    setBatchProgress({
      actionId: "language",
      label: "Dil bilgileri tamamlanıyor",
      total: games.length,
      processed: 0,
      remaining: games.length,
      updated: 0,
      coversUpdated: 0,
      genresUpdated: 0,
      yearsUpdated: 0,
      errors: 0,
      currentTitle: null,
    });

    try {
      const result = await enrichGamesLanguageSupport(games, (progress) => {
        setBatchProgress(toLanguageProgressState(progress));
      });
      await refresh();
      const detail = result.messages.length > 0 ? ` İlk notlar: ${result.messages.join(" | ")}` : "";
      setNotice(
        `${result.processed} oyun işlendi, ${result.updated} dil bilgisi güncellendi, ${result.unresolved} oyun bulunamadı/kararsız kaldı, ${result.errors} teknik hata.${detail}`,
      );
      window.setTimeout(() => setNotice(null), 12000);
    } finally {
      window.setTimeout(() => {
        setBatchProgress((currentProgress) => (currentProgress?.actionId === "language" ? null : currentProgress));
      }, 900);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>Koleksiyon bakımı</p>
          <h2>Koleksiyon Sağlığı</h2>
        </div>
        <span>{isLoading ? "Kontrol ediliyor" : "Kontrol tamamlandı"}</span>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {mergeToast ? (
        <div className={styles.mergeToast} role="status" aria-live="polite">
          <span>✓</span>
          {mergeToast}
        </div>
      ) : null}

      <div className={styles.sections}>
        <HealthSection
          title="Kapaksız oyunlar"
          games={report.missingCovers}
          actionLabel="Seçili oyunların kapaklarını tamamla"
          actionProgress={batchProgress?.actionId === "covers" ? batchProgress : null}
          isActionDisabled={Boolean(batchProgress)}
          onAction={(games) => void handleBatchMetadata("covers", games, "cover", "Kapaklar tamamlanıyor")}
          onGameClick={setSelectedGame}
        />
        <HealthSection
          title="Türü olmayan oyunlar"
          games={report.missingGenres}
          actionLabel="Eksik bilgileri tamamla"
          actionProgress={batchProgress?.actionId === "genres" ? batchProgress : null}
          isActionDisabled={Boolean(batchProgress)}
          onAction={(games) => void handleBatchMetadata("genres", games, "missing", "Eksik türler tamamlanıyor")}
          onGameClick={setSelectedGame}
        />
        <HealthSection
          title="Yılı olmayan oyunlar"
          games={report.missingYears}
          actionLabel="Eksik bilgileri tamamla"
          actionProgress={batchProgress?.actionId === "years" ? batchProgress : null}
          isActionDisabled={Boolean(batchProgress)}
          onAction={(games) => void handleBatchMetadata("years", games, "missing", "Eksik yıllar tamamlanıyor")}
          onGameClick={setSelectedGame}
        />
        <HealthSection title="Platformu eksik oyunlar" games={report.missingPlatforms} onGameClick={setSelectedGame} />
        <HealthSection
          title="Türkçe dil bilgisi eksik oyunlar"
          games={report.missingTurkishLanguage}
          actionLabel="Dil bilgilerini tamamla"
          actionProgress={batchProgress?.actionId === "language" ? batchProgress : null}
          isActionDisabled={Boolean(batchProgress)}
          onAction={(games) => void handleBatchLanguageSupport(games)}
          onGameClick={setSelectedGame}
        />
      </div>

      <section className={styles.duplicateSection}>
        <div className={styles.sectionTitle}>
          <h3>Duplicate şüpheli oyunlar</h3>
          <span>{report.duplicateSuspicions.length}</span>
        </div>

        {report.duplicateSuspicions.length > 0 ? (
          <div className={styles.duplicateList}>
            {report.duplicateSuspicions.map((suspicion) => (
              <article key={suspicion.id} className={styles.duplicateCard}>
                <MiniGameButton game={suspicion.gameA} onClick={setSelectedGame} />
                <div className={styles.duplicateMeta}>
                  <strong>{Math.round(suspicion.confidence * 100)}%</strong>
                  <span>{suspicion.reason}</span>
                  <button type="button" className={styles.mergeButton} onClick={() => setMergeTarget(suspicion)}>
                    Birleştir
                  </button>
                  <button type="button" onClick={() => void handleDismissDuplicate(suspicion)}>
                    Aynı oyun değil
                  </button>
                </div>
                <MiniGameButton game={suspicion.gameB} onClick={setSelectedGame} />
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>Duplicate şüpheli oyun bulunmadı.</p>
        )}
      </section>

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

      {mergeTarget ? (
        <MergeDuplicateModal
          suspicion={mergeTarget}
          onClose={() => setMergeTarget(null)}
          onConfirm={handleMergeDuplicate}
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

function toLanguageProgressState(progress: LanguageSupportBatchProgress): BatchProgressState {
  return {
    ...progress,
    actionId: "language",
    label: "Dil bilgileri tamamlanıyor",
    coversUpdated: 0,
    genresUpdated: 0,
    yearsUpdated: 0,
  };
}

type HealthSectionProps = {
  title: string;
  games: Game[];
  actionLabel?: string;
  actionProgress?: BatchProgressState | null;
  isActionDisabled?: boolean;
  onAction?: (games: Game[]) => void;
  onGameClick: (game: Game) => void;
};

function HealthSection({
  title,
  games,
  actionLabel,
  actionProgress,
  isActionDisabled,
  onAction,
  onGameClick,
}: HealthSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        <h3>{title}</h3>
        <span>{games.length}</span>
      </div>
      {actionLabel && games.length > 0 ? (
        <button
          className={`${styles.sectionAction} ${actionProgress ? styles.sectionActionWorking : ""}`}
          type="button"
          disabled={isActionDisabled}
          onClick={() => onAction?.(games)}
        >
          {actionProgress ? `${actionProgress.processed}/${actionProgress.total} işlendi` : actionLabel}
        </button>
      ) : null}
      {actionProgress ? <BatchProgress progress={actionProgress} /> : null}
      {games.length > 0 ? (
        <div className={styles.gameList}>
          {games.map((game) => (
            <MiniGameButton key={game.id} game={game} onClick={onGameClick} />
          ))}
        </div>
      ) : (
        <p className={styles.emptyText}>Bu kategoride sorun yok.</p>
      )}
    </section>
  );
}

type BatchProgressProps = {
  progress: BatchProgressState;
};

function BatchProgress({ progress }: BatchProgressProps) {
  const percent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className={styles.progressPanel} role="status" aria-live="polite">
      <div className={styles.progressHeader}>
        <strong>{progress.label}</strong>
        <span>{percent}%</span>
      </div>
      <div className={styles.progressBar}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.progressStats}>
        <span>İşlenen: {progress.processed}</span>
        <span>Kalan: {progress.remaining}</span>
        <span>Güncellenen: {progress.updated}</span>
        {typeof progress.unresolved === "number" ? <span>Bulunamadı: {progress.unresolved}</span> : null}
        <span>Hata: {progress.errors}</span>
      </div>
      {progress.messages && progress.messages.length > 0 ? (
        <p className={styles.progressCurrent}>Not: {progress.messages[progress.messages.length - 1]}</p>
      ) : null}
      {progress.currentTitle ? <p className={styles.progressCurrent}>Şu an: {progress.currentTitle}</p> : null}
    </div>
  );
}

type MiniGameButtonProps = {
  game: Game;
  onClick: (game: Game) => void;
};

function MiniGameButton({ game, onClick }: MiniGameButtonProps) {
  return (
    <button className={styles.miniGame} type="button" onClick={() => onClick(game)}>
      <strong>{game.title}</strong>
      <span>{game.releaseYear ?? "Yıl yok"}</span>
    </button>
  );
}

function findGameInReport(report: CollectionHealthReport, gameId: number) {
  const allGames = [
    ...report.missingCovers,
    ...report.missingGenres,
    ...report.missingYears,
    ...report.missingPlatforms,
    ...report.missingTurkishLanguage,
    ...report.duplicateSuspicions.flatMap((suspicion) => [suspicion.gameA, suspicion.gameB]),
  ];

  return allGames.find((game) => game.id === gameId) ?? null;
}
