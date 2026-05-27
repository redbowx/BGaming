import { Check, ImageOff, X } from "lucide-react";
import type { CoverCandidate } from "../../services/metadataService";
import styles from "./CoverGalleryModal.module.css";

type CoverGalleryModalProps = {
  gameTitle: string;
  candidates: CoverCandidate[];
  isLoading: boolean;
  isApplying: boolean;
  selectedUrl: string | null;
  onSelect: (candidate: CoverCandidate) => void;
  onApply: () => void;
  onClose: () => void;
};

export function CoverGalleryModal({
  gameTitle,
  candidates,
  isLoading,
  isApplying,
  selectedUrl,
  onSelect,
  onApply,
  onClose,
}: CoverGalleryModalProps) {
  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-gallery-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <p>Kapak seçimi</p>
            <h3 id="cover-gallery-title">{gameTitle}</h3>
          </div>
          <button type="button" aria-label="Galeriyi kapat" className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        {isLoading ? (
          <div className={styles.status}>Kapak seçenekleri aranıyor...</div>
        ) : candidates.length === 0 ? (
          <div className={styles.status}>
            <ImageOff size={25} />
            <span>Bu oyun için seçilebilir kapak bulunamadı.</span>
          </div>
        ) : (
          <div className={styles.grid}>
            {candidates.map((candidate) => {
              const isSelected = selectedUrl === candidate.url;
              return (
                <button
                  key={candidate.url}
                  type="button"
                  className={`${styles.card} ${isSelected ? styles.selected : ""}`}
                  onClick={() => onSelect(candidate)}
                >
                  <img src={candidate.url} alt={`${candidate.matchedTitle} kapak seçeneği`} />
                  <span className={styles.cardMeta}>
                    <strong>{candidate.source}</strong>
                    {candidate.width && candidate.height ? (
                      <small>{candidate.width} x {candidate.height}</small>
                    ) : null}
                  </span>
                  {isSelected ? <Check className={styles.check} size={18} /> : null}
                </button>
              );
            })}
          </div>
        )}

        <footer className={styles.footer}>
          <button className={styles.cancelButton} type="button" onClick={onClose}>
            Vazgeç
          </button>
          <button
            className={styles.applyButton}
            type="button"
            onClick={onApply}
            disabled={!selectedUrl || isApplying || isLoading}
          >
            {isApplying ? "Uygulanıyor" : "Bu Kapağı Kullan"}
          </button>
        </footer>
      </section>
    </div>
  );
}
