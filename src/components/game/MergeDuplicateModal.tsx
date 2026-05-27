import { useEffect, useMemo, useState } from "react";
import type { DuplicateSuspicion } from "../../services/collectionHealthService";
import type { Game } from "../../types/game";
import { getErrorMessage } from "../../utils/errorMessage";
import { getGenreDisplayName } from "../../utils/genreDisplay";
import styles from "./MergeDuplicateModal.module.css";

type MergeDuplicateModalProps = {
  suspicion: DuplicateSuspicion;
  onClose: () => void;
  onConfirm: (primaryGameId: number, secondaryGameId: number) => Promise<void>;
};

export function MergeDuplicateModal({ suspicion, onClose, onConfirm }: MergeDuplicateModalProps) {
  const recommendedPrimaryId = useMemo(
    () => getRichnessScore(suspicion.gameA) >= getRichnessScore(suspicion.gameB) ? suspicion.gameA.id : suspicion.gameB.id,
    [suspicion],
  );
  const [primaryGameId, setPrimaryGameId] = useState(recommendedPrimaryId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryGame = primaryGameId === suspicion.gameA.id ? suspicion.gameA : suspicion.gameB;
  const secondaryGame = primaryGameId === suspicion.gameA.id ? suspicion.gameB : suspicion.gameA;
  const preview = getMergePreview(primaryGame, secondaryGame);

  const handleConfirm = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onConfirm(primaryGame.id, secondaryGame.id);
    } catch (confirmError) {
      setError(getErrorMessage(confirmError, "Oyunlar birleştirilemedi."));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  return (
    <div className={styles.backdrop} onMouseDown={() => !isSaving && onClose()}>
      <section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div>
            <p>Onay gerekli</p>
            <h2>Duplicate kayıtları birleştir</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Kapat">
            x
          </button>
        </header>

        <div className={styles.choiceGrid}>
          <GameChoice
            game={suspicion.gameA}
            checked={primaryGameId === suspicion.gameA.id}
            recommended={recommendedPrimaryId === suspicion.gameA.id}
            onChange={() => setPrimaryGameId(suspicion.gameA.id)}
          />
          <GameChoice
            game={suspicion.gameB}
            checked={primaryGameId === suspicion.gameB.id}
            recommended={recommendedPrimaryId === suspicion.gameB.id}
            onChange={() => setPrimaryGameId(suspicion.gameB.id)}
          />
        </div>

        <div className={styles.previewPanel}>
          <h3>Korunacak bilgiler</h3>
          <ul>
            <li>
              <strong>Ana kayıt:</strong> {primaryGame.title}
            </li>
            <li>
              <strong>İkincil kayıt:</strong> {secondaryGame.title} silinecek, bilgileri ana kayda taşınacak.
            </li>
            <li>
              <strong>Türler:</strong> {preview.genres}
            </li>
            <li>
              <strong>Platformlar:</strong> {preview.platforms}
            </li>
            <li>
              <strong>Kapak:</strong> {preview.cover}
            </li>
            <li>
              <strong>Yıl:</strong> {preview.releaseYear}
            </li>
            <li>
              <strong>Durumlar:</strong> {preview.statuses}
            </li>
            <li>
              <strong>Notlar:</strong> {preview.notes}
            </li>
            <li>
              <strong>Steam AppID:</strong> {preview.steamAppId}
            </li>
          </ul>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <footer className={styles.footer}>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={isSaving}>
            Vazgeç
          </button>
          <button type="button" className={styles.mergeButton} onClick={() => void handleConfirm()} disabled={isSaving}>
            {isSaving ? "Birleştiriliyor" : "Onayla ve birleştir"}
          </button>
        </footer>
      </section>
    </div>
  );
}

type GameChoiceProps = {
  game: Game;
  checked: boolean;
  recommended: boolean;
  onChange: () => void;
};

function GameChoice({ game, checked, recommended, onChange }: GameChoiceProps) {
  return (
    <label className={`${styles.choiceCard} ${checked ? styles.selectedChoice : ""}`}>
      <input type="radio" checked={checked} onChange={onChange} />
      <span className={styles.choiceHeader}>
        <strong>{game.title}</strong>
        {recommended ? <em>Önerilen ana kayıt</em> : null}
      </span>
      <span>{game.releaseYear ?? "Yıl yok"}</span>
      <span>{(game.genreNames ?? []).map(getGenreDisplayName).join(", ") || "Tür yok"}</span>
      <span>{(game.platformNames ?? []).join(", ") || "Platform yok"}</span>
    </label>
  );
}

function getRichnessScore(game: Game) {
  return [
    game.releaseYear,
    game.coverPath && !game.usePlaceholderCover,
    game.personalRating,
    game.notes,
    game.steamAppId,
    game.isFavorite,
    game.isPlayed,
    game.isCompleted,
    game.multiplayerType !== "unknown",
    game.steamDeckCompatible !== "unknown",
    ...(game.genreNames ?? []),
    ...(game.platformNames ?? []),
  ].filter(Boolean).length;
}

function getMergePreview(primaryGame: Game, secondaryGame: Game) {
  const genres = mergeNameLists(primaryGame.genreNames, secondaryGame.genreNames);
  const platforms = mergeNameLists(primaryGame.platformNames, secondaryGame.platformNames);
  const coverSource =
    primaryGame.coverPath && !primaryGame.usePlaceholderCover
      ? "Ana kaydın kapağı korunacak"
      : secondaryGame.coverPath && !secondaryGame.usePlaceholderCover
        ? "İkincil kaydın kapağı alınacak"
        : "Placeholder kullanılacak";
  const statuses = [
    primaryGame.isFavorite || secondaryGame.isFavorite ? "Favori" : null,
    primaryGame.isPlayed || secondaryGame.isPlayed ? "Oynandı" : null,
    primaryGame.isCompleted || secondaryGame.isCompleted ? "Bitti" : null,
    primaryGame.isCurrentlyPlaying || secondaryGame.isCurrentlyPlaying ? "Şu an oynuyorum" : null,
  ].filter(Boolean);

  return {
    genres: genres.map(getGenreDisplayName).join(", ") || "Tür yok",
    platforms: platforms.join(", ") || "Platform yok",
    cover: coverSource,
    releaseYear: primaryGame.releaseYear ?? secondaryGame.releaseYear ?? "Yıl yok",
    statuses: statuses.join(", ") || "Özel durum yok",
    notes: primaryGame.notes && secondaryGame.notes ? "İki kaydın notları da korunacak" : "Mevcut not korunacak",
    steamAppId: primaryGame.steamAppId ?? secondaryGame.steamAppId ?? "Yok",
  };
}

function mergeNameLists(first: string[] = [], second: string[] = []) {
  return Array.from(new Set([...first, ...second])).sort((a, b) => a.localeCompare(b, "tr"));
}
