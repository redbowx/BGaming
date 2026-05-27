import { AlertTriangle, Check, Download, TestTube2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Eye, EyeOff, PanelsTopLeft, Power, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { useThemeSettings } from "../app/theme/ThemeProvider";
import { InfoTooltip } from "../components/common/InfoTooltip";
import { LibraryImportModal } from "../components/game/LibraryImportModal";
import { backupLibrary, restoreLibraryBackup, selectBackupFolder } from "../services/backupService";
import { exportLibraryReport, type ExportReportFormat } from "../services/exportReportService";
import { importLibraryFile, type ImportKind } from "../services/importService";
import { resetApplicationData } from "../services/resetService";
import { getAppSettings, saveAppSettings } from "../services/settingsService";
import { getStartupLaunchEnabled, setStartupLaunchEnabled } from "../services/startupService";
import { applyCloseButtonBehavior } from "../services/closeBehaviorService";
import { formatDisplayVersion, getApplicationVersion } from "../services/releaseService";
import { fetchAndImportSteamLibrary, testSteamConnection } from "../services/steamService";
import { setDesktopWidgetOpen, type DesktopWidgetKind } from "../services/widgetWindowService";
import type { AppSettings, CloseButtonBehavior } from "../types/settings";
import type { AccentTheme, ThemeMode } from "../types/theme";
import { defaultDrawGenreKeys, drawGenreOptions, sanitizeDrawGenreKeys } from "../utils/drawGenreOptions";
import styles from "./SettingsPage.module.css";

type SettingsImportSummary = {
  kind: ImportKind;
  parsed: number;
  added: number;
  existing: number;
  platformsUpdated: number;
  skipped: number;
  duplicateCandidates: number;
  errors: number;
};

const themeModeOptions: Array<{ label: string; value: ThemeMode }> = [
  { label: "Karanlık", value: "dark" },
  { label: "Aydınlık", value: "light" },
];

const closeButtonOptions: Array<{ label: string; value: CloseButtonBehavior }> = [
  { label: "Arka planda çalıştır", value: "background" },
  { label: "Uygulamadan çık", value: "quit" },
];

const accentThemeOptions: Array<{ label: string; value: AccentTheme }> = [
  { label: "Mor neon", value: "purpleNeon" },
  { label: "Turuncu", value: "orange" },
  { label: "Mavi", value: "blue" },
  { label: "Yeşil", value: "green" },
  { label: "Gri sade", value: "gray" },
  { label: "Kırmızı", value: "red" },
  { label: "Pembe", value: "pink" },
  { label: "Turkuaz", value: "teal" },
  { label: "Özel", value: "custom" },
];

const initialSettings: AppSettings = {
  themeMode: "dark",
  accentTheme: "purpleNeon",
  smartRandomEnabled: true,
  gridColumns: 5,
  showAllGames: true,
  steamApiKey: "",
  steamProfile: "",
  metadataApiKey: "",
  steamGridDbApiKey: "",
  drawGenreKeys: defaultDrawGenreKeys,
  customAccentFrom: "#a855f7",
  customAccentTo: "#22d3ee",
  quickLauncherWidgetEnabled: false,
  surpriseWidgetEnabled: false,
  quickLauncherWidgetPinned: false,
  quickLauncherWidgetPositionX: null,
  quickLauncherWidgetPositionY: null,
  surpriseWidgetPinned: false,
  surpriseWidgetPositionX: null,
  surpriseWidgetPositionY: null,
  widgetsAlwaysOnTop: false,
  launchAtStartup: false,
  closeButtonBehavior: "background",
  autoCompleteMissingCovers: false,
  autoCompleteMissingGenres: false,
  autoCompleteMissingYears: false,
};

export function SettingsPage() {
  const {
    themeMode,
    accentTheme,
    customAccentFrom,
    customAccentTo,
    setThemeMode,
    setAccentTheme,
    setCustomAccentTheme,
    isThemeReady,
  } = useThemeSettings();
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isSteamBusy, setIsSteamBusy] = useState(false);
  const [activeImport, setActiveImport] = useState<ImportKind | null>(null);
  const [activeReport, setActiveReport] = useState<ExportReportFormat | null>(null);
  const [importSummary, setImportSummary] = useState<SettingsImportSummary | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [restoreBackupPath, setRestoreBackupPath] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [isCustomAccentOpen, setIsCustomAccentOpen] = useState(false);
  const [customDraftFrom, setCustomDraftFrom] = useState("#a855f7");
  const [customDraftTo, setCustomDraftTo] = useState("#22d3ee");
  const [applicationVersion, setApplicationVersion] = useState("1.0");

  useEffect(() => {
    void getApplicationVersion()
      .then((version) => setApplicationVersion(formatDisplayVersion(version)))
      .catch(() => undefined);

    void getAppSettings().then(async (storedSettings) => {
      try {
        const launchAtStartup = await getStartupLaunchEnabled(storedSettings.launchAtStartup);
        const currentSettings = { ...storedSettings, launchAtStartup };
        setSettings(currentSettings);
        if (launchAtStartup !== storedSettings.launchAtStartup) {
          await saveAppSettings({ launchAtStartup });
        }
      } catch {
        setSettings(storedSettings);
      }
    });
  }, []);

  const updateSettings = async (nextSettings: Partial<AppSettings>, message?: string) => {
    setSettings((current) => ({ ...current, ...nextSettings }));
    await saveAppSettings(nextSettings);
    if (message) showNotice(message);
  };

  const handleSmartRandomChange = (value: boolean) => {
    void updateSettings({ smartRandomEnabled: value }, "Akıllı kura ayarı kaydedildi.");
  };

  const handleWidgetToggle = async (
    settingKey: "quickLauncherWidgetEnabled" | "surpriseWidgetEnabled",
    kind: DesktopWidgetKind,
    label: string,
  ) => {
    const enabled = !settings[settingKey];
    setIsBusy(true);
    try {
      await updateSettings({ [settingKey]: enabled });
      await setDesktopWidgetOpen(kind, enabled);
      showNotice(`${label} widgetı ${enabled ? "açıldı" : "kapatıldı"}.`);
    } catch (error) {
      showNotice(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartupLaunchChange = async (enabled: boolean) => {
    setIsBusy(true);
    try {
      await setStartupLaunchEnabled(enabled);
      await updateSettings({ launchAtStartup: enabled });
      showNotice(
        enabled
          ? "BGaming Windows açılışında arka planda başlayacak ve açık widgetları geri getirecek."
          : "BGaming artık Windows açılışında otomatik başlamayacak.",
      );
    } catch (error) {
      showNotice(`Başlangıç ayarı değiştirilemedi: ${getErrorMessage(error)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCloseButtonBehaviorChange = async (behavior: CloseButtonBehavior) => {
    setIsBusy(true);
    try {
      await updateSettings({ closeButtonBehavior: behavior });
      await applyCloseButtonBehavior(behavior);
      showNotice(
        behavior === "background"
          ? "Kapat tuşu artık BGaming'i arka plana alacak."
          : "Kapat tuşu artık BGaming'den tamamen çıkacak.",
      );
    } catch (error) {
      showNotice(`Kapatma davranışı değiştirilemedi: ${getErrorMessage(error)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleMetadataToggle = (key: keyof Pick<
    AppSettings,
    "autoCompleteMissingCovers" | "autoCompleteMissingGenres" | "autoCompleteMissingYears"
  >) => {
    void updateSettings({ [key]: !settings[key] }, "Metadata ayarı kaydedildi.");
  };

  const handleDrawGenreToggle = (genreKey: string) => {
    const nextKeys = settings.drawGenreKeys.includes(genreKey)
      ? settings.drawGenreKeys.filter((key) => key !== genreKey)
      : sanitizeDrawGenreKeys([...settings.drawGenreKeys, genreKey]);

    void updateSettings({ drawGenreKeys: nextKeys }, "Çekiliş türleri güncellendi.");
  };

  const handleDrawGenreReset = () => {
    void updateSettings({ drawGenreKeys: defaultDrawGenreKeys }, "Çekiliş türleri varsayılana döndü.");
  };

  const openCustomAccentModal = () => {
    setCustomDraftFrom(settings.customAccentFrom || customAccentFrom);
    setCustomDraftTo(settings.customAccentTo || customAccentTo);
    setIsCustomAccentOpen(true);
  };

  const handleAccentClick = (nextAccentTheme: AccentTheme) => {
    if (nextAccentTheme === "custom") {
      openCustomAccentModal();
      return;
    }

    void setAccentTheme(nextAccentTheme);
    setSettings((current) => ({ ...current, accentTheme: nextAccentTheme }));
  };

  const handleSaveCustomAccent = async () => {
    await setCustomAccentTheme(customDraftFrom, customDraftTo);
    setSettings((current) => ({
      ...current,
      accentTheme: "custom",
      customAccentFrom: customDraftFrom,
      customAccentTo: customDraftTo,
    }));
    setIsCustomAccentOpen(false);
    showNotice("Özel vurgu rengi kaydedildi.");
  };

  const handleSteamFieldBlur = () => {
    void saveAppSettings({
      steamApiKey: settings.steamApiKey.trim(),
      steamProfile: settings.steamProfile.trim(),
    }).then(() => showNotice("Steam ayarları kaydedildi."));
  };

  const handleTestSteamConnection = async () => {
    setIsSteamBusy(true);
    try {
      await saveSteamSettings();
      const result = await testSteamConnection(settings.steamApiKey, settings.steamProfile);
      showNotice(
        `Steam bağlantısı başarılı: ${result.displayName} (${result.steamId}) - ${result.gameCount} oyun görünüyor.`,
      );
    } catch (error) {
      showNotice(getErrorMessage(error));
    } finally {
      setIsSteamBusy(false);
    }
  };

  const handleImportSteamLibrary = async () => {
    setIsSteamBusy(true);
    try {
      await saveSteamSettings();
      const result = await fetchAndImportSteamLibrary(settings.steamApiKey, settings.steamProfile);
      showNotice(
        `Steam içe aktarma tamamlandı: ${result.fetched} oyun çekildi, ${result.added} eklendi, ${result.existing} zaten vardı, ${result.duplicateCandidates} duplicate şüphesi, ${result.coversDownloaded} kapak indirildi, ${result.errors} hata.`,
      );
    } catch (error) {
      showNotice(getErrorMessage(error));
    } finally {
      setIsSteamBusy(false);
    }
  };

  const saveSteamSettings = async () => {
    await saveAppSettings({
      steamApiKey: settings.steamApiKey.trim(),
      steamProfile: settings.steamProfile.trim(),
    });
  };

  const handleBackup = async () => {
    setIsBusy(true);
    try {
      const backupPath = await backupLibrary();
      showNotice(backupPath ? `Yedek oluşturuldu: ${backupPath}` : "Yedekleme iptal edildi.");
    } catch (error) {
      showNotice(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestore = async () => {
    setIsBusy(true);
    try {
      const backupPath = await selectBackupFolder();
      if (!backupPath) {
        showNotice("Geri yükleme iptal edildi.");
        return;
      }

      setRestoreBackupPath(backupPath);
    } catch (error) {
      showNotice(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreBackupPath) return;

    setIsBusy(true);
    try {
      const result = await restoreLibraryBackup(restoreBackupPath);
      setRestoreBackupPath(null);
      showNotice(result);
    } catch (error) {
      showNotice(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportFile = async (kind: ImportKind) => {
    setActiveImport(kind);
    setImportSummary(null);
    try {
      const result = await importLibraryFile(kind);
      if (result.parsed === 0) {
        showNotice("İçe aktarma iptal edildi veya okunabilir oyun bulunamadı.");
        return;
      }

      setImportSummary({
        kind,
        parsed: result.parsed,
        added: result.added,
        existing: result.existing,
        platformsUpdated: result.platformsUpdated,
        skipped: result.skipped,
        duplicateCandidates: result.duplicateCandidates,
        errors: result.errors,
      });
      showNotice(
        `${kind.toUpperCase()} import tamamlandı: ${result.parsed} kayıt okundu, ${result.added} eklendi, ${result.existing} zaten vardı, ${result.platformsUpdated} platform güncellendi, ${result.skipped} atlandı, ${result.duplicateCandidates} duplicate şüphesi, ${result.errors} hata.`,
      );
    } catch (error) {
      showNotice(getErrorMessage(error));
    } finally {
      setActiveImport(null);
    }
  };

  const handleExportReport = async (format: ExportReportFormat) => {
    setActiveReport(format);
    try {
      const path = await exportLibraryReport(format);
      showNotice(path ? `Kütüphane raporu kaydedildi: ${path}` : "Rapor dışa aktarma iptal edildi.");
    } catch (error) {
      showNotice(getErrorMessage(error));
    } finally {
      setActiveReport(null);
    }
  };

  const handleResetApplication = async () => {
    if (resetConfirmation !== "SİL") {
      showNotice("Devam etmek için onay alanına SİL yazmalısın.");
      return;
    }

    setIsBusy(true);
    try {
      await resetApplicationData();
      showNotice("Kullanıcı verileri silindi. Uygulama ilk kullanım haline döndürülüyor.");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      showNotice(getErrorMessage(error));
    } finally {
      setIsBusy(false);
      setIsResetModalOpen(false);
      setResetConfirmation("");
    }
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4200);
  };

  return (
    <div className={styles.settings}>
      <header className={styles.header}>
        <div>
          <p>Ayarlar</p>
          <h2>BGaming tercihleri</h2>
        </div>
        <div className={styles.headerStatus}>
          <strong>Sürüm v{applicationVersion}</strong>
          <span>{isThemeReady ? "Hazır" : "Hazırlanıyor"}</span>
        </div>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}

      <section className={styles.panel}>
        <SectionIntro eyebrow="Görünüm" title="Tema ayarları" />

        <div className={styles.settingGroup}>
          <div>
            <h3>Tema modu</h3>
            <p>Kütüphane arayüzünün genel ışık dengesini seç.</p>
          </div>

          <div className={styles.segmentedControl} role="group" aria-label="Tema modu">
            {themeModeOptions.map((option) => (
              <button
                key={option.value}
                className={themeMode === option.value ? styles.activeSegment : styles.segment}
                type="button"
                onClick={() => void setThemeMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.settingGroup}>
          <div>
            <h3>Vurgu rengi</h3>
            <p>Menüler, kart vurguları ve aksiyonlar için renk temasını belirle.</p>
          </div>

          <div className={styles.accentGrid}>
            {accentThemeOptions.map((option) => (
              <button
                key={option.value}
                className={
                  accentTheme === option.value
                    ? `${styles.accentButton} ${styles.activeAccent}`
                    : styles.accentButton
                }
                type="button"
                data-accent-option={option.value}
                style={
                  option.value === "custom"
                    ? ({
                        "--swatch-a": settings.customAccentFrom || customAccentFrom,
                        "--swatch-b": settings.customAccentTo || customAccentTo,
                      } as CSSProperties)
                    : undefined
                }
                onClick={() => handleAccentClick(option.value)}
              >
                <span className={styles.swatch} />
                <span>{option.label}</span>
                {accentTheme === option.value ? <Check size={17} /> : null}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <SectionIntro eyebrow="Kura" title="Rastgele seçim davranışı" />
        <div className={styles.settingGroup}>
          <div>
            <h3 className={styles.inlineTitle}>
              Akıllı Kura
              <InfoTooltip text="Akıllı kura, tamamen rastgele seçim yerine oynamadığın, uzun süredir ilgilenmediğin veya favori durumuna göre daha uygun oyunlara ağırlık verir. Kapatıldığında oyunlar tamamen rastgele seçilir." />
            </h3>
            <p>Kura önerilerinde ağırlıklı seçim davranışını aç veya kapat.</p>
          </div>

          <ToggleControl
            checked={settings.smartRandomEnabled}
            onChange={handleSmartRandomChange}
            enabledLabel="Açık"
            disabledLabel="Kapalı"
          />
        </div>
      </section>

      <section className={styles.panel}>
        <SectionIntro
          eyebrow="Masaüstü widgetları"
          title="Hızlı erişim pencereleri"
          infoText="Widgetlar masaüstüne ait küçük pencereler olarak çalışır ve açık uygulamaların önüne geçmez. Yerlerini başlık alanından sürükleyip sabitleyebilirsin."
        />
        <p className={styles.helperText}>
          Oyunlarına uygulamanın tam görünümünü açmadan eriş. Etkin widgetlar BGaming yeniden açıldığında geri gelir.
        </p>
        <div className={styles.widgetGrid}>
          <article className={styles.widgetCard}>
            <PanelsTopLeft size={22} />
            <div>
              <h3>Hızlı Başlatıcı</h3>
              <p>Yüklü oyunlarını ara, başlat veya kurulu klasörünü aç.</p>
            </div>
            <button
              type="button"
              className={settings.quickLauncherWidgetEnabled ? styles.widgetEnabledButton : styles.widgetButton}
              disabled={isBusy}
              onClick={() => void handleWidgetToggle("quickLauncherWidgetEnabled", "quickLauncher", "Hızlı Başlatıcı")}
            >
              {settings.quickLauncherWidgetEnabled ? "Kapat" : "Aç"}
            </button>
          </article>
          <article className={styles.widgetCard}>
            <Sparkles size={22} />
            <div>
              <h3>Şaşırt Beni!</h3>
              <p>Kuraya uygun oyunlardan tek dokunuşla yeni bir öneri seç.</p>
            </div>
            <button
              type="button"
              className={settings.surpriseWidgetEnabled ? styles.widgetEnabledButton : styles.widgetButton}
              disabled={isBusy}
              onClick={() => void handleWidgetToggle("surpriseWidgetEnabled", "surprise", "Şaşırt Beni!")}
            >
              {settings.surpriseWidgetEnabled ? "Kapat" : "Aç"}
            </button>
          </article>
        </div>
        <div className={styles.widgetPreference}>
          <div>
            <Power size={18} />
            <div>
              <strong>Windows açılışında arka planda başlat</strong>
              <p>Bilgisayar açıldığında ana pencereyi göstermeden etkin widgetları masaüstüne getirir.</p>
            </div>
          </div>
          <ToggleControl
            checked={settings.launchAtStartup}
            onChange={(value) => void handleStartupLaunchChange(value)}
          />
        </div>
        <div className={styles.widgetPreference}>
          <div>
            <Power size={18} />
            <div>
              <strong>Kapat tuşu davranışı</strong>
              <p>Programı tamamen kapatabilir veya sistem tepsisinde çalışır halde bırakabilirsin.</p>
            </div>
          </div>
          <div className={styles.segmentedControl} role="group" aria-label="Kapat tuşu davranışı">
            {closeButtonOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={settings.closeButtonBehavior === option.value ? styles.activeSegment : styles.segment}
                disabled={isBusy}
                onClick={() => void handleCloseButtonBehaviorChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <SectionIntro
          eyebrow="Kura türleri"
          title="Çekilişte görünecek türler"
          infoText="Anasayfa detaylı kura bölümünde sadece burada seçili ana oyun türleri görünür. Metadata kaynaklarından gelen yıl, dönem, kamera açısı veya mağaza etiketi gibi yardımcı tag'ler çekiliş filtresine eklenmez."
        />
        <p className={styles.helperText}>
          Bu liste veritabanındaki ham tag’leri değil, oyun camiasında ana tür olarak kullanılan temiz kategorileri
          gösterir. İstemediğin türleri kapatabilir, sonra tekrar açabilirsin.
        </p>
        <div className={styles.drawGenreToolbar}>
          <button type="button" onClick={() => void updateSettings({ drawGenreKeys: drawGenreOptions.map((option) => option.key) }, "Tüm çekiliş türleri açıldı.")}>
            Tümünü aç
          </button>
          <button type="button" onClick={handleDrawGenreReset}>
            Varsayılana dön
          </button>
        </div>
        <div className={styles.drawGenreGrid}>
          {drawGenreOptions.map((option) => {
            const isEnabled = settings.drawGenreKeys.includes(option.key);

            return (
              <button
                key={option.key}
                type="button"
                className={isEnabled ? `${styles.drawGenreCard} ${styles.activeDrawGenre}` : styles.drawGenreCard}
                aria-label={`${option.label} türünü çekilişte ${isEnabled ? "gizle" : "göster"}`}
                onClick={() => handleDrawGenreToggle(option.key)}
              >
                <span>{option.label}</span>
                <strong>{isEnabled ? <Eye size={18} /> : <EyeOff size={18} />}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.panel}>
        <SectionIntro eyebrow="Steam" title="Steam bağlantı hazırlığı" />
        <div className={styles.formGrid}>
          <label>
            <span>Steam API Key</span>
            <input
              type="password"
              value={settings.steamApiKey}
              placeholder="API key"
              onChange={(event) => setSettings((current) => ({ ...current, steamApiKey: event.target.value }))}
              onBlur={handleSteamFieldBlur}
            />
          </label>
          <label>
            <span>SteamID veya profil linki</span>
            <input
              type="text"
              value={settings.steamProfile}
              placeholder="7656119... veya profil URL"
              onChange={(event) => setSettings((current) => ({ ...current, steamProfile: event.target.value }))}
              onBlur={handleSteamFieldBlur}
            />
          </label>
        </div>
        <div className={styles.actionRow}>
          <button type="button" disabled={isSteamBusy} onClick={() => void handleTestSteamConnection()}>
            <TestTube2 size={17} />
            {isSteamBusy ? "Steam işleniyor" : "Steam Bağlantısını Test Et"}
          </button>
          <button type="button" disabled={isSteamBusy} onClick={() => void handleImportSteamLibrary()}>
            <Download size={17} />
            {isSteamBusy ? "Steam işleniyor" : "Steam Kütüphanesini Getir"}
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <SectionIntro eyebrow="Metadata" title="Otomatik tamamlama ayarları" />
        <p className={styles.helperText}>
          Kapak, tür ve çıkış yılı tamamlama uygun otomatik kaynaklarla denenir. Mevcut yıl, tür veya elle seçilmiş
          kapak otomatik olarak ezilmez.
        </p>
        <div className={styles.toggleGrid}>
          <ToggleCard
            title="Eksik kapakları otomatik tamamla"
            checked={settings.autoCompleteMissingCovers}
            onChange={() => handleMetadataToggle("autoCompleteMissingCovers")}
          />
          <ToggleCard
            title="Eksik türleri otomatik tamamla"
            checked={settings.autoCompleteMissingGenres}
            onChange={() => handleMetadataToggle("autoCompleteMissingGenres")}
          />
          <ToggleCard
            title="Eksik yılları otomatik tamamla"
            checked={settings.autoCompleteMissingYears}
            onChange={() => handleMetadataToggle("autoCompleteMissingYears")}
          />
        </div>
      </section>

      <section className={styles.panel}>
        <SectionIntro eyebrow="İçe / Dışa Aktarma" title="Aktarma ve yedekleme" />
        <div className={styles.importInfoBox}>
          Steam otomatik kütüphane çekmeyi destekler. Epic Games, GOG, Ubisoft Connect, EA App ve Amazon tarafında
          Steam kadar açık/resmi kişisel kütüphane bağlantısı olmadığı için şifre istemeyiz. Yüklü Oyunları Tara,
          bilgisayarda bulunan Epic Games, Ubisoft Connect ve EA App kurulumlarını kontrol edebilir; diğer durumlarda
          CSV/JSON, toplu ekleme veya Playnite içe aktarma kullanılabilir.
        </div>
        <div className={styles.actionGrid}>
          <button type="button" onClick={() => setIsImportModalOpen(true)}>
            <Upload size={17} />
            Steam’den getir
          </button>
          <button type="button" onClick={() => setIsImportModalOpen(true)}>
            <Upload size={17} />
            Toplu Oyun Ekle
          </button>
          <button type="button" onClick={() => setIsImportModalOpen(true)}>
            <Upload size={17} />
            Yüklü Oyunları Tara
          </button>
          <button type="button" disabled={activeImport !== null} onClick={() => void handleImportFile("csv")}>
            <Upload size={17} />
            {activeImport === "csv" ? "CSV aktarılıyor" : "CSV içe aktar"}
          </button>
          <button type="button" disabled={activeImport !== null} onClick={() => void handleImportFile("json")}>
            <Upload size={17} />
            {activeImport === "json" ? "JSON aktarılıyor" : "JSON içe aktar"}
          </button>
          <button type="button" disabled={activeImport !== null} onClick={() => void handleImportFile("playnite")}>
            <Upload size={17} />
            {activeImport === "playnite" ? "Playnite aktarılıyor" : "Playnite içe aktar"}
          </button>
          <button type="button" disabled={isBusy} onClick={() => void handleBackup()}>
            <Download size={17} />
            Kütüphaneyi yedekle
          </button>
          <button type="button" disabled={isBusy} onClick={() => void handleRestore()}>
            <Upload size={17} />
            Yedekten geri yükle
          </button>
        </div>
        <div className={styles.reportPanel}>
          <div>
            <h3>Dışa Aktarım Raporları</h3>
            <p>
              Oyun listesini, platformları, türleri ve kütüphane durumlarını CSV veya JSON raporu olarak dışa aktar.
              Rapor oluşturmak mevcut verilerini değiştirmez.
            </p>
          </div>
          <div className={styles.reportActions}>
            <button type="button" disabled={activeReport !== null} onClick={() => void handleExportReport("csv")}>
              <Download size={17} />
              {activeReport === "csv" ? "CSV hazırlanıyor" : "CSV raporu dışa aktar"}
            </button>
            <button type="button" disabled={activeReport !== null} onClick={() => void handleExportReport("json")}>
              <Download size={17} />
              {activeReport === "json" ? "JSON hazırlanıyor" : "JSON raporu dışa aktar"}
            </button>
          </div>
        </div>
        {importSummary ? <ImportSummaryPanel summary={importSummary} /> : null}
      </section>

      <section className={styles.panel}>
        <SectionIntro eyebrow="Uygulama" title="Sürüm bilgisi" />
        <div className={styles.versionCard}>
          <div>
            <h3>BGaming</h3>
            <p>Yeni sürümler GitHub Releases üzerinden açılışta kontrol edilir.</p>
          </div>
          <strong>v{applicationVersion}</strong>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.dangerPanel}`}>
        <SectionIntro
          eyebrow="Tehlikeli alan"
          title="Uygulamayı Sıfırla"
          infoText="Bu işlem geri alınamaz. Devam etmeden önce kütüphanenizi yedeklemeniz önerilir."
        />
        <div className={styles.resetBody}>
          <AlertTriangle size={24} />
          <p>
            Bu işlem kütüphanenizdeki oyunları, ayarları, kapakları ve kullanıcı verilerini silerek uygulamayı ilk
            kullanım haline döndürür.
          </p>
          <button type="button" className={styles.dangerButton} onClick={() => setIsResetModalOpen(true)}>
            Kullanıcı Verilerini Sil
          </button>
        </div>
      </section>

      {isImportModalOpen ? (
        <LibraryImportModal
          onClose={() => setIsImportModalOpen(false)}
          onImported={async () => {
            showNotice("Kütüphane güncellendi.");
          }}
        />
      ) : null}

      {isCustomAccentOpen ? (
        <div className={styles.modalBackdrop} onMouseDown={() => setIsCustomAccentOpen(false)}>
          <section
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>Özel vurgu rengi</h2>
            <p>Gradient vurgu için iki renk seç. Seçim kaydedilir ve sonraki açılışta da korunur.</p>
            <div
              className={styles.customAccentPreview}
              style={{ background: `linear-gradient(135deg, ${customDraftFrom}, ${customDraftTo})` }}
            />
            <div className={styles.colorInputGrid}>
              <label>
                İlk renk
                <input
                  type="color"
                  value={customDraftFrom}
                  onChange={(event) => setCustomDraftFrom(event.target.value)}
                />
              </label>
              <label>
                İkinci renk
                <input
                  type="color"
                  value={customDraftTo}
                  onChange={(event) => setCustomDraftTo(event.target.value)}
                />
              </label>
            </div>
            <div className={styles.confirmActions}>
              <button type="button" onClick={() => setIsCustomAccentOpen(false)}>
                Vazgeç
              </button>
              <button type="button" className={styles.saveAccentButton} onClick={() => void handleSaveCustomAccent()}>
                Kaydet
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {restoreBackupPath ? (
        <div className={styles.modalBackdrop} onMouseDown={() => !isBusy && setRestoreBackupPath(null)}>
          <section
            className={styles.confirmModal}
            role="alertdialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>Yedekten Geri Yükle</h2>
            <p>
              Bu işlem mevcut veritabanı ve kapak verilerini seçtiğin yedekteki verilerle değiştirecek.
              Devam etmeden önce mevcut kütüphaneni yedeklediğinden emin ol.
            </p>
            <div className={styles.restorePath}>{restoreBackupPath}</div>
            <div className={styles.confirmActions}>
              <button type="button" disabled={isBusy} onClick={() => setRestoreBackupPath(null)}>
                Vazgeç
              </button>
              <button type="button" className={styles.dangerButton} disabled={isBusy} onClick={() => void handleConfirmRestore()}>
                {isBusy ? "Geri yükleniyor" : "Onayla ve Geri Yükle"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isResetModalOpen ? (
        <div className={styles.modalBackdrop} onMouseDown={() => setIsResetModalOpen(false)}>
          <section
            className={styles.confirmModal}
            role="alertdialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>Uygulamayı Sıfırla</h2>
            <p>
              Tüm oyunlar, kapaklar, ayarlar ve kullanıcı verileri silinecek. Uygulama ilk kullanım haline dönecek.
              Bu işlem geri alınamaz.
            </p>
            <label>
              Onaylamak için <strong>SİL</strong> yaz
              <input
                value={resetConfirmation}
                onChange={(event) => setResetConfirmation(event.target.value)}
                placeholder="SİL"
              />
            </label>
            <div className={styles.confirmActions}>
              <button type="button" onClick={() => setIsResetModalOpen(false)}>
                Vazgeç
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={isBusy || resetConfirmation !== "SİL"}
                onClick={() => void handleResetApplication()}
              >
                {isBusy ? "Siliniyor" : "Uygulamayı Sıfırla"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

type SectionIntroProps = {
  eyebrow: string;
  title: string;
  infoText?: string;
};

function SectionIntro({ eyebrow, title, infoText }: SectionIntroProps) {
  return (
    <div className={styles.panelHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={infoText ? styles.titleWithInfo : undefined}>
          {title}
          {infoText ? <InfoTooltip text={infoText} /> : null}
        </h2>
      </div>
    </div>
  );
}

function ImportSummaryPanel({ summary }: { summary: SettingsImportSummary }) {
  return (
    <div className={styles.importSummary}>
      <p>{summary.kind.toUpperCase()} içe aktarma sonucu</p>
      <div>
        <SummaryStat label="Okunan satır" value={summary.parsed} />
        <SummaryStat label="Eklenen" value={summary.added} />
        <SummaryStat label="Zaten vardı" value={summary.existing} />
        <SummaryStat label="Platform güncellendi" value={summary.platformsUpdated} />
        <SummaryStat label="Atlanan" value={summary.skipped} />
        <SummaryStat label="Hatalı satır" value={summary.errors} />
        <SummaryStat label="Duplicate şüphesi" value={summary.duplicateCandidates} />
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <span className={styles.summaryStat}>
      <strong>{value}</strong>
      {label}
    </span>
  );
}

type ToggleControlProps = {
  checked: boolean;
  onChange: (value: boolean) => void;
  enabledLabel?: string;
  disabledLabel?: string;
};

function ToggleControl({ checked, onChange, enabledLabel = "Açık", disabledLabel = "Kapalı" }: ToggleControlProps) {
  return (
    <label className={styles.switchControl}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{checked ? enabledLabel : disabledLabel}</span>
    </label>
  );
}

type ToggleCardProps = {
  title: string;
  checked: boolean;
  onChange: () => void;
};

function ToggleCard({ title, checked, onChange }: ToggleCardProps) {
  return (
    <button type="button" className={styles.toggleCard} onClick={onChange}>
      <span>{title}</span>
      <strong>{checked ? "Açık" : "Kapalı"}</strong>
    </button>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}



