import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Gamepad2, Pause, Sparkles, Star, Trophy, X } from "lucide-react";
import { CustomSelect } from "../components/common/CustomSelect";
import { TurkishFlagIcon } from "../components/common/TurkishFlagIcon";
import { GameCoverPlaceholder } from "../components/game/GameCoverPlaceholder";
import { GameDetailModal } from "../components/game/GameDetailModal";
import { PlatformBadge } from "../components/game/PlatformBadge";
import { getGames, removeGame, saveGameDetails, saveGameInstallFolder } from "../services/gameService";
import { selectGameInstallFolder } from "../services/gameLaunchService";
import { refreshGameLanguageSupport } from "../services/languageSupportService";
import { getPlatforms } from "../services/libraryMetadataService";
import { getAppSettings } from "../services/settingsService";
import type { Game, GameUpdateInput, Platform } from "../types/game";
import { getCoverSource } from "../utils/coverSource";
import { getGameStatusVisibility } from "../utils/gameStatusVisibility";
import {
  defaultDrawGenreKeys,
  gameMatchesAnyDrawGenre,
  getEnabledDrawGenreOptions,
} from "../utils/drawGenreOptions";
import { getGenreDisplayName, isUsefulGenreName } from "../utils/genreDisplay";
import { normalizeTitle } from "../utils/normalizeTitle";
import styles from "./HomePage.module.css";

type Mood =
  | "chill"
  | "action"
  | "story"
  | "horror"
  | "competitive"
  | "short"
  | "long"
  | "challenging"
  | "strategy";

type DrawFilters = {
  mood: Mood | "all";
  genreKeys: string[];
  shortGame: boolean;
  longGame: boolean;
  unplayedOnly: boolean;
  installedOnly: boolean;
};

const moodOptions: Array<{ value: Mood; label: string; keywords: string[] }> = [
  { value: "chill", label: "Rahat takılayım", keywords: ["cozy", "simulation", "simulasyon", "stardew"] },
  { value: "action", label: "Aksiyon istiyorum", keywords: ["action", "aksiyon", "fps", "roguelike"] },
  { value: "story", label: "Hikâyeye gömüleyim", keywords: ["rpg", "story", "detective", "dedektif"] },
  { value: "horror", label: "Korku / gerilim", keywords: ["horror", "korku", "thriller", "gerilim"] },
  { value: "competitive", label: "Rekabetçi", keywords: ["competitive", "rekabetçi", "fps", "multiplayer"] },
  { value: "short", label: "Kısa sürede oynanacak", keywords: ["roguelike", "action", "cozy"] },
  { value: "long", label: "Uzun soluklu oyun", keywords: ["rpg", "strategy", "strateji"] },
  { value: "challenging", label: "Zorlayıcı oyun", keywords: ["roguelike", "souls", "strategy", "fps"] },
  { value: "strategy", label: "Beyin yakan / stratejik", keywords: ["strategy", "strateji", "rpg", "puzzle"] },
];

const emptyFilters: DrawFilters = {
  mood: "all",
  genreKeys: [],
  shortGame: false,
  longGame: false,
  unplayedOnly: false,
  installedOnly: false,
};

export function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [drawGenreKeys, setDrawGenreKeys] = useState(defaultDrawGenreKeys);
  const [filters, setFilters] = useState<DrawFilters>(emptyFilters);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastDrawMode, setLastDrawMode] = useState<"quick" | "detailed">("quick");
  const [smartRandomEnabled, setSmartRandomEnabled] = useState(true);
  const [drawStrip, setDrawStrip] = useState<Game[]>([]);
  const [drawWinnerIndex, setDrawWinnerIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMarkingPlaying, setIsMarkingPlaying] = useState(false);
  const [playMessage, setPlayMessage] = useState<string | null>(null);
  const [drawId, setDrawId] = useState(0);
  const [detailGame, setDetailGame] = useState<Game | null>(null);

  useEffect(() => {
    void Promise.all([getGames(), getAppSettings(), getPlatforms()])
      .then(([loadedGames, settings, loadedPlatforms]) => {
        setGames(loadedGames);
        setDrawGenreKeys(settings.drawGenreKeys);
        setSmartRandomEnabled(settings.smartRandomEnabled);
        setPlatforms(loadedPlatforms);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const detailedCandidates = useMemo(
    () => getEligibleGames(games, filters),
    [filters, games],
  );
  const drawGenres = useMemo(
    () => getEnabledDrawGenreOptions(drawGenreKeys),
    [drawGenreKeys],
  );

  const quickDraw = () => {
    setLastDrawMode("quick");
    drawFrom(games.filter((game) => !game.neverShowInRandom));
  };

  const detailedDraw = () => {
    setLastDrawMode("detailed");
    drawFrom(detailedCandidates);
  };

  const drawFrom = (candidates: Game[]) => {
    if (candidates.length === 0) {
      setSelectedGame(null);
      setDrawStrip([]);
      setIsDrawing(false);
      setEmptyMessage("Bu filtrelere uygun oyun bulunamadı. Bir iki filtreyi azaltıp tekrar dene.");
      return;
    }

    const visualTarget = smartRandomEnabled
      ? pickWeightedGame(candidates)
      : candidates[Math.floor(Math.random() * candidates.length)];
    const { strip, winnerIndex } = createDrawStrip(candidates, visualTarget);

    setSelectedGame(null);
    setDrawStrip(strip);
    setDrawWinnerIndex(winnerIndex);
    setDrawId((current) => current + 1);
    setIsDrawing(true);
    setEmptyMessage(null);
    setPlayMessage(null);
  };

  const finishDraw = (gameId: number | undefined, strip = drawStrip) => {
    const nextGame = strip.find((game) => game.id === gameId) ?? games.find((game) => game.id === gameId);
    if (!nextGame) {
      setIsDrawing(false);
      setEmptyMessage("Seçilen oyun okunamadı. Tekrar kura çekmeyi dene.");
      return;
    }

    setSelectedGame(nextGame);
    setIsDrawing(false);
  };

  const markAsPlaying = async () => {
    if (!selectedGame) return;

    setIsMarkingPlaying(true);
    setPlayMessage(null);
    try {
      const updatedGame = await saveGameDetails({
        id: selectedGame.id,
        isPlayed: selectedGame.isPlayed,
        isCompleted: selectedGame.isCompleted,
        isFavorite: selectedGame.isFavorite,
        isCurrentlyPlaying: true,
        isAbandoned: selectedGame.isAbandoned,
        isWishlisted: selectedGame.isWishlisted,
        neverShowInRandom: selectedGame.neverShowInRandom,
        multiplayerType: selectedGame.multiplayerType,
        steamDeckCompatible: selectedGame.steamDeckCompatible,
        personalRating: selectedGame.personalRating,
        notes: selectedGame.notes,
        estimatedLength: selectedGame.estimatedLength,
      });

      setSelectedGame(updatedGame);
      setGames((currentGames) =>
        currentGames.map((game) => (game.id === updatedGame.id ? updatedGame : game)),
      );
      setPlayMessage(`${updatedGame.title} şu an oynuyorum olarak işaretlendi.`);
    } catch (error) {
      setPlayMessage(error instanceof Error ? error.message : "Oyun güncellenemedi.");
    } finally {
      setIsMarkingPlaying(false);
    }
  };

  const handleDetailSave = async (input: GameUpdateInput) => {
    const updatedGame = await saveGameDetails(input);
    setGames((currentGames) =>
      currentGames.map((game) => (game.id === updatedGame.id ? updatedGame : game)),
    );
    setSelectedGame((currentGame) => (currentGame?.id === updatedGame.id ? updatedGame : currentGame));
    setDetailGame(updatedGame);
  };

  const handleDetailDelete = async (game: Game) => {
    await removeGame(game);
    setGames((currentGames) => currentGames.filter((item) => item.id !== game.id));
    setSelectedGame((currentGame) => (currentGame?.id === game.id ? null : currentGame));
    setDetailGame(null);
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
    setSelectedGame((currentGame) => (currentGame?.id === updatedGame.id ? updatedGame : currentGame));
    setDetailGame(updatedGame);

    return "Oyun klasörü kaydedildi ve oyun yüklü olarak işaretlendi.";
  };

  const handleRefreshLanguageSupport = async (game: Game) => {
    const result = await refreshGameLanguageSupport(game);
    setGames((currentGames) =>
      currentGames.map((item) => (item.id === result.game.id ? result.game : item)),
    );
    setSelectedGame((currentGame) => (currentGame?.id === result.game.id ? result.game : currentGame));
    setDetailGame(result.game);
    return result.message;
  };

  const toggleGenre = (genreKey: string) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      genreKeys: currentFilters.genreKeys.includes(genreKey)
        ? currentFilters.genreKeys.filter((key) => key !== genreKey)
        : [...currentFilters.genreKeys, genreKey],
    }));
  };

  return (
    <div className={styles.page}>
      <section className={styles.heroPanel}>
        <div>
          <p className={styles.eyebrow}>Kura merkezi</p>
          <h2>Bugün ne oynayacağını BGaming seçsin.</h2>
          <p className={styles.description}>
            Hızlı kura tüm uygun oyunlardan seçer. Detaylı kura ruh hali, tür ve durum filtrelerini birlikte kullanır.
          </p>
        </div>
        <button className={styles.quickButton} type="button" onClick={quickDraw} disabled={isLoading || isDrawing}>
          Şaşırt Beni!
        </button>
      </section>

      <div className={styles.drawLayout}>
        <section className={styles.drawPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Detaylı kura</p>
              <h3>Filtrelerle seç</h3>
            </div>
            <span>{detailedCandidates.length} uygun oyun</span>
          </div>

          <div className={styles.filterGrid}>
            <CustomSelect
              className={styles.field}
              label="Mood"
              value={filters.mood}
              options={[
                { label: "Mood fark etmez", value: "all" },
                ...moodOptions.map((option) => ({ label: option.label, value: option.value })),
              ]}
              onChange={(value) => setFilters((current) => ({ ...current, mood: value as DrawFilters["mood"] }))}
            />

            <div className={styles.field}>
              <span>Türler</span>
              <div className={styles.genreList}>
                {drawGenres.length > 0 ? (
                  drawGenres.map((genre) => (
                    <label key={genre.key}>
                      <input
                        type="checkbox"
                        checked={filters.genreKeys.includes(genre.key)}
                        onChange={() => toggleGenre(genre.key)}
                      />
                      {genre.label}
                    </label>
                  ))
                ) : (
                  <em>Çekiliş için açık tür yok.</em>
                )}
              </div>
            </div>

            <div className={styles.toggleGrid}>
              <Toggle
                label="Kısa oyun öner"
                checked={filters.shortGame}
                onChange={(value) => setFilters((current) => ({ ...current, shortGame: value, longGame: value ? false : current.longGame }))}
              />
              <Toggle
                label="Uzun oyun öner"
                checked={filters.longGame}
                onChange={(value) => setFilters((current) => ({ ...current, longGame: value, shortGame: value ? false : current.shortGame }))}
              />
              <Toggle
                label="Oynamadığım oyunlardan seç"
                checked={filters.unplayedOnly}
                onChange={(value) => setFilters((current) => ({ ...current, unplayedOnly: value }))}
              />
              <Toggle
                label="Sadece yüklü oyunlardan seç"
                checked={filters.installedOnly}
                onChange={(value) => setFilters((current) => ({ ...current, installedOnly: value }))}
              />
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.secondaryButton} type="button" onClick={() => setFilters(emptyFilters)}>
              Filtreleri temizle
            </button>
            <button className={styles.primaryButton} type="button" onClick={detailedDraw} disabled={isLoading || isDrawing}>
              Detaylı kura yap
            </button>
          </div>
        </section>

        <section className={styles.resultPanel}>
          {drawStrip.length > 0 ? (
            <RouletteStrip
              key={drawId}
              games={drawStrip}
              isDrawing={isDrawing}
              winnerIndex={drawWinnerIndex}
              onComplete={(gameId) => finishDraw(gameId)}
            />
          ) : null}
          {selectedGame && !isDrawing ? (
            <DrawResult
              game={selectedGame}
              platforms={platforms}
              onAgain={lastDrawMode === "quick" ? quickDraw : detailedDraw}
              onPlay={() => void markAsPlaying()}
              onOpenDetails={() => setDetailGame(selectedGame)}
              isMarkingPlaying={isMarkingPlaying}
              message={playMessage}
            />
          ) : isDrawing ? (
            <div className={styles.emptyResult}>
              <h3>Çekiliş yapılıyor</h3>
              <p>Seçilen filtrelerdeki oyunlar dönüyor.</p>
            </div>
          ) : (
            <div className={styles.emptyResult}>
              <h3>{emptyMessage ? "Sonuç yok" : "Henüz oyun seçilmedi"}</h3>
              <p>{emptyMessage ?? "Hızlı kura veya detaylı kura ile bir oyun seç."}</p>
            </div>
          )}
        </section>
      </div>

      {detailGame ? (
        <GameDetailModal
          game={detailGame}
          platforms={platforms}
          onClose={() => setDetailGame(null)}
          onSave={handleDetailSave}
          onDelete={handleDetailDelete}
          onRefreshLanguageSupport={handleRefreshLanguageSupport}
          onSelectInstallFolder={handleSelectInstallFolder}
        />
      ) : null}
    </div>
  );
}

type RouletteStripProps = {
  games: Game[];
  isDrawing: boolean;
  winnerIndex: number;
  onComplete: (gameId: number | undefined) => void;
};

function RouletteStrip({ games, isDrawing, winnerIndex, onComplete }: RouletteStripProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const animationRef = useRef<Animation | null>(null);
  const fallbackRef = useRef<number | null>(null);

  const getTargetTranslate = useCallback(() => {
    const shell = shellRef.current;
    const track = trackRef.current;
    const winnerCard = track?.querySelector<HTMLElement>(`[data-draw-index="${winnerIndex}"]`);

    if (!shell || !winnerCard) {
      return 0;
    }

    const shellCenter = shell.clientWidth / 2;
    const cardCenter = winnerCard.offsetLeft + winnerCard.offsetWidth / 2;
    return shellCenter - cardCenter;
  }, [winnerIndex]);

  const getCenteredGameId = useCallback(() => {
    const shell = shellRef.current;
    const track = trackRef.current;
    if (!shell || !track) {
      return games[winnerIndex]?.id;
    }

    const shellRect = shell.getBoundingClientRect();
    const markerX = shellRect.left + shellRect.width / 2;
    const cards = Array.from(track.querySelectorAll<HTMLElement>("[data-game-id]"));
    const centeredCard = cards.reduce<HTMLElement | null>((closest, card) => {
      if (!closest) return card;

      const cardRect = card.getBoundingClientRect();
      const closestRect = closest.getBoundingClientRect();
      const cardDistance = Math.abs(cardRect.left + cardRect.width / 2 - markerX);
      const closestDistance = Math.abs(closestRect.left + closestRect.width / 2 - markerX);
      return cardDistance < closestDistance ? card : closest;
    }, null);
    const gameId = centeredCard?.dataset.gameId ? Number(centeredCard.dataset.gameId) : undefined;

    return Number.isFinite(gameId) ? gameId : games[winnerIndex]?.id;
  }, [games, winnerIndex]);

  const completeOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (fallbackRef.current !== null) {
      window.clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
    onComplete(getCenteredGameId());
  }, [getCenteredGameId, onComplete]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || !isDrawing) return;

    completedRef.current = false;
    animationRef.current?.cancel();
    track.style.transform = "translateX(0px)";

    const frameId = window.requestAnimationFrame(() => {
      const targetTranslate = getTargetTranslate();
      const overshoot = targetTranslate + 34;
      const animation = track.animate(
        [
          { transform: "translateX(0px)" },
          { transform: `translateX(${overshoot}px)`, offset: 0.82 },
          { transform: `translateX(${targetTranslate}px)` },
        ],
        {
          duration: 2500,
          easing: "cubic-bezier(0.12, 0.76, 0.16, 1)",
          fill: "forwards",
        },
      );

      animationRef.current = animation;
      animation.onfinish = () => {
        track.style.transform = `translateX(${targetTranslate}px)`;
        completeOnce();
      };
    });

    fallbackRef.current = window.setTimeout(completeOnce, 3200);

    return () => {
      window.cancelAnimationFrame(frameId);
      animationRef.current?.cancel();
      animationRef.current = null;
      if (fallbackRef.current !== null) {
        window.clearTimeout(fallbackRef.current);
        fallbackRef.current = null;
      }
    };
  }, [completeOnce, getTargetTranslate, isDrawing]);

  return (
    <div ref={shellRef} className={styles.rouletteShell} aria-live="polite">
      <div className={styles.selectorLine}>
        <Sparkles size={18} />
      </div>
      <div
        ref={trackRef}
        className={styles.rouletteTrack}
      >
        {games.map((game, index) => (
          <MiniDrawCard key={`${game.id}-${index}`} game={game} index={index} />
        ))}
      </div>
    </div>
  );
}

function MiniDrawCard({ game, index }: { game: Game; index: number }) {
  const coverSource = getCoverSource(game.coverPath);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [coverSource]);

  return (
    <article className={styles.miniDrawCard} data-game-id={game.id} data-draw-index={index}>
      {coverSource && !game.usePlaceholderCover && !imageFailed ? (
        <img src={coverSource} alt={`${game.title} kapak`} onError={() => setImageFailed(true)} />
      ) : (
        <GameCoverPlaceholder title={game.title} compact />
      )}
      <strong>{game.title}</strong>
    </article>
  );
}

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

type DrawResultProps = {
  game: Game;
  platforms: Platform[];
  onAgain: () => void;
  onPlay: () => void;
  onOpenDetails: () => void;
  isMarkingPlaying: boolean;
  message: string | null;
};

function DrawResult({ game, platforms, onAgain, onPlay, onOpenDetails, isMarkingPlaying, message }: DrawResultProps) {
  const coverSource = getCoverSource(game.coverPath);
  const [imageFailed, setImageFailed] = useState(false);
  const { showPlayedState, showCompleted, showAbandoned, showCurrentlyPlaying } = getGameStatusVisibility(game);
  const platformMap = useMemo(
    () => new Map(platforms.map((platform) => [platform.name, platform])),
    [platforms],
  );

  useEffect(() => {
    setImageFailed(false);
  }, [coverSource]);

  return (
    <article className={styles.resultCard}>
      <button
        className={styles.coverWrap}
        type="button"
        onClick={onOpenDetails}
        aria-label={`${game.title} detaylarını aç`}
      >
        {coverSource && !game.usePlaceholderCover && !imageFailed ? (
          <img src={coverSource} alt={`${game.title} kapak`} onError={() => setImageFailed(true)} />
        ) : (
          <GameCoverPlaceholder title={game.title} />
        )}
        <div className={styles.badges}>
          {game.turkishLanguageSupport !== "unknown" && !game.turkishPatchAvailable ? (
            <span
              className={
                game.turkishLanguageSupport === "yes"
                  ? styles.turkishSupportedBadge
                  : styles.turkishUnsupportedBadge
              }
              title={game.turkishLanguageSupport === "yes" ? "Türkçe desteği var" : "Türkçe desteği yok"}
            >
              <TurkishFlagIcon className={styles.turkishFlag} />
              {game.turkishLanguageSupport === "yes" ? (
                <Check className={styles.languageMark} size={13} />
              ) : (
                <X className={styles.languageMark} size={13} />
              )}
            </span>
          ) : null}
          {game.turkishLanguageSupport === "no" && game.turkishPatchAvailable ? (
            <span className={styles.turkishPatchBadge} title="Türkçe yama var">
              <TurkishFlagIcon className={styles.turkishFlag} />
              Yama
            </span>
          ) : null}
          {showPlayedState ? (
            <span className={game.isPlayed ? styles.playedBadge : styles.unplayedBadge}>
              <Gamepad2 size={16} />
            </span>
          ) : null}
          {showCompleted ? <span className={styles.completedBadge}><Trophy size={16} /></span> : null}
          {showAbandoned ? (
            <span className={styles.abandonedBadge} title="Yarım bırakıldı">
              <Pause size={17} strokeWidth={3} />
            </span>
          ) : null}
          {game.isFavorite ? <span className={styles.favoriteBadge}><Star size={17} fill="currentColor" /></span> : null}
        </div>
      </button>
      <div className={styles.resultInfo}>
        <p>{game.releaseYear ?? "Yıl bilinmiyor"}</p>
        <h3>{game.title}</h3>
        {(game.platformNames ?? []).length > 0 ? (
          <div className={styles.platformBadges} aria-label="Platformlar">
            {(game.platformNames ?? []).map((platformName) => (
              <PlatformBadge
                key={platformName}
                name={platformName}
                platform={platformMap.get(platformName)}
              />
            ))}
          </div>
        ) : null}
        <div className={styles.resultTags}>
          {(game.genreNames ?? [])
            .filter(isUsefulGenreName)
            .slice(0, 4)
            .map((genre) => <span key={genre}>{getGenreDisplayName(genre)}</span>)}
          {showCurrentlyPlaying ? <span>Şu an oynuyorum</span> : null}
        </div>
        {message ? <p className={styles.resultMessage}>{message}</p> : null}
        <div className={styles.resultActions}>
          <button className={styles.secondaryButton} type="button" onClick={onAgain}>
            Başka Göster
          </button>
          <button className={styles.primaryButton} type="button" onClick={onPlay} disabled={isMarkingPlaying}>
            {isMarkingPlaying ? "İşaretleniyor" : "Bunu Oynayacağım"}
          </button>
        </div>
      </div>
    </article>
  );
}

function createDrawStrip(candidates: Game[], selectedGame: Game) {
  const winnerIndex = 40;
  const pool = candidates.length >= 12 ? candidates : Array.from({ length: 12 }, () => candidates).flat();
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const strip = Array.from({ length: 64 }, (_, index) => shuffled[index % shuffled.length]);
  strip[winnerIndex] = selectedGame;

  return { strip, winnerIndex };
}

function getEligibleGames(games: Game[], filters: DrawFilters) {
  return games.filter((game) => {
    if (game.neverShowInRandom) return false;
    if (filters.unplayedOnly && game.isPlayed) return false;
    if (filters.installedOnly && !game.isInstalled) return false;
    if (filters.genreKeys.length > 0 && !gameMatchesAnyDrawGenre(game, filters.genreKeys)) {
      return false;
    }
    if (filters.mood !== "all" && !matchesMood(game, filters.mood)) return false;
    if (filters.shortGame && game.estimatedLength !== "short") return false;
    if (filters.longGame && game.estimatedLength !== "long") return false;
    return true;
  });
}

function pickWeightedGame(candidates: Game[]) {
  const weightedCandidates = candidates.map((game) => ({
    game,
    weight: getGameWeight(game),
  }));
  const totalWeight = weightedCandidates.reduce((total, item) => total + item.weight, 0);
  let cursor = Math.random() * totalWeight;

  for (const item of weightedCandidates) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.game;
    }
  }

  return weightedCandidates[weightedCandidates.length - 1]?.game ?? candidates[0];
}

function getGameWeight(game: Game) {
  let weight = 1;

  if (!game.isPlayed) weight += 3;
  if (game.isFavorite) weight += 0.75;
  if (game.isAbandoned) weight *= 0.35;
  if (game.isCurrentlyPlaying) weight *= 0.45;
  if (game.isCompleted) weight *= 0.65;

  return Math.max(0.1, weight);
}

function matchesMood(game: Game, mood: Mood) {
  const moodOption = moodOptions.find((option) => option.value === mood);
  if (!moodOption) return true;
  const haystack = normalizeGameText(game);
  return moodOption.keywords.some((keyword) => haystack.includes(normalizeTitle(keyword)));
}

function normalizeGameText(game: Game) {
  return normalizeTitle([
    game.title,
    game.notes ?? "",
    game.multiplayerType,
    ...(game.genreNames ?? []),
    ...(game.platformNames ?? []),
  ].join(" "));
}
