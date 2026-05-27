import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { CustomSelect } from "../common/CustomSelect";
import { selectAndStoreCover } from "../../services/coverService";
import type {
  Game,
  GameFormInput,
  Genre,
  MultiplayerType,
  Platform,
  SteamDeckCompatibility,
  TurkishLanguageSupport,
} from "../../types/game";
import { getCoverSource } from "../../utils/coverSource";
import { compareGenreNamesByDisplay, getGenreDisplayName } from "../../utils/genreDisplay";
import { GameCoverPlaceholder } from "./GameCoverPlaceholder";
import styles from "./GameFormModal.module.css";

type GameFormModalProps = {
  mode: "create" | "edit";
  game?: Game;
  genres: Genre[];
  platforms: Platform[];
  onClose: () => void;
  onSave: (input: GameFormInput) => Promise<void>;
};

const currentYear = new Date().getFullYear();

export function GameFormModal({ mode, game, genres, platforms, onClose, onSave }: GameFormModalProps) {
  const [form, setForm] = useState<GameFormInput>(() => createInitialForm(game));
  const [newGenre, setNewGenre] = useState("");
  const [newPlatform, setNewPlatform] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);

  useEffect(() => {
    setForm(createInitialForm(game));
    setError(null);
  }, [game]);

  const genreOptions = useMemo(
    () => [...new Set([...genres.map((genre) => genre.name), ...form.genreNames])].sort(compareGenreNamesByDisplay),
    [form.genreNames, genres],
  );
  const platformOptions = useMemo(
    () =>
      [...new Set([...platforms.map((platform) => platform.name), ...form.platformNames])].sort((a, b) =>
        a.localeCompare(b, "tr"),
      ),
    [form.platformNames, platforms],
  );
  const coverSource = getCoverSource(form.coverPath);
  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(createInitialForm(game)) || newGenre.trim() !== "" || newPlatform.trim() !== "",
    [form, game, newGenre, newPlatform],
  );

  const updateForm = <Key extends keyof GameFormInput>(key: Key, value: GameFormInput[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const toggleListValue = (key: "genreNames" | "platformNames", value: string) => {
    setForm((current) => {
      const values = current[key];
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value].sort((a, b) => a.localeCompare(b, "tr")),
      };
    });
  };

  const addListValue = (key: "genreNames" | "platformNames", value: string) => {
    const cleanValue = value.trim();
    if (!cleanValue) return;

    setForm((current) => ({
      ...current,
      [key]: [...new Set([...current[key], cleanValue])].sort((a, b) => a.localeCompare(b, "tr")),
    }));
  };

  const handleCoverSelect = async () => {
    const coverPath = await selectAndStoreCover();
    if (coverPath) {
      updateForm("coverPath", coverPath);
      updateForm("usePlaceholderCover", false);
    }
  };

  const validate = () => {
    if (!form.title.trim()) return "Oyun adı zorunlu.";
    if (form.releaseYear !== null && (form.releaseYear < 1950 || form.releaseYear > currentYear + 5)) {
      return "Yıl 1950 ile gelecek 5 yıl arasında olmalı.";
    }
    if (form.personalRating !== null && (form.personalRating < 1 || form.personalRating > 10)) {
      return "Puan boş veya 1-10 arasında olmalı.";
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ ...form, title: form.title.trim() });
      onClose();
    } catch (saveError) {
      setError(getSaveErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const requestClose = () => {
    if (hasChanges) {
      setIsExitConfirmOpen(true);
      return;
    }

    onClose();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className={styles.backdrop} onMouseDown={requestClose}>
      <section className={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <button className={styles.closeButton} type="button" aria-label="Kapat" onClick={requestClose}>
          <X size={21} />
        </button>

        <header className={styles.header}>
          <p>{mode === "create" ? "Yeni oyun" : "Oyunu düzenle"}</p>
          <h2>{mode === "create" ? "Oyun Ekle" : form.title}</h2>
        </header>

        <div className={styles.content}>
          <div className={styles.coverBox}>
            {coverSource && !form.usePlaceholderCover ? (
              <img src={coverSource} alt="" className={styles.coverPreview} />
            ) : (
              <GameCoverPlaceholder title={form.title || "BGaming"} compact />
            )}
            <button type="button" onClick={() => void handleCoverSelect()}>
              Kapak Seç
            </button>
            {form.coverPath ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  updateForm("coverPath", null);
                  updateForm("usePlaceholderCover", true);
                }}
              >
                Placeholder kullan
              </button>
            ) : null}
          </div>

          <div className={styles.form}>
            <label>
              Oyun adı
              <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
            </label>
            <label>
              Çıkış yılı
              <input
                type="number"
                value={form.releaseYear ?? ""}
                onChange={(event) =>
                  updateForm("releaseYear", event.target.value ? Number(event.target.value) : null)
                }
              />
            </label>

            <SelectionBlock
              title="Türler"
              options={genreOptions}
              selected={form.genreNames}
              newValue={newGenre}
              displayValue={getGenreDisplayName}
              onNewValueChange={setNewGenre}
              onToggle={(value) => toggleListValue("genreNames", value)}
              onAdd={() => {
                addListValue("genreNames", newGenre);
                setNewGenre("");
              }}
            />
            <SelectionBlock
              title="Platformlar"
              options={platformOptions}
              selected={form.platformNames}
              newValue={newPlatform}
              onNewValueChange={setNewPlatform}
              onToggle={(value) => toggleListValue("platformNames", value)}
              onAdd={() => {
                addListValue("platformNames", newPlatform);
                setNewPlatform("");
              }}
            />

            <div className={styles.toggleGrid}>
              <Toggle label="Oynandı" checked={form.isPlayed} onChange={(value) => updateForm("isPlayed", value)} />
              <Toggle label="Bitti" checked={form.isCompleted} onChange={(value) => updateForm("isCompleted", value)} />
              <Toggle label="Favori" checked={form.isFavorite} onChange={(value) => updateForm("isFavorite", value)} />
              <Toggle
                label="Şu an oynuyorum"
                checked={form.isCurrentlyPlaying}
                onChange={(value) => updateForm("isCurrentlyPlaying", value)}
              />
              <Toggle
                label="Yarım bıraktım"
                checked={form.isAbandoned}
                onChange={(value) => updateForm("isAbandoned", value)}
              />
              <Toggle
                label="Asla kurada gösterme"
                checked={form.neverShowInRandom}
                onChange={(value) => updateForm("neverShowInRandom", value)}
              />
            </div>

            <div className={styles.selectGrid}>
              <CustomSelect
                label="Oyuncu tipi"
                value={form.multiplayerType}
                options={[
                  { label: "Tek oyunculu", value: "singleplayer" },
                  { label: "Çok oyunculu", value: "multiplayer" },
                  { label: "İkisi de", value: "both" },
                  { label: "Bilinmiyor", value: "unknown" },
                ]}
                onChange={(value) => updateForm("multiplayerType", value as MultiplayerType)}
              />
              <CustomSelect
                label="Steam Deck"
                value={form.steamDeckCompatible}
                options={[
                  { label: "Evet", value: "yes" },
                  { label: "Hayır", value: "no" },
                  { label: "Bilinmiyor", value: "unknown" },
                ]}
                onChange={(value) => updateForm("steamDeckCompatible", value as SteamDeckCompatibility)}
              />
              <CustomSelect
                label="Türkçe desteği"
                value={form.turkishLanguageSupport}
                options={[
                  { label: "Bilinmiyor", value: "unknown" },
                  { label: "Var", value: "yes" },
                  { label: "Yok", value: "no" },
                ]}
                onChange={(value) => {
                  updateForm("turkishLanguageSupport", value as TurkishLanguageSupport);
                  if (value !== "no") {
                    updateForm("turkishPatchAvailable", false);
                  }
                }}
              />
              {form.turkishLanguageSupport === "no" ? (
                <CustomSelect
                  label="Türkçe yama"
                  value={form.turkishPatchAvailable ? "yes" : "no"}
                  options={[
                    { label: "Yok", value: "no" },
                    { label: "Var", value: "yes" },
                  ]}
                  onChange={(value) => updateForm("turkishPatchAvailable", value === "yes")}
                />
              ) : null}
              <CustomSelect
                label="Kişisel puan"
                value={form.personalRating === null ? "" : String(form.personalRating)}
                options={[
                  { label: "Boş", value: "" },
                  ...Array.from({ length: 10 }, (_, index) => {
                    const rating = String(index + 1);
                    return { label: rating, value: rating };
                  }),
                ]}
                onChange={(value) => updateForm("personalRating", value ? Number(value) : null)}
              />
              <CustomSelect
                label="Oyun süresi"
                value={form.estimatedLength}
                options={[
                  { label: "Kısa", value: "short" },
                  { label: "Orta", value: "medium" },
                  { label: "Uzun", value: "long" },
                  { label: "Bilinmiyor", value: "unknown" },
                ]}
                onChange={(value) => updateForm("estimatedLength", value as Game["estimatedLength"])}
              />
            </div>

            <label>
              Oyun notları
              <textarea value={form.notes ?? ""} onChange={(event) => updateForm("notes", event.target.value || null)} />
            </label>
          </div>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <footer className={styles.footer}>
          <button className={styles.secondaryButton} type="button" disabled={isSaving} onClick={requestClose}>
            Vazgeç
          </button>
          <button className={styles.primaryButton} type="button" disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving ? "Kaydediliyor" : "Kaydet"}
          </button>
        </footer>

        {isExitConfirmOpen ? (
          <div className={styles.confirmOverlay} role="alertdialog" aria-modal="true">
            <div className={styles.confirmBox}>
              <h3>Kaydedilmemiş değişiklikler var</h3>
              <p>Kaydedilmemiş değişiklikler var. Çıkmak istiyor musunuz?</p>
              <div className={styles.confirmActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setIsExitConfirmOpen(false)}>
                  Düzenlemeye devam et
                </button>
                <button type="button" className={styles.dangerButton} onClick={onClose}>
                  Çık
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

type SelectionBlockProps = {
  title: string;
  options: string[];
  selected: string[];
  newValue: string;
  displayValue?: (value: string) => string;
  onNewValueChange: (value: string) => void;
  onToggle: (value: string) => void;
  onAdd: () => void;
};

function SelectionBlock({
  title,
  options,
  selected,
  newValue,
  displayValue = (value) => value,
  onNewValueChange,
  onToggle,
  onAdd,
}: SelectionBlockProps) {
  return (
    <div className={styles.selectionBlock}>
      <span>{title}</span>
      <div className={styles.optionList}>
        {options.map((option) => (
          <label key={option}>
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />
            {displayValue(option)}
          </label>
        ))}
      </div>
      <div className={styles.addRow}>
        <input value={newValue} placeholder="Yeni ekle" onChange={(event) => onNewValueChange(event.target.value)} />
        <button type="button" onClick={onAdd}>Ekle</button>
      </div>
    </div>
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

function createInitialForm(game?: Game): GameFormInput {
  return {
    id: game?.id,
    title: game?.title ?? "",
    releaseYear: game?.releaseYear ?? null,
    coverPath: game?.coverPath ?? null,
    usePlaceholderCover: game?.usePlaceholderCover ?? true,
    isPlayed: game?.isPlayed ?? false,
    isCompleted: game?.isCompleted ?? false,
    isFavorite: game?.isFavorite ?? false,
    isCurrentlyPlaying: game?.isCurrentlyPlaying ?? false,
    isAbandoned: game?.isAbandoned ?? false,
    isWishlisted: game?.isWishlisted ?? false,
    neverShowInRandom: game?.neverShowInRandom ?? false,
    multiplayerType: game?.multiplayerType ?? "unknown",
    steamDeckCompatible: game?.steamDeckCompatible ?? "unknown",
    personalRating: game?.personalRating ?? null,
    notes: game?.notes ?? null,
    estimatedLength: game?.estimatedLength ?? "unknown",
    turkishLanguageSupport: game?.turkishLanguageSupport ?? "unknown",
    turkishPatchAvailable: game?.turkishPatchAvailable ?? false,
    genreNames: game?.genreNames ?? [],
    platformNames: game?.platformNames ?? [],
  };
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
