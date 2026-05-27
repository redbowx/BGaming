import { useEffect, useState } from "react";
import { Download, FileJson, FileSpreadsheet, FolderSearch, Info, ListPlus, Server, X } from "lucide-react";
import { CustomSelect } from "../common/CustomSelect";
import { platformOptions } from "../../constants/platformOptions";
import { bulkAddGames } from "../../services/bulkImportService";
import {
  importInstalledCandidates,
  scanInstalledGames,
  selectInstalledScanFolder,
  type InstalledGameCandidate,
} from "../../services/installedScanService";
import { importLibraryFile, type ImportKind } from "../../services/importService";
import { getAppSettings, saveAppSettings } from "../../services/settingsService";
import { fetchAndImportSteamLibrary, testSteamConnection } from "../../services/steamService";
import type { AppSettings } from "../../types/settings";
import styles from "./LibraryImportModal.module.css";

type ImportSummary = {
  added: number;
  existing: number;
  platformsUpdated: number;
  skipped: number;
  duplicateCandidates: number;
  coversDownloaded: number;
  errors: number;
  details: string;
  metadataFound?: number;
  metadataMissing?: number;
  foundNew?: number;
  installMarksSuggested?: number;
};

type LibraryImportModalProps = {
  onClose: () => void;
  onImported: () => Promise<void>;
};

const emptySummary: ImportSummary = {
  added: 0,
  existing: 0,
  platformsUpdated: 0,
  skipped: 0,
  duplicateCandidates: 0,
  coversDownloaded: 0,
  errors: 0,
  details: "",
};

export function LibraryImportModal({ onClose, onImported }: LibraryImportModalProps) {
  const [steamApiKey, setSteamApiKey] = useState("");
  const [steamProfile, setSteamProfile] = useState("");
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkPlatform, setBulkPlatform] = useState("Manuel / Bilinmeyen");
  const [bulkInstalled, setBulkInstalled] = useState(false);
  const [bulkMetadata, setBulkMetadata] = useState(true);
  const [scanPlatform, setScanPlatform] = useState("Manuel / Bilinmeyen");
  const [scanCandidates, setScanCandidates] = useState<InstalledGameCandidate[]>([]);
  const [scanFolder, setScanFolder] = useState<string | null>(null);

  useEffect(() => {
    void getAppSettings().then((settings: AppSettings) => {
      setSteamApiKey(settings.steamApiKey);
      setSteamProfile(settings.steamProfile);
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !activeTask) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTask, onClose]);

  const saveSteamFields = async () => {
    await saveAppSettings({
      steamApiKey: steamApiKey.trim(),
      steamProfile: steamProfile.trim(),
    });
  };

  const handleTestSteam = async () => {
    setActiveTask("steam-test");
    setMessage(null);
    setSummary(null);

    try {
      await saveSteamFields();
      const result = await testSteamConnection(steamApiKey, steamProfile);
      setMessage(
        `Steam bağlantısı başarılı: ${result.displayName} (${result.steamId}). Görünen oyun sayısı: ${result.gameCount}.`,
      );
    } catch (error) {
      setMessage(getFriendlyError(error));
    } finally {
      setActiveTask(null);
    }
  };

  const handleFetchSteam = async () => {
    setActiveTask("steam-import");
    setMessage(null);
    setSummary(null);

    try {
      await saveSteamFields();
      const result = await fetchAndImportSteamLibrary(steamApiKey, steamProfile);
      setSummary({
        added: result.added,
        existing: result.existing,
        platformsUpdated: 0,
        skipped: 0,
        duplicateCandidates: result.duplicateCandidates,
        coversDownloaded: result.coversDownloaded,
        errors: result.errors,
        details: `${result.fetched} Steam oyunu okundu. SteamID: ${result.steamId}.`,
      });
      await onImported();
    } catch (error) {
      setMessage(getFriendlyError(error));
    } finally {
      setActiveTask(null);
    }
  };

  const handleFileImport = async (kind: ImportKind) => {
    setActiveTask(kind);
    setMessage(null);
    setSummary(null);

    try {
      const result = await importLibraryFile(kind);
      if (result.parsed === 0) {
        setMessage("Dosya seçilmedi veya okunabilir oyun kaydı bulunamadı.");
        return;
      }

      setSummary({
        added: result.added,
        existing: result.existing,
        platformsUpdated: result.platformsUpdated,
        skipped: result.skipped,
        duplicateCandidates: result.duplicateCandidates,
        coversDownloaded: 0,
        errors: result.errors,
        details: `${result.parsed} kayıt okundu. Var olan oyunlarda platform/tür bilgisi güvenli şekilde birleştirildi.`,
      });
      await onImported();
    } catch (error) {
      setMessage(getFriendlyError(error));
    } finally {
      setActiveTask(null);
    }
  };

  const handleBulkAdd = async () => {
    setActiveTask("bulk");
    setMessage(null);
    setSummary(null);

    try {
      const result = await bulkAddGames({
        text: bulkText,
        platformName: bulkPlatform,
        isInstalled: bulkInstalled,
        enrichMetadata: bulkMetadata,
      });

      if (result.parsed === 0) {
        setMessage("Eklenecek oyun bulunamadı. Her satıra bir oyun adı gelecek şekilde liste yapıştırabilirsin.");
        return;
      }

      setSummary({
        added: result.added,
        existing: result.existing,
        platformsUpdated: result.platformsUpdated,
        skipped: result.skipped,
        duplicateCandidates: result.duplicateCandidates,
        coversDownloaded: 0,
        errors: result.errors,
        metadataFound: result.metadataFound,
        metadataMissing: result.metadataMissing,
        details:
          result.metadataMissing > 0
            ? `${result.parsed} oyun işlendi. Bazı oyunların bilgileri bulunamadı, Koleksiyon Sağlığı ekranından tamamlayabilirsiniz.`
            : `${result.parsed} oyun işlendi. Metadata tamamlama denemesi tamamlandı.`,
      });
      await onImported();
    } catch (error) {
      setMessage(getFriendlyError(error));
    } finally {
      setActiveTask(null);
    }
  };

  const handleSelectScanFolder = async () => {
    setActiveTask("scan-folder");
    setMessage(null);

    try {
      const folder = await selectInstalledScanFolder();
      setScanFolder(folder);
    } catch (error) {
      setMessage(getFriendlyError(error));
    } finally {
      setActiveTask(null);
    }
  };

  const handleScanInstalled = async () => {
    setActiveTask("scan");
    setMessage(null);
    setSummary(null);

    try {
      const candidates = await scanInstalledGames(scanFolder);
      setScanCandidates(candidates);
      if (candidates.length === 0) {
        setMessage("Yüklü oyun bulunamadı. İstersen özel bir klasör seçip tekrar tarayabilirsin.");
      }
    } catch (error) {
      setMessage(getFriendlyError(error));
    } finally {
      setActiveTask(null);
    }
  };

  const handleImportScanned = async () => {
    setActiveTask("scan-import");
    setMessage(null);
    setSummary(null);

    try {
      const result = await importInstalledCandidates(scanCandidates, scanPlatform);
      setSummary({
        added: result.added,
        existing: result.existing,
        platformsUpdated: result.platformsUpdated,
        skipped: result.skipped,
        duplicateCandidates: result.duplicateCandidates,
        coversDownloaded: 0,
        errors: result.errors,
        foundNew: result.foundNew,
        installMarksSuggested: result.installMarksSuggested,
        details: `${result.foundNew} yeni oyun bulundu. ${result.installMarksSuggested} kayıt için yüklü işaretleme önerildi.`,
      });
      setScanCandidates([]);
      await onImported();
    } catch (error) {
      setMessage(getFriendlyError(error));
    } finally {
      setActiveTask(null);
    }
  };

  const toggleScanCandidate = (index: number) => {
    setScanCandidates((current) =>
      current.map((candidate, candidateIndex) =>
        candidateIndex === index ? { ...candidate, selected: !candidate.selected } : candidate,
      ),
    );
  };

  const isBusy = activeTask !== null;

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-import-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Kütüphaneyi güncelle</p>
            <h2 id="library-import-title">Oyunları getir / içe aktar</h2>
          </div>
          <button className={styles.iconButton} type="button" aria-label="Kapat" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className={styles.content}>
          <section className={`${styles.section} ${styles.bulkSection}`}>
            <div className={styles.sectionTitle}>
              <ListPlus size={18} />
              <h3>Toplu Oyun Ekle</h3>
            </div>
            <p className={styles.description}>
              Oyun adlarını alt alta yapıştır. Her dolu satır bir oyun kabul edilir; metadata bulunamazsa kayıt
              placeholder kapakla güvenli şekilde eklenir.
            </p>
            <label className={styles.field}>
              <span>Oyun listesi</span>
              <textarea
                value={bulkText}
                placeholder={"Hades\nCyberpunk 2077\nBaldur's Gate 3"}
                onChange={(event) => setBulkText(event.target.value)}
              />
            </label>
            <div className={styles.formGrid}>
              <CustomSelect
                className={styles.field}
                label="Platform"
                value={bulkPlatform}
                options={platformOptions.map((platform) => ({ label: platform, value: platform }))}
                onChange={setBulkPlatform}
              />
              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={bulkInstalled}
                  onChange={(event) => setBulkInstalled(event.target.checked)}
                />
                Bu oyunlar yüklü
              </label>
              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={bulkMetadata}
                  onChange={(event) => setBulkMetadata(event.target.checked)}
                />
                Metadata otomatik tamamlansın
              </label>
            </div>
            <div className={styles.buttonRow}>
              <button type="button" disabled={isBusy} onClick={() => void handleBulkAdd()}>
                <ListPlus size={16} />
                {activeTask === "bulk" ? "Ekleniyor" : "Toplu Oyun Ekle"}
              </button>
            </div>
          </section>

          <section className={`${styles.section} ${styles.scanSection}`}>
            <div className={styles.sectionTitle}>
              <FolderSearch size={18} />
              <h3>Yüklü Oyunları Tara</h3>
            </div>
            <p className={styles.description}>
              Bu özellik sadece bilgisayarda yüklü olan oyunları bulur; sahip olup yüklemediğin oyunları göremez.
              Steam ve Epic kurulum kayıtları; Ubisoft Connect ve EA App oyun klasörleri güvenli biçimde kontrol edilir.
            </p>
            <div className={styles.buttonRow}>
              <button type="button" disabled={isBusy} onClick={() => void handleSelectScanFolder()}>
                Özel Klasör Seç
              </button>
              <button type="button" disabled={isBusy} onClick={() => void handleScanInstalled()}>
                <FolderSearch size={16} />
                {activeTask === "scan" ? "Taranıyor" : "Yüklü Oyunları Tara"}
              </button>
            </div>
            {scanFolder ? <p className={styles.pathText}>Seçili klasör: {scanFolder}</p> : null}
            {scanCandidates.length > 0 ? (
              <div className={styles.scanPanel}>
                <CustomSelect
                  className={styles.field}
                  label="Platform tahmin edilemeyenler için platform"
                  value={scanPlatform}
                  options={platformOptions.map((platform) => ({ label: platform, value: platform }))}
                  onChange={setScanPlatform}
                />
                <div className={styles.candidateList}>
                  {scanCandidates.map((candidate, index) => (
                    <label key={`${candidate.title}-${candidate.platformName}-${index}`} className={styles.candidateItem}>
                      <input
                        type="checkbox"
                        checked={candidate.selected}
                        disabled={candidate.status === "existingInstalled"}
                        onChange={() => toggleScanCandidate(index)}
                      />
                      <span>
                        <strong>{candidate.title}</strong>
                        <small>
                          {candidate.platformName} ·{" "}
                          {candidate.status === "new"
                            ? "Yeni oyun"
                            : candidate.status === "existingNotInstalled"
                              ? "Kütüphanede var, yüklü işaretlenebilir"
                              : "Zaten kütüphanede ve yüklü"}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                <button type="button" disabled={isBusy} onClick={() => void handleImportScanned()}>
                  {activeTask === "scan-import" ? "Ekleniyor" : "Seçili Bulunanları Ekle"}
                </button>
              </div>
            ) : null}
          </section>

          <section className={`${styles.section} ${styles.steamSection}`}>
            <div className={styles.sectionTitle}>
              <Server size={18} />
              <h3>Steam'den Getir</h3>
            </div>
            <label className={styles.field}>
              <span>Steam API Key</span>
              <input
                type="password"
                value={steamApiKey}
                placeholder="Steam Web API Key"
                onChange={(event) => setSteamApiKey(event.target.value)}
                onBlur={() => void saveSteamFields()}
              />
            </label>
            <label className={styles.field}>
              <span>SteamID veya profil linki</span>
              <input
                value={steamProfile}
                placeholder="7656... veya https://steamcommunity.com/id/..."
                onChange={(event) => setSteamProfile(event.target.value)}
                onBlur={() => void saveSteamFields()}
              />
            </label>
            <div className={styles.buttonRow}>
              <button type="button" disabled={isBusy} onClick={() => void handleTestSteam()}>
                {activeTask === "steam-test" ? "Test ediliyor" : "Steam Bağlantısını Test Et"}
              </button>
              <button type="button" disabled={isBusy} onClick={() => void handleFetchSteam()}>
                <Download size={16} />
                {activeTask === "steam-import" ? "Çekiliyor" : "Steam Kütüphanesini Çek"}
              </button>
            </div>
          </section>

          <section className={`${styles.section} ${styles.fileSection}`}>
            <div className={styles.sectionTitle}>
              <FileSpreadsheet size={18} />
              <h3>Dosyadan İçe Aktar</h3>
            </div>
            <p className={styles.description}>
              CSV ve JSON için en az title, releaseYear, genres, platforms alanları desteklenir.
              Playnite, gelişmiş içe aktarma seçeneklerinden biridir; Library Exporter Advanced CSV çıktısındaki
              Türkçe kolonlar esnek şekilde yakalanır.
            </p>
            <div className={styles.importGrid}>
              <button type="button" disabled={isBusy} onClick={() => void handleFileImport("csv")}>
                <FileSpreadsheet size={17} />
                {activeTask === "csv" ? "CSV aktarılıyor" : "CSV İçe Aktar"}
              </button>
              <button type="button" disabled={isBusy} onClick={() => void handleFileImport("json")}>
                <FileJson size={17} />
                {activeTask === "json" ? "JSON aktarılıyor" : "JSON İçe Aktar"}
              </button>
              <button type="button" disabled={isBusy} onClick={() => void handleFileImport("playnite")}>
                <FileJson size={17} />
                {activeTask === "playnite" ? "Playnite aktarılıyor" : "Playnite İçe Aktar"}
              </button>
            </div>
          </section>

          <section className={styles.supportBox}>
            <Info size={18} />
            <div>
              <strong>Diğer platformlar</strong>
              <p>
                Steam otomatik desteklenir. Epic Games, GOG, Ubisoft Connect, EA App ve Amazon tarafında Steam kadar
                açık ve resmi kişisel kütüphane API akışı olmadığı için şifre ya da hesap bilgisi istemiyoruz. Bu
                platformlar için Yüklü Oyunları Tara, bilgisayarda bulunan Epic Games, Ubisoft Connect ve EA App
                kurulumlarını okuyabilir; diğer oyunlarda Toplu Oyun Ekle, CSV/JSON import ve gelişmiş kullanıcılar
                için Playnite import kullanılabilir.
              </p>
            </div>
          </section>

          {message ? <div className={styles.message}>{message}</div> : null}
          {summary ? <SummaryPanel summary={summary} /> : null}
        </div>
      </section>
    </div>
  );
}

function SummaryPanel({ summary }: { summary: ImportSummary }) {
  return (
    <div className={styles.summary}>
      <p>{summary.details}</p>
      <div className={styles.summaryGrid}>
        <SummaryItem label="Eklenen" value={summary.added} />
        <SummaryItem label="Zaten vardı" value={summary.existing} />
        <SummaryItem label="Platform güncellendi" value={summary.platformsUpdated} />
        <SummaryItem label="Atlanan" value={summary.skipped} />
        <SummaryItem label="Duplicate şüphe" value={summary.duplicateCandidates} />
        <SummaryItem label="Kapak indirildi" value={summary.coversDownloaded} />
        <SummaryItem label="Hata" value={summary.errors} />
        {summary.metadataFound !== undefined ? <SummaryItem label="Metadata bulundu" value={summary.metadataFound} /> : null}
        {summary.metadataMissing !== undefined ? (
          <SummaryItem label="Metadata bulunamadı" value={summary.metadataMissing} />
        ) : null}
        {summary.installMarksSuggested !== undefined ? (
          <SummaryItem label="Yüklü işaretleme önerisi" value={summary.installMarksSuggested} />
        ) : null}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <span className={styles.summaryItem}>
      <strong>{value}</strong>
      {label}
    </span>
  );
}

function getFriendlyError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "İşlem tamamlanamadı. Bağlantı, dosya formatı veya izinleri kontrol et.";
}
