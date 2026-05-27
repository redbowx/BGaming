import { Gamepad2, Pin, Play, RefreshCw, Sparkles, X } from "lucide-react";
import { type CSSProperties, type MouseEvent, useEffect, useRef, useState } from "react";
import { GameCoverPlaceholder } from "../game/GameCoverPlaceholder";
import { useWidgetPinning } from "../../hooks/useWidgetPinning";
import { getGames } from "../../services/gameService";
import { launchGame } from "../../services/gameLaunchService";
import { getAppSettings, saveAppSettings } from "../../services/settingsService";
import { setDesktopWidgetOpen, startWidgetDragging } from "../../services/widgetWindowService";
import type { Game } from "../../types/game";
import { getCoverSource } from "../../utils/coverSource";
import styles from "./Widgets.module.css";

type RouletteEntry = {
  key: string;
  game: Game;
};

const rouletteResultIndex = 18;
const rouletteStartIndex = 1;
const rouletteDuration = 3800;
const rouletteTileStep = 83;
const rouletteTileCenter = 45;

export function SurpriseWidget() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [installedOnly, setInstalledOnly] = useState(true);
  const [smartRandom, setSmartRandom] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rouletteItems, setRouletteItems] = useState<RouletteEntry[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [rouletteRunId, setRouletteRunId] = useState(0);
  const { isPinned, togglePinned } = useWidgetPinning("surprise");
  const rouletteTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    void Promise.all([getGames(), getAppSettings()]).then(([loadedGames, settings]) => {
      setGames(loadedGames);
      setSmartRandom(settings.smartRandomEnabled);
    });

    return () => window.clearTimeout(rouletteTimeout.current);
  }, []);

  const pickGame = () => {
    if (isRolling) return;

    const eligible = games.filter((game) => !game.neverShowInRandom && (!installedOnly || game.isInstalled));
    if (eligible.length === 0) {
      setSelectedGame(null);
      setRouletteItems([]);
      setNotice(installedOnly ? "Yüklü ve kuraya uygun oyun bulunamadı." : "Kuraya uygun oyun bulunamadı.");
      return;
    }

    const winner = smartRandom ? pickWeightedGame(eligible) : eligible[Math.floor(Math.random() * eligible.length)];
    const reel = Array.from({ length: rouletteResultIndex + 4 }, (_, index) => ({
      key: `${winner.id}-${index}-${Date.now()}`,
      game: eligible[Math.floor(Math.random() * eligible.length)],
    }));
    reel[rouletteResultIndex] = { key: `winner-${winner.id}-${Date.now()}`, game: winner };

    window.clearTimeout(rouletteTimeout.current);
    setRouletteItems(reel);
    setRouletteRunId((runId) => runId + 1);
    setIsRolling(true);
    setNotice(null);
    rouletteTimeout.current = window.setTimeout(() => {
      setSelectedGame(winner);
      setIsRolling(false);
    }, rouletteDuration);
  };

  const closeWidget = async () => {
    await saveAppSettings({ surpriseWidgetEnabled: false });
    await setDesktopWidgetOpen("surprise", false);
  };

  const playSelectedGame = async () => {
    if (!selectedGame) return;
    setIsPlaying(true);
    try {
      setNotice(await launchGame(selectedGame));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Oyun başlatılamadı.");
    } finally {
      setIsPlaying(false);
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
    <div className={`${styles.widget} ${styles.surpriseWidget}`}>
      <header className={`${styles.widgetHeader} ${isPinned ? styles.widgetHeaderPinned : ""}`} onMouseDown={handleHeaderMouseDown}>
        <div className={styles.widgetBrand}>
          <Sparkles size={18} />
          <div>
            <strong>Şaşırt Beni!</strong>
            <span>Bugün ne oynasak?</span>
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
          <button className={styles.closeOnly} type="button" title="Kapat" onClick={() => void closeWidget()}>
            <X size={17} />
          </button>
        </div>
      </header>

      <label className={styles.compactToggle}>
        <input type="checkbox" checked={installedOnly} onChange={(event) => setInstalledOnly(event.target.checked)} />
        Yalnız yüklü oyunlar
      </label>

      {rouletteItems.length ? (
        <MiniRoulette key={rouletteRunId} items={rouletteItems} />
      ) : null}

      {selectedGame && !isRolling ? <SelectedGame game={selectedGame} /> : !rouletteItems.length ? (
        <div className={styles.surpriseEmpty}>
          <Gamepad2 size={30} />
          <p>Bir oyun seçmek için kura butonuna bas.</p>
        </div>
      ) : (
        <div className={styles.rouletteStatus}>
          <Sparkles size={18} />
          <strong>Seçiliyor...</strong>
        </div>
      )}

      {notice ? <p className={styles.notice}>{notice}</p> : null}

      <div className={styles.surpriseActions}>
        <button className={styles.surpriseDrawButton} type="button" disabled={isRolling} onClick={pickGame}>
          <RefreshCw size={16} />
          {isRolling ? "Seçiliyor..." : selectedGame ? "Başka Göster" : "Şaşırt Beni!"}
        </button>
        {selectedGame && !isRolling ? (
          <button className={styles.launchButton} type="button" disabled={!selectedGame.isInstalled || isPlaying} onClick={() => void playSelectedGame()}>
            <Play size={16} fill="currentColor" />
            {isPlaying ? "Açılıyor" : selectedGame.isInstalled ? "Oyna" : "Yüklü değil"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MiniRoulette({
  items,
}: {
  items: RouletteEntry[];
}) {
  const startOffset = rouletteTileCenter + rouletteStartIndex * rouletteTileStep;
  const finalOffset = rouletteTileCenter + rouletteResultIndex * rouletteTileStep;
  const style = {
    "--roulette-start-offset": `-${startOffset}px`,
    "--roulette-result-offset": `-${finalOffset}px`,
  } as CSSProperties;

  return (
    <div className={styles.roulette}>
      <div
        className={`${styles.rouletteTrack} ${styles.rouletteTrackRolling}`}
        style={style}
      >
        {items.map((entry) => <RouletteTile key={entry.key} game={entry.game} />)}
      </div>
      <span className={styles.rouletteMarker} aria-hidden="true">
        <Sparkles size={12} />
      </span>
    </div>
  );
}

function RouletteTile({ game }: { game: Game }) {
  const [imageFailed, setImageFailed] = useState(false);
  const coverSource = getCoverSource(game.coverPath);

  useEffect(() => setImageFailed(false), [coverSource]);

  return (
    <div className={styles.rouletteTile}>
      <div className={styles.rouletteCover}>
        {coverSource && !game.usePlaceholderCover && !imageFailed ? (
          <img src={coverSource} alt="" onError={() => setImageFailed(true)} />
        ) : (
          <GameCoverPlaceholder title={game.title} compact />
        )}
      </div>
      <strong title={game.title}>{game.title}</strong>
    </div>
  );
}

function SelectedGame({ game }: { game: Game }) {
  const [imageFailed, setImageFailed] = useState(false);
  const coverSource = getCoverSource(game.coverPath);

  useEffect(() => setImageFailed(false), [coverSource]);

  return (
    <article className={styles.selectedGame}>
      <div className={styles.selectedCover}>
        {coverSource && !game.usePlaceholderCover && !imageFailed ? (
          <img src={coverSource} alt={`${game.title} kapak`} onError={() => setImageFailed(true)} />
        ) : (
          <GameCoverPlaceholder title={game.title} compact />
        )}
      </div>
      <div>
        <p>{game.releaseYear ?? "Yıl bilinmiyor"}</p>
        <h2>{game.title}</h2>
        <span>{game.platformNames?.slice(0, 2).join(" / ") || "Platform bilinmiyor"}</span>
      </div>
    </article>
  );
}

function pickWeightedGame(games: Game[]) {
  const weighted = games.map((game) => ({
    game,
    weight:
      1
      + (!game.isPlayed ? 3 : 0)
      + (game.isFavorite ? 0.75 : 0)
      - (game.isCompleted ? 0.4 : 0)
      - (game.isAbandoned ? 0.5 : 0),
  }));
  const total = weighted.reduce((sum, entry) => sum + Math.max(0.1, entry.weight), 0);
  let cursor = Math.random() * total;

  for (const entry of weighted) {
    cursor -= Math.max(0.1, entry.weight);
    if (cursor <= 0) return entry.game;
  }

  return games[0];
}
