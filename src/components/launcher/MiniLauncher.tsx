import { FolderOpen, Gamepad2, Maximize2, Play, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getGames } from "../../services/gameService";
import { launchGame, revealGameFolder } from "../../services/gameLaunchService";
import type { Game } from "../../types/game";
import { getCoverSource } from "../../utils/coverSource";
import { normalizeTitle } from "../../utils/normalizeTitle";
import { GameCoverPlaceholder } from "../game/GameCoverPlaceholder";
import styles from "./MiniLauncher.module.css";

type MiniLauncherProps = {
  onExit: () => void | Promise<void>;
};

export function MiniLauncher({ onExit }: MiniLauncherProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busyGameId, setBusyGameId] = useState<number | null>(null);

  useEffect(() => {
    void getGames()
      .then((loadedGames) => setGames(loadedGames.filter((game) => game.isInstalled)))
      .catch(() => setNotice("Yüklü oyunlar yüklenemedi."));
  }, []);

  const visibleGames = useMemo(() => {
    const query = normalizeTitle(search);
    const filtered = query
      ? games.filter((game) => normalizeTitle(game.title).includes(query))
      : games;

    return [...filtered].sort((first, second) => {
      if (first.isCurrentlyPlaying !== second.isCurrentlyPlaying) {
        return first.isCurrentlyPlaying ? -1 : 1;
      }
      if (first.isFavorite !== second.isFavorite) {
        return first.isFavorite ? -1 : 1;
      }
      return first.title.localeCompare(second.title, "tr");
    });
  }, [games, search]);

  const runAction = async (game: Game, action: (selectedGame: Game) => Promise<string>) => {
    setBusyGameId(game.id);
    setNotice(null);

    try {
      const message = await action(game);
      setNotice(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setBusyGameId(null);
    }
  };

  return (
    <div className={styles.launcher}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Gamepad2 size={18} />
          <div>
            <strong>BGaming</strong>
            <span>Hızlı Başlatıcı</span>
          </div>
        </div>
        <button className={styles.exitButton} type="button" title="Tam görünüme dön" onClick={() => void onExit()}>
          <Maximize2 size={18} />
        </button>
      </header>

      <label className={styles.search}>
        <Search size={17} />
        <input
          type="search"
          placeholder="Yüklü oyun ara"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {notice ? <p className={styles.notice}>{notice}</p> : null}

      <div className={styles.heading}>
        <h2>Yüklü Oyunlar</h2>
        <span>{visibleGames.length}</span>
      </div>

      <section className={styles.list} aria-label="Hızlı başlatılabilir oyunlar">
        {visibleGames.length > 0 ? (
          visibleGames.map((game) => (
            <MiniLaunchCard
              key={game.id}
              game={game}
              busy={busyGameId === game.id}
              onPlay={() => void runAction(game, launchGame)}
              onFolder={() => void runAction(game, revealGameFolder)}
            />
          ))
        ) : (
          <div className={styles.empty}>
            {search ? "Aramanla eşleşen yüklü oyun yok." : "Başlatılabilecek yüklü oyun bulunamadı."}
          </div>
        )}
      </section>
    </div>
  );
}

type MiniLaunchCardProps = {
  game: Game;
  busy: boolean;
  onPlay: () => void;
  onFolder: () => void;
};

function MiniLaunchCard({ game, busy, onPlay, onFolder }: MiniLaunchCardProps) {
  const coverSource = getCoverSource(game.coverPath);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [coverSource]);

  return (
    <article className={styles.card}>
      <div className={styles.cover}>
        {coverSource && !game.usePlaceholderCover && !imageFailed ? (
          <img src={coverSource} alt="" onError={() => setImageFailed(true)} />
        ) : (
          <GameCoverPlaceholder title={game.title} compact />
        )}
      </div>
      <div className={styles.info}>
        <h3 title={game.title}>{game.title}</h3>
        <p>{game.platformNames?.slice(0, 2).join(" / ") || "Platform bilinmiyor"}</p>
      </div>
      <div className={styles.actions}>
        <button type="button" title="Klasörü aç" aria-label={`${game.title} klasörünü aç`} disabled={busy} onClick={onFolder}>
          <FolderOpen size={17} />
        </button>
        <button className={styles.playButton} type="button" title="Oyna" aria-label={`${game.title} oyununu oyna`} disabled={busy} onClick={onPlay}>
          <Play size={18} fill="currentColor" />
        </button>
      </div>
    </article>
  );
}
