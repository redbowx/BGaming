import { useEffect, useMemo, useState } from "react";
import { getLibraryStats, type DistributionItem, type LibraryStats } from "../services/statsService";
import { Share2 } from "lucide-react";
import { ShareProfileModal } from "../components/profile/ShareProfileModal";
import styles from "./StatsPage.module.css";

const emptyStats: LibraryStats = {
  totalGames: 0,
  favoriteGames: 0,
  playedGames: 0,
  unplayedGames: 0,
  completedGames: 0,
  currentlyPlayingGames: 0,
  abandonedGames: 0,
  installedGames: 0,
  manualGames: 0,
  steamGames: 0,
  importGames: 0,
  ratedGames: 0,
  averagePersonalRating: null,
  platformDistribution: [],
  genreDistribution: [],
  yearDistribution: [],
};

export function StatsPage() {
  const [stats, setStats] = useState<LibraryStats>(emptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    void getLibraryStats()
      .then(setStats)
      .finally(() => setIsLoading(false));
  }, []);

  const progress = useMemo(() => getProgressPercent(stats.completedGames, stats.totalGames), [stats]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>Kütüphane özeti</p>
          <h2>İstatistikler</h2>
        </div>
        <div className={styles.headerActions}>
          <span>{isLoading ? "Hesaplanıyor" : `${stats.totalGames} oyun`}</span>
          <button type="button" disabled={isLoading || stats.totalGames === 0} onClick={() => setIsShareModalOpen(true)}>
            <Share2 size={17} />
            Profil Görseli Oluştur
          </button>
        </div>
      </header>

      {stats.totalGames === 0 && !isLoading ? (
        <section className={styles.emptyPanel}>
          <h3>Henüz istatistik yok</h3>
          <p>Oyun ekledikçe bu ekran otomatik olarak dolacak.</p>
        </section>
      ) : (
        <>
          <section className={styles.heroGrid}>
            <article className={styles.totalCard}>
              <span>Toplam oyun</span>
              <strong>{stats.totalGames}</strong>
              <div className={styles.progressTrack}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>Koleksiyonun %{progress} kadarı bitirilmiş görünüyor.</p>
            </article>

            <div className={styles.metricGrid}>
              <MetricCard label="Favori" value={stats.favoriteGames} />
              <MetricCard label="Oynandı" value={stats.playedGames} />
              <MetricCard label="Oynanmadı" value={stats.unplayedGames} />
              <MetricCard label="Bitirilen" value={stats.completedGames} />
              <MetricCard label="Şu an oynuyorum" value={stats.currentlyPlayingGames} />
              <MetricCard label="Yarım bırakılan" value={stats.abandonedGames} />
              <MetricCard label="Puanlanan oyun" value={stats.ratedGames} />
              <MetricCard label="Ortalama puan" value={stats.averagePersonalRating ?? "-"} />
            </div>
          </section>

          <section className={styles.sourceGrid}>
            <MetricCard label="Manuel eklenen" value={stats.manualGames} variant="source" />
            <MetricCard label="Steam" value={stats.steamGames} variant="source" />
            <MetricCard label="Import" value={stats.importGames} variant="source" />
          </section>

          <section className={styles.distributionGrid}>
            <DistributionPanel title="Platformlara göre" items={stats.platformDistribution} />
            <DistributionPanel title="Türlere göre" items={stats.genreDistribution} />
            <DistributionPanel title="Yıllara göre" items={stats.yearDistribution} compact />
          </section>
        </>
      )}
      {isShareModalOpen ? <ShareProfileModal onClose={() => setIsShareModalOpen(false)} /> : null}
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: number | string;
  variant?: "default" | "source";
};

function MetricCard({ label, value, variant = "default" }: MetricCardProps) {
  return (
    <article className={`${styles.metricCard} ${variant === "source" ? styles.sourceCard : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

type DistributionPanelProps = {
  title: string;
  items: DistributionItem[];
  compact?: boolean;
};

function DistributionPanel({ title, items, compact = false }: DistributionPanelProps) {
  const maxCount = Math.max(1, ...items.map((item) => item.count));

  return (
    <article className={styles.distributionPanel}>
      <div className={styles.panelHeader}>
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>

      {items.length > 0 ? (
        <div className={`${styles.barList} ${compact ? styles.compactBars : ""}`}>
          {items.map((item) => (
            <div key={item.label} className={styles.barRow}>
              <div className={styles.barLabel}>
                <strong>{item.label}</strong>
                <span>{item.count}</span>
              </div>
              <div className={styles.barTrack}>
                <span style={{ width: `${Math.max(8, (item.count / maxCount) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.emptyText}>Bu dağılım için veri yok.</p>
      )}
    </article>
  );
}

function getProgressPercent(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}
