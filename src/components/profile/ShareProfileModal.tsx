import { Download, Image, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createShareableProfileImage,
  saveShareableProfileImage,
  type ProfileImagePeriod,
  type ShareableProfileImage,
} from "../../services/profileImageService";
import styles from "./ShareProfileModal.module.css";

type ShareProfileModalProps = {
  onClose: () => void;
};

export function ShareProfileModal({ onClose }: ShareProfileModalProps) {
  const [image, setImage] = useState<ShareableProfileImage | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [period, setPeriod] = useState<ProfileImagePeriod>("year");

  useEffect(() => {
    let mounted = true;
    setImage(null);
    setMessage(null);
    void createShareableProfileImage(period)
      .then((result) => {
        if (mounted) setImage(result);
      })
      .catch(() => {
        if (mounted) setMessage("Profil görseli hazırlanamadı.");
      });
    return () => {
      mounted = false;
    };
  }, [period]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (!image) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const path = await saveShareableProfileImage(image);
      setMessage(path ? `Profil görseli kaydedildi: ${path}` : "Kaydetme iptal edildi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profil görseli kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Paylaşılabilir profil görseli" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p>PAYLAŞILABİLİR PROFİL</p>
            <h2>Kütüphane görselin</h2>
          </div>
          <button className={styles.closeButton} type="button" onClick={onClose} aria-label="Kapat">
            <X size={21} />
          </button>
        </header>
        <div className={styles.content}>
          <div className={styles.preview}>
            {image ? <img src={image.dataUrl} alt="BGaming profil görseli önizlemesi" /> : <span>Görsel hazırlanıyor...</span>}
          </div>
          <aside>
            <Image size={28} />
            <h3>Paylaşıma hazır PNG</h3>
            <p>Seçilen dönemde kütüphanene eklediğin oyunların özeti hazırlanır. Notların ve dosya yolların paylaşılmaz.</p>
            <div className={styles.periodControl} aria-label="Profil görseli dönemi">
              <button
                type="button"
                className={period === "month" ? styles.activePeriod : undefined}
                onClick={() => setPeriod("month")}
              >
                Bu Ay
              </button>
              <button
                type="button"
                className={period === "year" ? styles.activePeriod : undefined}
                onClick={() => setPeriod("year")}
              >
                Bu Yıl
              </button>
            </div>
            {message ? <div className={styles.message}>{message}</div> : null}
            <button className={styles.saveButton} type="button" disabled={!image || isSaving} onClick={() => void handleSave()}>
              <Download size={18} />
              {isSaving ? "Kaydediliyor" : "PNG olarak kaydet"}
            </button>
          </aside>
        </div>
      </section>
    </div>
  );
}
