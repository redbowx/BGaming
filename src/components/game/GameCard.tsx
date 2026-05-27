import { useEffect, useState } from "react";
import { Check, FolderOpen, Gamepad2, Pause, Play, Star, Trophy, X } from "lucide-react";
import { TurkishFlagIcon } from "../common/TurkishFlagIcon";
import type { Game } from "../../types/game";
import { getCoverSource } from "../../utils/coverSource";
import { getGenreDisplayName } from "../../utils/genreDisplay";
import { getPlatformLogo } from "../../utils/platformLogo";
import { getGameStatusVisibility } from "../../utils/gameStatusVisibility";
import { GameCoverPlaceholder } from "./GameCoverPlaceholder";
import styles from "./GameCard.module.css";

type GameCardProps = {
  game: Game;
  onClick?: (game: Game) => void;
  onPlay?: (game: Game) => void | Promise<void>;
  onOpenFolder?: (game: Game) => void | Promise<void>;
};

export function GameCard({ game, onClick, onPlay, onOpenFolder }: GameCardProps) {
  const coverSource = getCoverSource(game.coverPath);
  const [imageFailed, setImageFailed] = useState(false);
  const { showPlayedState, showCompleted, showAbandoned, showCurrentlyPlaying } = getGameStatusVisibility(game);
  const quickPlatforms = (game.platformNames ?? []).slice(0, 2);
  const quickGenres = (game.genreNames ?? []).slice(0, 2).map(getGenreDisplayName);
  const hiddenPlatformCount = Math.max((game.platformNames?.length ?? 0) - quickPlatforms.length, 0);
  const ratingClass = getRatingClass(game.personalRating);

  useEffect(() => {
    setImageFailed(false);
  }, [coverSource]);

  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(game)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.(game);
        }
      }}
    >
      <div className={styles.coverFrame}>
        {coverSource && !game.usePlaceholderCover && !imageFailed ? (
          <img
            className={styles.cover}
            src={coverSource}
            alt={`${game.title} kapak`}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <GameCoverPlaceholder title={game.title} compact />
        )}

        {game.isInstalled && (onPlay || onOpenFolder) ? (
          <div className={styles.playOverlay}>
            <div className={styles.quickActions}>
              {onPlay ? (
                <button
                  type="button"
                  className={styles.playButton}
                  aria-label={`${game.title} oyununu oyna`}
                  title="Oyna"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onPlay(game);
                  }}
                >
                  <Play size={22} fill="currentColor" />
                </button>
              ) : null}
              {onOpenFolder ? (
                <button
                  type="button"
                  className={styles.folderButton}
                  aria-label={`${game.title} klasörünü aç`}
                  title="Klasörü aç"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onOpenFolder(game);
                  }}
                >
                  <FolderOpen size={22} />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={styles.hoverInfo} aria-hidden="true">
          {quickPlatforms.length > 0 ? (
            <div className={styles.platformRow}>
              {quickPlatforms.map((platformName) => {
                const logo = getPlatformLogo(platformName);
                return (
                  <span className={styles.platformPill} key={platformName}>
                    {logo ? <img src={logo} alt="" /> : null}
                    {platformName}
                  </span>
                );
              })}
              {hiddenPlatformCount > 0 ? <span className={styles.morePill}>+{hiddenPlatformCount}</span> : null}
            </div>
          ) : null}
          {quickGenres.length > 0 ? (
            <div className={styles.genreRow}>
              {quickGenres.map((genreName) => <span key={genreName}>{genreName}</span>)}
            </div>
          ) : null}
          <div className={styles.factRow}>
            {game.isInstalled ? <span className={styles.installedFact}>Yüklü</span> : null}
            {game.personalRating !== null ? (
              <span className={`${styles.ratingFact} ${styles[ratingClass]}`}>
                <Star size={11} fill="currentColor" />
                {game.personalRating}/10
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.badges} aria-label="Oyun durumları">
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
                <Check className={styles.languageMark} size={12} />
              ) : (
                <X className={styles.languageMark} size={12} />
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
            <span
              className={game.isPlayed ? styles.playedBadge : styles.unplayedBadge}
              title={game.isPlayed ? "Oynandı" : "Oynanmadı"}
            >
              <Gamepad2 size={14} />
            </span>
          ) : null}
          {showCompleted ? (
            <span className={styles.completedBadge} title="Bitti">
              <Trophy size={14} />
            </span>
          ) : null}
          {showAbandoned ? (
            <span className={styles.abandonedBadge} title="Yarım bırakıldı">
              <Pause size={14} strokeWidth={3} />
            </span>
          ) : null}
          {game.isFavorite ? (
            <span className={styles.favoriteBadge} title="Favori">
              <Star size={15} fill="currentColor" />
            </span>
          ) : null}
          {showCurrentlyPlaying ? (
            <span className={styles.currentBadge} title="Şu an oynuyorum">
              <Gamepad2 size={14} />
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.info}>
        <h3 title={game.title}>{game.title}</h3>
        <p>{game.releaseYear ?? "Yıl bilinmiyor"}</p>
      </div>
    </article>
  );
}

function getRatingClass(rating: number | null) {
  if (rating === null || rating <= 4) return "ratingLow";
  if (rating <= 6) return "ratingMedium";
  if (rating <= 8) return "ratingGood";
  return "ratingExcellent";
}
