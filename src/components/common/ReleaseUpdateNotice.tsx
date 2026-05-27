import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { checkForAvailableRelease, formatDisplayVersion, type AvailableRelease } from "../../services/releaseService";
import styles from "./ReleaseUpdateNotice.module.css";

export function ReleaseUpdateNotice() {
  const [release, setRelease] = useState<AvailableRelease | null>(null);

  useEffect(() => {
    let active = true;
    let timeoutId: number | undefined;

    void checkForAvailableRelease()
      .then((nextRelease) => {
        if (!active || !nextRelease) return;
        setRelease(nextRelease);
        timeoutId = window.setTimeout(() => setRelease(null), 8000);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!release) return null;

  return (
    <div className={styles.notice} role="status" aria-live="polite">
      <div>
        <strong>Yeni BGaming sürümü hazır</strong>
        <span>v{formatDisplayVersion(release.latestVersion)} GitHub Releases üzerinde yayınlandı.</span>
      </div>
      <button type="button" aria-label="Güncelleme bildirimini kapat" onClick={() => setRelease(null)}>
        <X size={17} />
      </button>
    </div>
  );
}
