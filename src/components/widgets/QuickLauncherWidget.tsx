import { FolderOpen, Gamepad2, Pin, Play, RefreshCw, Search, X } from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { GameCoverPlaceholder } from "../game/GameCoverPlaceholder";
import { useWidgetPinning } from "../../hooks/useWidgetPinning";
import { getGames, reconcileInstalledGameStates } from "../../services/gameService";
import { launchGame, revealGameFolder } from "../../services/gameLaunchService";
import { saveAppSettings } from "../../services/settingsService";
import { setDesktopWidgetOpen, startWidgetDragging } from "../../services/widgetWindowService";
import type { Game } from "../../types/game";
import { getCoverSource } from "../../utils/coverSource";
import { normalizeTitle } from "../../utils/normalizeTitle";
import styles from "./Widgets.module.css";

export function QuickLauncherWidget() {
  const [games, setGames] = useState<Game[]>([]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyGameId, setBusyGameId] = useState<number | null>(null);
  const { isPinned, togglePinned } = useWidgetPinning("quickLauncher");

  const loadInstalledGames = async () => {
    setIsLoading(true);
    try {
      const loadedGames = await getGames();
      const refreshedGames = await reconcileInstalledGameStates(loadedGames);
      setGames(refreshedGames.filter((game) => game.isInstalled));
    } catch {
      setNotice("Yüklü oyunlar yüklenemedi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadInstalledGames();
  }, []);

  const visibleGames = useMemo(() => {
    const query = normalizeTitle(search);
    const filtered = query ? games.filter((game) => normalizeTitle(game.title).includes(query)) : games;

    return [...filtered].sort((first, second) => {
      if (first.isCurrentlyPlaying !== second.isCurrentlyPlaying) return first.isCurrentlyPlaying ? -1 : 1;
      if (first.isFavorite !== second.isFavorite) return first.isFavorite ? -1 : 1;
      return first.title.localeCompare(second.title, "tr");
    });
  }, [games, search]);

  const closeWidget = async () => {
    await saveAppSettings({ quickLauncherWidgetEnabled: false });
    await setDesktopWidgetOpen("quickLauncher", false);
  };

  const runGameAction = async (game: Game, action: (selectedGame: Game) => Promise<string>) => {
    setBusyGameId(game.id);
    setNotice(null);
    try {
      setNotice(await action(game));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setBusyGameId(null);
    }
  };

  const handleHeaderMouseDown = (event: MouseEvent<HTMLElement>) => {
    if (isPinned || event.button !== 0 || (event.target as HTMLElement).closest("button")) {
      return;
    }

    void startWidgetDragging();
  };

  const handlePinToggle = async () => {
    try {
      await togglePinned();
      setNotice(isPinned ? "Widget artık taşınabilir." : "Widget masaüstündeki konumuna sabitlendi.");
    } catch {
      setNotice("Widget sabitleme ayarı kaydedilemedi.");
    }
  };

  return (
    <div className={styles.widget}>
      <header className={`${styles.widgetHeader} ${isPinned ? styles.widgetHeaderPinned : ""}`} onMouseDown={handleHeaderMouseDown}>
        <div className={styles.widgetBrand}>
          <Gamepad2 size={18} />
          <div>
            <strong>Hızlı Başlatıcı</strong>
            <span>Yüklü oyunların</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={isPinned ? styles.pinActive : styles.pinButton}
            type="button"
            title={isPinned ? "Sabitlemeyi kaldır" : "Konumuna sabitle"}
            aria-pressed={isPinned}
            onClick={() => void handlePinToggle()}
          >
            <Pin size={16} />
          </button>
          <button type="button" title="Yenile" onClick={() => void loadInstalledGames()}>
            <RefreshCw size={16} />
          </button>
          <button type="button" title="Kapat" onClick={() => void closeWidget()}>
            <X size={17} />
          </button>
        </div>
      </header>

      <label className={styles.searchField}>
        <Search size={16} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Oyun ara" />
      </label>

      {notice ? <p className={styles.notice}>{notice}</p> : null}

      <div className={styles.widgetSubhead}>
        <strong>Başlatmaya hazır</strong>
        <span>{visibleGames.length}</span>
      </div>

      <div className={styles.launcherList}>
        {isLoading ? <p className={styles.empty}>Oyunlar yükleniyor...</p> : null}
        {!isLoading && visibleGames.length === 0 ? (
          <p className={styles.empty}>Yüklü oyun bulunamadı.</p>
        ) : null}
        {visibleGames.map((game) => (
          <LauncherRow
            key={game.id}
            game={game}
            busy={busyGameId === game.id}
            onPlay={() => void runGameAction(game, launchGame)}
            onFolder={() => void runGameAction(game, revealGameFolder)}
          />
        ))}
      </div>
    </div>
  );
}

function LauncherRow({
  game,
  busy,
  onPlay,
  onFolder,
}: {
  game: Game;
  busy: boolean;
  onPlay: () => void;
  onFolder: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const coverSource = getCoverSource(game.coverPath);

  useEffect(() => setImageFailed(false), [coverSource]);

  return (
    <article className={styles.launcherRow}>
      <div className={styles.rowCover}>
        {coverSource && !game.usePlaceholderCover && !imageFailed ? (
          <img src={coverSource} alt="" onError={() => setImageFailed(true)} />
        ) : (
          <GameCoverPlaceholder title={game.title} compact />
        )}
      </div>
      <div className={styles.rowInfo}>
        <strong>{game.title}</strong>
        <span>{game.platformNames?.slice(0, 2).join(" / ") || "Platform bilinmiyor"}</span>
      </div>
      <div className={styles.rowActions}>
        <button type="button" disabled={busy} title="Klasörü aç" onClick={onFolder}>
          <FolderOpen size={15} />
        </button>
        <button className={styles.playAction} type="button" disabled={busy} title="Oyna" onClick={onPlay}>
          <Play size={16} fill="currentColor" />
        </button>
      </div>
    </article>
  );
}
