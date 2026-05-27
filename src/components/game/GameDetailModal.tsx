import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { CustomSelect } from "../common/CustomSelect";
import type {
  Game,
  GameUpdateInput,
  MultiplayerType,
  Platform,
  SteamDeckCompatibility,
  TurkishLanguageSupport,
} from "../../types/game";
import { getCoverSource } from "../../utils/coverSource";
import { getGenreDisplayName } from "../../utils/genreDisplay";
import type { CoverCandidate } from "../../services/metadataService";
import { CoverGalleryModal } from "./CoverGalleryModal";
import { GameCoverPlaceholder } from "./GameCoverPlaceholder";
import { PlatformBadge } from "./PlatformBadge";
import styles from "./GameDetailModal.module.css";

type GameDetailModalProps = {
  game: Game;
  platforms: Platform[];
  onClose: () => void;
  onSave: (input: GameUpdateInput) => Promise<void>;
  onEdit?: (game: Game) => void;
  onDelete: (game: Game) => Promise<void>;
  onFindCoverCandidates?: (game: Game) => Promise<CoverCandidate[]>;
  onApplyCoverCandidate?: (game: Game, candidate: CoverCandidate) => Promise<string>;
  onRefreshMetadata?: (game: Game) => Promise<string>;
  onRefreshLanguageSupport?: (game: Game) => Promise<string>;
  onSelectInstallFolder?: (game: Game) => Promise<string>;
};

type EditableGameFields = Omit<GameUpdateInput, "id">;

export function GameDetailModal({
  game,
  platforms,
  onClose,
  onSave,
  onEdit,
  onDelete,
  onFindCoverCandidates,
  onApplyCoverCandidate,
  onRefreshMetadata,
  onRefreshLanguageSupport,
  onSelectInstallFolder,
}: GameDetailModalProps) {
  const [fields, setFields] = useState<EditableGameFields>(() => toEditableFields(game));
  const [isSaving, setIsSaving] = useState(false);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [isCoverGalleryOpen, setIsCoverGalleryOpen] = useState(false);
  const [isCoverGalleryLoading, setIsCoverGalleryLoading] = useState(false);
  const [isCoverApplying, setIsCoverApplying] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState<CoverCandidate[]>([]);
  const [selectedCover, setSelectedCover] = useState<CoverCandidate | null>(null);
  const [isLanguageLoading, setIsLanguageLoading] = useState(false);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const coverSource = getCoverSource(game.coverPath);

  useEffect(() => {
    setFields(toEditableFields(game));
    setWarning(null);
  }, [game]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const hasChanges = useMemo(
    () => JSON.stringify(fields) !== JSON.stringify(toEditableFields(game)),
    [fields, game],
  );

  const platformMap = useMemo(
    () => new Map(platforms.map((platform) => [platform.name, platform])),
    [platforms],
  );

  const updateField = <Key extends keyof EditableGameFields>(
    key: Key,
    value: EditableGameFields[Key],
  ) => {
    setFields((currentFields) => ({
      ...currentFields,
      [key]: value,
    }));
    setWarning(null);
  };

  const requestClose = () => {
    if (isCoverGalleryOpen) {
      setIsCoverGalleryOpen(false);
      return;
    }
    onClose();
  };

  const handleSave = async () => {
    if (fields.personalRating !== null && (fields.personalRating < 1 || fields.personalRating > 10)) {
      setWarning("Kişisel puan 1-10 arasında veya boş olmalı.");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ id: game.id, ...fields });
      setWarning(null);
      onClose();
    } catch (error) {
      setWarning(getSaveErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMetadataAction = async () => {
    const handler = onRefreshMetadata;
    if (!handler) {
      setWarning("Metadata servisi bu ekranda hazır değil.");
      return;
    }

    setIsMetadataLoading(true);
    try {
      const metadataGame = { ...game, ...fields };
      if (hasChanges) {
        await onSave({ id: game.id, ...fields });
      }
      const message = await handler(metadataGame);
      setWarning(message);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "Metadata yenilenemedi.");
    } finally {
      setIsMetadataLoading(false);
    }
  };

  const handleOpenCoverGallery = async () => {
    if (!onFindCoverCandidates || !onApplyCoverCandidate) {
      setWarning("Kapak galerisi bu ekranda hazır değil.");
      return;
    }
    if (hasChanges) {
      setWarning("Kapak seçmeden önce diğer değişikliklerini kaydet.");
      return;
    }

    setIsCoverGalleryOpen(true);
    setIsCoverGalleryLoading(true);
    setCoverCandidates([]);
    setSelectedCover(null);
    setWarning(null);
    try {
      const candidates = await onFindCoverCandidates(game);
      setCoverCandidates(candidates);
      setSelectedCover(candidates[0] ?? null);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "Kapak seçenekleri bulunamadı.");
      setIsCoverGalleryOpen(false);
    } finally {
      setIsCoverGalleryLoading(false);
    }
  };

  const handleApplyCoverCandidate = async () => {
    if (!selectedCover || !onApplyCoverCandidate) {
      return;
    }
    setIsCoverApplying(true);
    try {
      const message = await onApplyCoverCandidate(game, selectedCover);
      setWarning(message);
      setIsCoverGalleryOpen(false);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "Kapak uygulanamadı.");
    } finally {
      setIsCoverApplying(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    setWarning(null);
    try {
      await onDelete(game);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "Oyun silinemedi.");
      setIsDeleteConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectInstallFolder = async () => {
    if (!onSelectInstallFolder) {
      setWarning("Klasör seçme bu ekranda hazır değil.");
      return;
    }

    setIsSelectingFolder(true);
    setWarning(null);
    try {
      const message = await onSelectInstallFolder({ ...game, ...fields });
      setWarning(message);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "Oyun klasörü kaydedilemedi.");
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const handleRefreshLanguageSupport = async () => {
    if (!onRefreshLanguageSupport) {
      setWarning("Dil bilgisi servisi bu ekranda hazır değil.");
      return;
    }

    setIsLanguageLoading(true);
    setWarning(null);
    try {
      const message = await onRefreshLanguageSupport({ ...game, ...fields });
      setWarning(message);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "Dil bilgisi yenilenemedi.");
    } finally {
      setIsLanguageLoading(false);
    }
  };

  return (
    <div className={styles.backdrop} onMouseDown={requestClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className={styles.closeButton} type="button" aria-label="Kapat" onClick={requestClose}>
          <X size={21} />
        </button>

        <div className={styles.coverColumn}>
          {coverSource && !game.usePlaceholderCover ? (
            <img className={styles.cover} src={coverSource} alt={`${game.title} kapak`} />
          ) : (
            <GameCoverPlaceholder title={game.title} />
          )}
        </div>

        <div className={styles.detailColumn}>
          <header className={styles.header}>
            <label className={styles.yearField}>
              <span>Çıkış yılı</span>
              <input
                type="number"
                min={1950}
                max={new Date().getFullYear() + 5}
                value={fields.releaseYear ?? ""}
                placeholder="Yıl bilinmiyor"
                onChange={(event) =>
                  updateField("releaseYear", event.target.value ? Number(event.target.value) : null)
                }
              />
            </label>
            <h2 id="game-detail-title">{game.title}</h2>
          </header>

          <div className={styles.metaGrid}>
            <MetaBlock label="Türler" values={game.genreNames ?? []} displayValue={getGenreDisplayName} />
            <div className={styles.metaBlock}>
              <span>Platformlar</span>
              <div className={styles.platformList}>
                {(game.platformNames ?? []).length > 0 ? (
                  (game.platformNames ?? []).map((platformName) => {
                    const platform = platformMap.get(platformName);
                    return (
                      <PlatformBadge key={platformName} name={platformName} platform={platform} />
                    );
                  })
                ) : (
                  <em>Yok</em>
                )}
              </div>
            </div>
          </div>

          <div className={styles.metadataActions}>
            <button
              type="button"
              disabled={isCoverGalleryLoading || isCoverApplying}
              onClick={() => void handleOpenCoverGallery()}
            >
              {isCoverGalleryLoading ? "Aranıyor" : "Kapak Yenile"}
            </button>
            <button
              type="button"
              disabled={isMetadataLoading}
              onClick={() => void handleMetadataAction()}
            >
              {isMetadataLoading ? "Yenileniyor" : "Metadata Yenile"}
            </button>
            {onSelectInstallFolder ? (
              <button
                type="button"
                disabled={isSelectingFolder}
                onClick={() => void handleSelectInstallFolder()}
              >
                {isSelectingFolder ? "Seçiliyor" : "Klasör Seç"}
              </button>
            ) : null}
            {onRefreshLanguageSupport ? (
              <button
                type="button"
                disabled={isLanguageLoading}
                onClick={() => void handleRefreshLanguageSupport()}
              >
                {isLanguageLoading ? "Kontrol ediliyor" : "Dil Bilgisini Çek"}
              </button>
            ) : null}
          </div>

          <div className={styles.formGrid}>
            <ToggleField
              label="Oynandı"
              checked={fields.isPlayed}
              onChange={(value) => updateField("isPlayed", value)}
            />
            <ToggleField
              label="Bitti"
              checked={fields.isCompleted}
              onChange={(value) => updateField("isCompleted", value)}
            />
            <ToggleField
              label="Favori"
              checked={fields.isFavorite}
              onChange={(value) => updateField("isFavorite", value)}
            />
            <ToggleField
              label="Şu an oynuyorum"
              checked={fields.isCurrentlyPlaying}
              onChange={(value) => updateField("isCurrentlyPlaying", value)}
            />
            <ToggleField
              label="Yarım bıraktım"
              checked={fields.isAbandoned}
              onChange={(value) => updateField("isAbandoned", value)}
            />
            <ToggleField
              label="Asla kurada gösterme"
              checked={fields.neverShowInRandom}
              onChange={(value) => updateField("neverShowInRandom", value)}
            />
          </div>

          <button
            className={fields.isCurrentlyPlaying ? styles.stopPlayingButton : styles.startPlayingButton}
            type="button"
            onClick={() => updateField("isCurrentlyPlaying", !fields.isCurrentlyPlaying)}
          >
            {fields.isCurrentlyPlaying ? "Oynamayı bıraktım" : "Şu an oynuyorum"}
          </button>

          <div className={styles.selectGrid}>
            <CustomSelect
              label="Oyuncu tipi"
              value={fields.multiplayerType}
              options={[
                { label: "Tek oyunculu", value: "singleplayer" },
                { label: "Çok oyunculu", value: "multiplayer" },
                { label: "İkisi de", value: "both" },
                { label: "Bilinmiyor", value: "unknown" },
              ]}
              onChange={(value) => updateField("multiplayerType", value as MultiplayerType)}
            />

            <CustomSelect
              label="Steam Deck"
              value={fields.steamDeckCompatible}
              options={[
                { label: "Evet", value: "yes" },
                { label: "Hayır", value: "no" },
                { label: "Bilinmiyor", value: "unknown" },
              ]}
              onChange={(value) => updateField("steamDeckCompatible", value as SteamDeckCompatibility)}
            />

            <CustomSelect
              label="Türkçe desteği"
              value={fields.turkishLanguageSupport ?? "unknown"}
              options={[
                { label: "Bilinmiyor", value: "unknown" },
                { label: "Var", value: "yes" },
                { label: "Yok", value: "no" },
              ]}
              onChange={(value) => {
                updateField("turkishLanguageSupport", value as TurkishLanguageSupport);
                if (value !== "no") {
                  updateField("turkishPatchAvailable", false);
                }
              }}
            />

            <CustomSelect
              label="Oyun süresi"
              value={fields.estimatedLength}
              options={[
                { label: "Kısa", value: "short" },
                { label: "Orta", value: "medium" },
                { label: "Uzun", value: "long" },
                { label: "Bilinmiyor", value: "unknown" },
              ]}
              onChange={(value) => updateField("estimatedLength", value as Game["estimatedLength"])}
            />
          </div>

          {fields.turkishLanguageSupport === "no" ? (
            <div className={styles.formGrid}>
              <ToggleField
                label="Türkçe yama var"
                checked={Boolean(fields.turkishPatchAvailable)}
                onChange={(value) => updateField("turkishPatchAvailable", value)}
              />
            </div>
          ) : null}

          <RatingControl
            value={fields.personalRating}
            onChange={(value) => updateField("personalRating", value)}
          />

          <label className={styles.notesField}>
            Oyun notları
            <textarea
              value={fields.notes ?? ""}
              placeholder="Bu oyunla ilgili kişisel notlar..."
              onChange={(event) => updateField("notes", event.target.value || null)}
            />
          </label>

          {warning ? <p className={styles.warning}>{warning}</p> : null}

          <footer className={styles.footer}>
            <button className={styles.dangerButton} type="button" onClick={() => setIsDeleteConfirmOpen(true)}>
              Oyunu Sil
            </button>
            {onEdit ? (
              <button className={styles.secondaryButton} type="button" onClick={() => onEdit(game)}>
                Düzenle
              </button>
            ) : null}
            <button className={styles.secondaryButton} type="button" onClick={requestClose}>
              Vazgeç
            </button>
            <button
              className={styles.saveButton}
              type="button"
              disabled={!hasChanges || isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? "Kaydediliyor" : "Kaydet"}
            </button>
          </footer>
        </div>

        {isDeleteConfirmOpen ? (
          <div className={styles.confirmOverlay} role="alertdialog" aria-modal="true">
            <div className={styles.confirmBox}>
              <h3>Oyunu Sil</h3>
              <p>Bu oyun kütüphaneden silinecek. Bu işlem geri alınamaz.</p>
              <strong>{game.title}</strong>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isDeleting}
                  onClick={() => setIsDeleteConfirmOpen(false)}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={isDeleting}
                  onClick={() => void handleDeleteConfirmed()}
                >
                  {isDeleting ? "Siliniyor" : "Sil"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
      {isCoverGalleryOpen ? (
        <CoverGalleryModal
          gameTitle={game.title}
          candidates={coverCandidates}
          isLoading={isCoverGalleryLoading}
          isApplying={isCoverApplying}
          selectedUrl={selectedCover?.url ?? null}
          onSelect={setSelectedCover}
          onApply={() => void handleApplyCoverCandidate()}
          onClose={() => setIsCoverGalleryOpen(false)}
        />
      ) : null}
    </div>
  );
}

type MetaBlockProps = {
  label: string;
  values: string[];
  displayValue?: (value: string) => string;
};

function MetaBlock({ label, values, displayValue = (value) => value }: MetaBlockProps) {
  return (
    <div className={styles.metaBlock}>
      <span>{label}</span>
      <div className={styles.chipList}>
        {values.length > 0 ? values.map((value) => <strong key={value}>{displayValue(value)}</strong>) : <em>Yok</em>}
      </div>
    </div>
  );
}

type ToggleFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleField({ label, checked, onChange }: ToggleFieldProps) {
  return (
    <label className={styles.toggleField}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

type RatingControlProps = {
  value: number | null;
  onChange: (value: number | null) => void;
};

function RatingControl({ value, onChange }: RatingControlProps) {
  return (
    <div className={styles.ratingField}>
      <div>
        <span>Kişisel puan</span>
        <strong>{value ? `${value}/10` : "Boş"}</strong>
      </div>
      <div className={styles.ratingButtons} role="group" aria-label="Kişisel puan">
        <button
          type="button"
          className={value === null ? styles.activeRating : styles.ratingButton}
          onClick={() => onChange(null)}
        >
          Boş
        </button>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
          <button
            key={rating}
            type="button"
            className={value === rating ? styles.activeRating : styles.ratingButton}
            onClick={() => onChange(rating)}
          >
            {rating}
          </button>
        ))}
      </div>
    </div>
  );
}

function getSaveErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("UNIQUE") && message.includes("normalized_title")) {
    return "Bu isimle kayıtlı başka bir oyun var. Koleksiyon Sağlığı ekranında duplicate olarak birleştirebilirsin.";
  }

  if (message.toLowerCase().includes("database is locked")) {
    return "Veritabanı şu an meşgul. Birkaç saniye sonra tekrar dene.";
  }

  return message || "Oyun kaydedilemedi.";
}

function toEditableFields(game: Game): EditableGameFields {
  return {
    isPlayed: game.isPlayed,
    isCompleted: game.isCompleted,
    isFavorite: game.isFavorite,
    isCurrentlyPlaying: game.isCurrentlyPlaying,
    isAbandoned: game.isAbandoned,
    isWishlisted: game.isWishlisted,
    releaseYear: game.releaseYear,
    neverShowInRandom: game.neverShowInRandom,
    multiplayerType: game.multiplayerType,
    steamDeckCompatible: game.steamDeckCompatible,
    personalRating: game.personalRating,
    notes: game.notes,
    estimatedLength: game.estimatedLength,
    turkishLanguageSupport: game.turkishLanguageSupport,
    turkishPatchAvailable: game.turkishPatchAvailable,
  };
}
