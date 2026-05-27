use std::{
    env,
    fs,
    path::{Path, PathBuf},
    process::Command,
    str::FromStr,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
    time::{SystemTime, UNIX_EPOCH},
};
use serde::{Deserialize, Serialize};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    Row,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, PhysicalSize, Position, Size, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

const TRAY_ICON_ID: &str = "bgaming-tray";

struct CloseBehaviorState {
    minimize_to_tray: AtomicBool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SteamConnectionResult {
    steam_id: String,
    display_name: String,
    game_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SteamLibraryResult {
    steam_id: String,
    games: Vec<SteamLibraryGame>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppStoragePaths {
    database_url: String,
    covers_dir: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SteamLibraryGame {
    app_id: u32,
    name: String,
    cover_path: Option<String>,
    cover_downloaded: bool,
    cover_error: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct MetadataResult {
    cover_path: Option<String>,
    cover_downloaded: bool,
    genres: Vec<String>,
    release_year: Option<i32>,
    message: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CoverCandidate {
    url: String,
    source: String,
    matched_title: String,
    width: Option<i64>,
    height: Option<i64>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LanguageSupportResult {
    turkish_language_support: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GithubReleaseInfo {
    version: String,
    url: String,
}

#[derive(Deserialize)]
struct GithubReleaseResponse {
    tag_name: String,
    html_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportFileResult {
    path: String,
    content: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct InstalledGameCandidate {
    title: String,
    platform_name: String,
    install_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WindowsShortcutCandidate {
    title: String,
    target_path: String,
    working_directory: String,
    arguments: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchGameResult {
    message: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstalledGameStateInput {
    id: i64,
    steam_app_id: Option<u32>,
    install_path: Option<String>,
    platform_names: Vec<String>,
    is_installed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InstalledGameStateResult {
    id: i64,
    is_installed: bool,
}

#[derive(Serialize, Deserialize)]
struct WindowState {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DuplicateMergeInput {
    primary_game_id: i64,
    secondary_game_id: i64,
    release_year: Option<i32>,
    cover_path: Option<String>,
    use_placeholder_cover: bool,
    personal_rating: Option<i32>,
    notes: Option<String>,
    estimated_length: String,
    is_played: bool,
    is_completed: bool,
    is_favorite: bool,
    is_currently_playing: bool,
    is_abandoned: bool,
    is_installed: bool,
    never_show_in_random: bool,
    multiplayer_type: String,
    steam_deck_compatible: String,
    turkish_language_support: String,
    turkish_patch_available: bool,
    steam_app_id: Option<i64>,
    is_wishlisted: bool,
    genre_names: Vec<String>,
    platform_names: Vec<String>,
}

#[derive(Deserialize)]
struct ResolveVanityResponse {
    response: ResolveVanityInner,
}

#[derive(Deserialize)]
struct ResolveVanityInner {
    success: u8,
    steamid: Option<String>,
    message: Option<String>,
}

#[derive(Deserialize)]
struct PlayerSummariesResponse {
    response: PlayerSummariesInner,
}

#[derive(Deserialize)]
struct PlayerSummariesInner {
    players: Vec<SteamPlayer>,
}

#[derive(Deserialize)]
struct SteamPlayer {
    steamid: String,
    personaname: String,
}

#[derive(Deserialize)]
struct OwnedGamesResponse {
    response: OwnedGamesInner,
}

#[derive(Deserialize)]
struct OwnedGamesInner {
    game_count: Option<usize>,
    games: Option<Vec<OwnedSteamGame>>,
}

#[derive(Deserialize)]
struct OwnedSteamGame {
    appid: u32,
    name: Option<String>,
}

#[tauri::command]
fn fetch_latest_github_release() -> Result<GithubReleaseInfo, String> {
    let response = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| error.to_string())?
        .get("https://api.github.com/repos/redbowx/BGaming/releases/latest")
        .header(reqwest::header::USER_AGENT, "BGaming/1.0 release checker")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .map_err(|error| format!("Güncel sürüm bilgisi alınamadı: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "GitHub release sorgusu başarısız oldu: HTTP {}",
            response.status().as_u16()
        ));
    }

    let release: GithubReleaseResponse = response
        .json()
        .map_err(|error| format!("GitHub release cevabı okunamadı: {error}"))?;

    Ok(GithubReleaseInfo {
        version: release.tag_name,
        url: release.html_url,
    })
}

#[tauri::command]
fn select_and_store_cover(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let Some(source_path) = rfd::FileDialog::new()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp"])
        .pick_file()
    else {
        return Ok(None);
    };

    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png");
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let covers_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("covers");

    fs::create_dir_all(&covers_dir).map_err(|error| error.to_string())?;

    let target_path: PathBuf = covers_dir.join(format!("cover-{timestamp}.{extension}"));
    fs::copy(&source_path, &target_path).map_err(|error| error.to_string())?;

    Ok(Some(target_path.to_string_lossy().to_string()))
}

#[tauri::command]
fn delete_cover_file(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Ok(());
    }

    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn select_import_file(kind: String) -> Result<Option<ImportFileResult>, String> {
    let dialog = match kind.as_str() {
        "csv" => rfd::FileDialog::new().add_filter("CSV", &["csv"]),
        "json" => rfd::FileDialog::new().add_filter("JSON", &["json"]),
        "playnite" => rfd::FileDialog::new().add_filter("Playnite CSV / JSON", &["csv", "json"]),
        _ => rfd::FileDialog::new().add_filter("Import", &["csv", "json"]),
    };
    let Some(path) = dialog.pick_file() else {
        return Ok(None);
    };
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;

    Ok(Some(ImportFileResult {
        path: path.to_string_lossy().to_string(),
        content,
    }))
}

#[tauri::command]
fn save_text_report(default_file_name: String, content: String, extension: String) -> Result<Option<String>, String> {
    let (label, safe_extension) = match extension.as_str() {
        "csv" => ("CSV Raporu", "csv"),
        "json" => ("JSON Raporu", "json"),
        _ => return Err("Desteklenmeyen rapor biçimi.".to_string()),
    };
    let fallback_name = format!("BGaming-kutuphane-raporu.{safe_extension}");
    let requested_name = default_file_name.trim();
    let file_name = if requested_name.is_empty()
        || requested_name.contains('\\')
        || requested_name.contains('/')
        || !requested_name.to_lowercase().ends_with(&format!(".{safe_extension}"))
    {
        fallback_name.as_str()
    } else {
        requested_name
    };

    let Some(path) = rfd::FileDialog::new()
        .set_title("BGaming raporunu kaydet")
        .set_file_name(file_name)
        .add_filter(label, &[safe_extension])
        .save_file()
    else {
        return Ok(None);
    };

    fs::write(&path, content).map_err(|error| error.to_string())?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn save_profile_image(default_file_name: String, bytes: Vec<u8>) -> Result<Option<String>, String> {
    if bytes.is_empty() {
        return Err("Profil görseli verisi boş.".to_string());
    }
    let requested_name = default_file_name.trim();
    let file_name = if requested_name.is_empty()
        || requested_name.contains('\\')
        || requested_name.contains('/')
        || !requested_name.to_lowercase().ends_with(".png")
    {
        "BGaming-profil.png"
    } else {
        requested_name
    };

    let Some(path) = rfd::FileDialog::new()
        .set_title("BGaming profil görselini kaydet")
        .set_file_name(file_name)
        .add_filter("PNG Görseli", &["png"])
        .save_file()
    else {
        return Ok(None);
    };

    fs::write(&path, bytes).map_err(|error| error.to_string())?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn select_scan_folder() -> Result<Option<String>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Taranacak oyun klasörünü seç")
        .pick_folder()
    else {
        return Ok(None);
    };

    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn set_mini_mode(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    if enabled {
        window.unmaximize().map_err(|error| error.to_string())?;
        window
            .set_min_size(Some(Size::Physical(PhysicalSize {
                width: 380,
                height: 560,
            })))
            .map_err(|error| error.to_string())?;
        window
            .set_size(Size::Physical(PhysicalSize {
                width: 430,
                height: 720,
            }))
            .map_err(|error| error.to_string())?;
        window.center().map_err(|error| error.to_string())?;
    } else {
        window
            .set_min_size(Some(Size::Physical(PhysicalSize {
                width: 1000,
                height: 650,
            })))
            .map_err(|error| error.to_string())?;
        window.maximize().map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn set_widget_open(
    app: tauri::AppHandle,
    kind: String,
    open: bool,
) -> Result<(), String> {
    let label = match kind.as_str() {
        "quickLauncher" => "quick-launcher-widget",
        "surprise" => "surprise-widget",
        _ => return Err("Bilinmeyen widget türü.".to_string()),
    };

    let window = app
        .get_webview_window(label)
        .ok_or_else(|| "Widget penceresi hazırlanamadı.".to_string())?;

    window
        .set_always_on_top(false)
        .map_err(|error| error.to_string())?;
    window
        .set_always_on_bottom(true)
        .map_err(|error| error.to_string())?;
    window
        .set_skip_taskbar(true)
        .map_err(|error| error.to_string())?;

    if open {
        window.show().map_err(|error| error.to_string())?;
    } else {
        window.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn set_close_button_behavior(
    state: tauri::State<'_, CloseBehaviorState>,
    minimize_to_tray: bool,
) {
    state
        .minimize_to_tray
        .store(minimize_to_tray, Ordering::Relaxed);
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }

    let tray_id = TRAY_ICON_ID.to_string();
    let _ = app.remove_tray_by_id(&tray_id);
}

fn ensure_tray_icon(app: &tauri::AppHandle) -> Result<(), String> {
    let tray_id = TRAY_ICON_ID.to_string();
    if app.tray_by_id(&tray_id).is_some() {
        return Ok(());
    }

    let open_item = MenuItem::with_id(app, "tray-open", "BGaming'i Aç", true, None::<&str>)
        .map_err(|error| error.to_string())?;
    let quit_item =
        MenuItem::with_id(app, "tray-quit", "Çıkış", true, None::<&str>)
            .map_err(|error| error.to_string())?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])
        .map_err(|error| error.to_string())?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ICON_ID)
        .tooltip("BGaming")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-open" => show_main_window(app),
            "tray-quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn scan_installed_games(extra_folder: Option<String>) -> Result<Vec<InstalledGameCandidate>, String> {
    let mut candidates = Vec::new();

    scan_steam_libraries(&mut candidates);
    scan_epic_manifests(&mut candidates);
    scan_ubisoft_installs(&mut candidates);
    scan_ea_installs(&mut candidates);
    scan_common_game_dirs(&mut candidates);
    scan_windows_shortcuts(&mut candidates);

    if let Some(folder) = extra_folder {
        scan_one_level_directory(&PathBuf::from(folder), "Manuel / Bilinmeyen", &mut candidates);
    }

    candidates.sort_by(|first, second| first.title.cmp(&second.title));
    candidates.dedup_by(|first, second| {
        first.title.eq_ignore_ascii_case(&second.title)
            && first.platform_name.eq_ignore_ascii_case(&second.platform_name)
    });

    Ok(candidates)
}

#[tauri::command]
fn scan_trusted_installed_games() -> Result<Vec<InstalledGameCandidate>, String> {
    let mut candidates = Vec::new();

    scan_steam_libraries(&mut candidates);
    scan_epic_manifests(&mut candidates);
    scan_ubisoft_installs(&mut candidates);
    scan_ea_installs(&mut candidates);
    candidates.retain(|candidate| {
        !should_skip_automatic_candidate(&candidate.title)
            && PathBuf::from(candidate.install_path.trim()).is_dir()
    });
    candidates.sort_by(|first, second| first.title.cmp(&second.title));
    candidates.dedup_by(|first, second| {
        first.title.eq_ignore_ascii_case(&second.title)
            && first.platform_name.eq_ignore_ascii_case(&second.platform_name)
    });

    Ok(candidates)
}

#[tauri::command]
fn check_installed_game_states(games: Vec<InstalledGameStateInput>) -> Result<Vec<InstalledGameStateResult>, String> {
    Ok(games
        .into_iter()
        .map(|game| {
            let is_installed = if game.is_installed {
                verify_recorded_install_state(
                    game.steam_app_id,
                    game.install_path.as_deref(),
                    &game.platform_names,
                )
            } else {
                false
            };

            InstalledGameStateResult {
                id: game.id,
                is_installed,
            }
        })
        .collect())
}

fn verify_recorded_install_state(
    steam_app_id: Option<u32>,
    install_path: Option<&str>,
    platform_names: &[String],
) -> bool {
    if let Some(path) = install_path.and_then(path_to_existing_folder) {
        let normalized_path = normalize_path_for_compare(&path.to_string_lossy());
        if normalized_path.contains("\\steamapps\\common\\") {
            return steam_manifest_contains_install_folder(&path);
        }
        if normalized_path.contains("\\epic games\\") {
            return epic_manifest_contains_install_folder(&path);
        }
        if normalized_path.contains("\\ubisoft game launcher\\games\\") {
            return ubisoft_install_folder_is_current(&path);
        }
        if is_ea_install_folder_path(&path)
            || platform_names.iter().any(|platform| platform.eq_ignore_ascii_case("EA App"))
        {
            return ea_install_folder_is_current(&path);
        }
        return true;
    }

    let is_steam_game = platform_names
        .iter()
        .any(|platform| platform.eq_ignore_ascii_case("Steam"));
    if is_steam_game {
        if let Some(app_id) = steam_app_id {
            return find_steam_install_folder_by_app_id(app_id).is_some();
        }
    }

    false
}

fn steam_manifest_contains_install_folder(folder: &Path) -> bool {
    let expected = normalize_path_for_compare(&folder.to_string_lossy());
    let mut candidates = Vec::new();
    scan_steam_libraries(&mut candidates);

    candidates.iter().any(|candidate| {
        normalize_path_for_compare(&candidate.install_path) == expected
            && PathBuf::from(candidate.install_path.trim()).is_dir()
    })
}

fn epic_manifest_contains_install_folder(folder: &Path) -> bool {
    let expected = normalize_path_for_compare(&folder.to_string_lossy());
    let mut candidates = Vec::new();
    scan_epic_manifests(&mut candidates);

    candidates.iter().any(|candidate| {
        normalize_path_for_compare(&candidate.install_path) == expected
            && PathBuf::from(candidate.install_path.trim()).is_dir()
    })
}

fn ubisoft_install_folder_is_current(folder: &Path) -> bool {
    folder.is_dir()
        && ubisoft_games_roots().iter().any(|root| path_is_inside_root(folder, root))
        && contains_probable_game_executable(folder)
}

fn ea_install_folder_is_current(folder: &Path) -> bool {
    folder.is_dir()
        && ea_games_roots().iter().any(|root| path_is_inside_root(folder, root))
        && contains_probable_game_executable(folder)
}

#[tauri::command]
fn launch_game(
    steam_app_id: Option<u32>,
    launch_via_steam: bool,
    install_path: Option<String>,
    platform_names: Vec<String>,
    title: String,
) -> Result<LaunchGameResult, String> {
    if launch_via_steam {
        let Some(app_id) = steam_app_id else {
            return Err("Steam üzerinden başlatmak için Steam AppID bulunamadı.".to_string());
        };
        launch_uri(&format!("steam://rungameid/{app_id}"))?;
        return Ok(LaunchGameResult {
            message: format!("{title} Steam üzerinden açılıyor."),
        });
    }

    if is_epic_platform(&platform_names) {
        if let Some(epic_uri) = find_epic_launch_uri_for_game(&title, install_path.as_deref()) {
            launch_uri(&epic_uri)?;
            return Ok(LaunchGameResult {
                message: format!("{title} Epic Games Launcher üzerinden açılıyor."),
            });
        }
    }

    let path = install_path
        .as_deref()
        .map(|value| PathBuf::from(value.trim()))
        .filter(|path| path.exists())
        .or_else(|| resolve_game_install_folder(steam_app_id, None, &platform_names, &title))
        .ok_or_else(|| "Bu oyun için çalıştırma yolu bulunamadı. Klasör butonuyla konumu bulmayı veya Yüklü Oyunları Tara ile klasörü kaydetmeyi deneyebilirsin.".to_string())?;
    let executable_path = if path.is_file() {
        path
    } else if path.is_dir() {
        find_launchable_executable(&path)
            .ok_or_else(|| "Bu oyun klasöründe çalıştırılabilir .exe dosyası bulunamadı.".to_string())?
    } else {
        return Err("Bu oyun için kayıtlı çalıştırma yolu artık bulunamıyor.".to_string());
    };

    let mut command = Command::new(&executable_path);
    if let Some(parent) = executable_path.parent() {
        command.current_dir(parent);
    }
    command
        .spawn()
        .map_err(|error| format!("Oyun başlatılamadı: {error}"))?;

    Ok(LaunchGameResult {
        message: format!("{title} açılıyor."),
    })
}

#[tauri::command]
fn reveal_game_folder(
    steam_app_id: Option<u32>,
    install_path: Option<String>,
    platform_names: Vec<String>,
    title: String,
) -> Result<LaunchGameResult, String> {
    let folder = resolve_game_install_folder(steam_app_id, install_path.as_deref(), &platform_names, &title)
        .ok_or_else(|| "Bu oyun için kurulum klasörü bulunamadı. Yüklü Oyunları Tara ile oyun klasörünü kaydetmen gerekir.".to_string())?;

    open_folder(&folder)?;

    Ok(LaunchGameResult {
        message: format!("{title} klasörü açıldı."),
    })
}

#[tauri::command]
fn copy_import_cover(app: tauri::AppHandle, path: String) -> Result<Option<String>, String> {
    if path.trim().is_empty() {
        return Ok(None);
    }

    let source_path = PathBuf::from(path);
    if !source_path.exists() {
        return Ok(None);
    }

    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("jpg");
    let covers_dir = app_data_dir(&app)?.join("covers");
    fs::create_dir_all(&covers_dir).map_err(|error| error.to_string())?;
    let target_path = covers_dir.join(format!("import-cover-{}.{}", timestamp()?, extension));
    fs::copy(source_path, &target_path).map_err(|error| error.to_string())?;

    Ok(Some(target_path.to_string_lossy().to_string()))
}

#[tauri::command]
fn get_app_storage_paths(app: tauri::AppHandle) -> Result<AppStoragePaths, String> {
    let app_data = app_data_dir(&app)?;
    let covers_dir = app_data.join("covers");

    fs::create_dir_all(&covers_dir).map_err(|error| error.to_string())?;

    Ok(AppStoragePaths {
        database_url: format!("sqlite:{}", app_data.join("bgaming.db").to_string_lossy()),
        covers_dir: covers_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
async fn merge_duplicate_games_native(app: tauri::AppHandle, input: DuplicateMergeInput) -> Result<(), String> {
    if input.primary_game_id == input.secondary_game_id {
        return Err("Aynı oyun kendi üzerine birleştirilemez.".to_string());
    }

    let database_path = app_data_dir(&app)?.join("bgaming.db");
    let database_url = format!("sqlite:{}", database_path.to_string_lossy());
    let options = SqliteConnectOptions::from_str(&database_url)
        .map_err(|error| error.to_string())?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(30))
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(30))
        .connect_with(options)
        .await
        .map_err(sqlite_error_message)?;

    sqlx::query("PRAGMA busy_timeout = 30000")
        .execute(&pool)
        .await
        .map_err(sqlite_error_message)?;
    sqlx::query("PRAGMA journal_mode = WAL")
        .execute(&pool)
        .await
        .map_err(sqlite_error_message)?;
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .map_err(sqlite_error_message)?;

    let mut transaction = pool.begin().await.map_err(sqlite_error_message)?;

    let primary_exists: i64 = sqlx::query("SELECT COUNT(*) AS count FROM games WHERE id = ?")
        .bind(input.primary_game_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(sqlite_error_message)?
        .get("count");
    let secondary_exists: i64 = sqlx::query("SELECT COUNT(*) AS count FROM games WHERE id = ?")
        .bind(input.secondary_game_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(sqlite_error_message)?
        .get("count");

    if primary_exists == 0 || secondary_exists == 0 {
        return Err("Birleştirilecek oyunlardan biri artık bulunamadı.".to_string());
    }

    sqlx::query(
        r#"
        UPDATE games
        SET
          release_year = ?,
          cover_path = ?,
          use_placeholder_cover = ?,
          personal_rating = ?,
          notes = ?,
          estimated_length = ?,
          is_played = ?,
          is_completed = ?,
          is_favorite = ?,
          is_currently_playing = ?,
          is_abandoned = ?,
          is_installed = ?,
          never_show_in_random = ?,
          multiplayer_type = ?,
          steam_deck_compatible = ?,
          turkish_language_support = ?,
          turkish_patch_available = ?,
          steam_app_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#,
    )
    .bind(input.release_year)
    .bind(input.cover_path.as_deref())
    .bind(bool_to_int(input.use_placeholder_cover))
    .bind(input.personal_rating)
    .bind(input.notes.as_deref())
    .bind(input.estimated_length.as_str())
    .bind(bool_to_int(input.is_played))
    .bind(bool_to_int(input.is_completed))
    .bind(bool_to_int(input.is_favorite))
    .bind(bool_to_int(input.is_currently_playing))
    .bind(bool_to_int(input.is_abandoned))
    .bind(bool_to_int(input.is_installed))
    .bind(bool_to_int(input.never_show_in_random))
    .bind(input.multiplayer_type.as_str())
    .bind(input.steam_deck_compatible.as_str())
    .bind(input.turkish_language_support.as_str())
    .bind(bool_to_int(input.turkish_patch_available))
    .bind(input.steam_app_id)
    .bind(input.primary_game_id)
    .execute(&mut *transaction)
    .await
    .map_err(sqlite_error_message)?;

    sqlx::query(
        r#"
        INSERT OR IGNORE INTO game_genres (game_id, genre_id)
        SELECT ?, genre_id
        FROM game_genres
        WHERE game_id = ?
        "#,
    )
    .bind(input.primary_game_id)
    .bind(input.secondary_game_id)
    .execute(&mut *transaction)
    .await
    .map_err(sqlite_error_message)?;

    sqlx::query(
        r#"
        INSERT OR IGNORE INTO game_platforms (game_id, platform_id)
        SELECT ?, platform_id
        FROM game_platforms
        WHERE game_id = ?
        "#,
    )
    .bind(input.primary_game_id)
    .bind(input.secondary_game_id)
    .execute(&mut *transaction)
    .await
    .map_err(sqlite_error_message)?;

    for genre_name in clean_names(&input.genre_names) {
        sqlx::query("INSERT OR IGNORE INTO genres (name) VALUES (?)")
            .bind(genre_name.as_str())
            .execute(&mut *transaction)
            .await
            .map_err(sqlite_error_message)?;
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO game_genres (game_id, genre_id)
            SELECT ?, id FROM genres WHERE name = ?
            "#,
        )
        .bind(input.primary_game_id)
        .bind(genre_name.as_str())
        .execute(&mut *transaction)
        .await
        .map_err(sqlite_error_message)?;
    }

    for platform_name in clean_names(&input.platform_names) {
        sqlx::query("INSERT OR IGNORE INTO platforms (name, logo_path) VALUES (?, NULL)")
            .bind(platform_name.as_str())
            .execute(&mut *transaction)
            .await
            .map_err(sqlite_error_message)?;
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO game_platforms (game_id, platform_id)
            SELECT ?, id FROM platforms WHERE name = ?
            "#,
        )
        .bind(input.primary_game_id)
        .bind(platform_name.as_str())
        .execute(&mut *transaction)
        .await
        .map_err(sqlite_error_message)?;
    }

    if input.is_wishlisted {
        sqlx::query("INSERT OR IGNORE INTO wishlist (game_id) VALUES (?)")
            .bind(input.primary_game_id)
            .execute(&mut *transaction)
            .await
            .map_err(sqlite_error_message)?;
    }

    sqlx::query(
        r#"
        DELETE FROM duplicate_candidates
        WHERE game_a_id = ?
           OR game_b_id = ?
           OR game_a_id = game_b_id
        "#,
    )
    .bind(input.secondary_game_id)
    .bind(input.secondary_game_id)
    .execute(&mut *transaction)
    .await
    .map_err(sqlite_error_message)?;

    sqlx::query("DELETE FROM wishlist WHERE game_id = ?")
        .bind(input.secondary_game_id)
        .execute(&mut *transaction)
        .await
        .map_err(sqlite_error_message)?;
    sqlx::query("DELETE FROM game_genres WHERE game_id = ?")
        .bind(input.secondary_game_id)
        .execute(&mut *transaction)
        .await
        .map_err(sqlite_error_message)?;
    sqlx::query("DELETE FROM game_platforms WHERE game_id = ?")
        .bind(input.secondary_game_id)
        .execute(&mut *transaction)
        .await
        .map_err(sqlite_error_message)?;
    let delete_result = sqlx::query("DELETE FROM games WHERE id = ?")
        .bind(input.secondary_game_id)
        .execute(&mut *transaction)
        .await
        .map_err(sqlite_error_message)?;

    if delete_result.rows_affected() == 0 {
        return Err("İkincil oyun kaydı silinemedi.".to_string());
    }

    transaction.commit().await.map_err(sqlite_error_message)?;
    pool.close().await;

    Ok(())
}

#[tauri::command]
fn test_steam_connection(api_key: String, steam_profile: String) -> Result<SteamConnectionResult, String> {
    let api_key = clean_required(&api_key, "Steam API Key bos olamaz.")?;
    let steam_id = resolve_steam_id(&api_key, &steam_profile)?;
    let player = fetch_player_summary(&api_key, &steam_id)?;
    let games = fetch_owned_games(&api_key, &steam_id)?;

    Ok(SteamConnectionResult {
        steam_id: player.steamid,
        display_name: player.personaname,
        game_count: games.response.game_count.unwrap_or(0),
    })
}

#[tauri::command]
fn fetch_steam_library(app: tauri::AppHandle, api_key: String, steam_profile: String) -> Result<SteamLibraryResult, String> {
    let api_key = clean_required(&api_key, "Steam API Key bos olamaz.")?;
    let steam_id = resolve_steam_id(&api_key, &steam_profile)?;
    let response = fetch_owned_games(&api_key, &steam_id)?;
    let Some(games) = response.response.games else {
        return Err("Steam kütüphanesi okunamadı. Profil gizli olabilir veya API erişimi engellenmiş olabilir.".to_string());
    };

    let mut imported_games = Vec::new();

    for game in games {
        let Some(name) = game.name.filter(|value| !value.trim().is_empty()) else {
            continue;
        };
        let (cover_path, cover_error) = download_steam_cover(&app, game.appid);

        imported_games.push(SteamLibraryGame {
            app_id: game.appid,
            name,
            cover_downloaded: cover_path.is_some(),
            cover_path,
            cover_error,
        });
    }

    Ok(SteamLibraryResult {
        steam_id,
        games: imported_games,
    })
}

#[tauri::command]
fn fetch_game_metadata(
    app: tauri::AppHandle,
    steam_app_id: Option<u32>,
    title: String,
    metadata_api_key: Option<String>,
    steam_grid_db_api_key: Option<String>,
) -> Result<MetadataResult, String> {
    let metadata_api_key = clean_optional_api_key(metadata_api_key);
    let steam_grid_db_api_key = clean_optional_api_key(steam_grid_db_api_key);
    let clean_title = title.trim();

    if clean_title.is_empty() {
        return Ok(MetadataResult {
            cover_path: None,
            cover_downloaded: false,
            genres: Vec::new(),
            release_year: None,
            message: "Metadata araması için oyun adı boş olamaz.".to_string(),
        });
    };

    if let Some(app_id) = steam_app_id {
        let mut results = Vec::new();
        let mut errors = Vec::new();

        if let Some(api_key) = steam_grid_db_api_key.as_deref() {
            collect_metadata_result(
                fetch_steam_grid_db_metadata(&app, api_key, clean_title, Some(app_id)),
                &mut results,
                &mut errors,
            );
        }
        collect_metadata_result(
            fetch_steam_grid_db_public_metadata(&app, clean_title),
            &mut results,
            &mut errors,
        );
        collect_metadata_result(
            fetch_steam_metadata_by_app_id(&app, app_id, None),
            &mut results,
            &mut errors,
        );
        if let Some(api_key) = metadata_api_key.as_deref() {
            collect_metadata_result(
                fetch_rawg_metadata(&app, api_key, clean_title),
                &mut results,
                &mut errors,
            );
        }
        collect_metadata_result(
            fetch_known_game_metadata(clean_title),
            &mut results,
            &mut errors,
        );

        return Ok(combine_metadata_results(results).unwrap_or_else(|| {
            empty_metadata_result(
                errors
                    .first()
                    .map(String::as_str)
                    .unwrap_or("Bu oyun için metadata bulunamadı."),
            )
        }));
    }

    let mut results = Vec::new();
    let mut errors = Vec::new();

    if let Some(api_key) = steam_grid_db_api_key.as_deref() {
        collect_metadata_result(
            fetch_steam_grid_db_metadata(&app, api_key, clean_title, None),
            &mut results,
            &mut errors,
        );
    }
    collect_metadata_result(
        fetch_steam_grid_db_public_metadata(&app, clean_title),
        &mut results,
        &mut errors,
    );
    if let Some((app_id, matched_title)) = find_steam_app_id_by_title(clean_title)? {
        collect_metadata_result(
            fetch_steam_metadata_by_app_id(&app, app_id, Some(matched_title)),
            &mut results,
            &mut errors,
        );
    }
    if let Some(api_key) = metadata_api_key.as_deref() {
        collect_metadata_result(
            fetch_rawg_metadata(&app, api_key, clean_title),
            &mut results,
            &mut errors,
        );
    }
    collect_metadata_result(
        fetch_known_game_metadata(clean_title),
        &mut results,
        &mut errors,
    );

    Ok(combine_metadata_results(results).unwrap_or_else(|| {
        empty_metadata_result(
            errors
                .first()
                .map(String::as_str)
                .unwrap_or("Bu oyun için güvenilir metadata eşleşmesi bulunamadı."),
        )
    }))
}

#[tauri::command]
fn fetch_cover_candidates(
    steam_app_id: Option<u32>,
    title: String,
    steam_grid_db_api_key: Option<String>,
) -> Result<Vec<CoverCandidate>, String> {
    let clean_title = title.trim();
    if clean_title.is_empty() {
        return Err("Kapak araması için oyun adı gerekli.".to_string());
    }

    let mut candidates = Vec::new();
    if let Some(api_key) = clean_optional_api_key(steam_grid_db_api_key).as_deref() {
        if let Ok(Some((game_id, matched_title, _))) = find_steam_grid_db_game(api_key, clean_title, steam_app_id) {
            if let Ok(api_candidates) = fetch_steam_grid_db_cover_candidates(api_key, game_id, &matched_title) {
                candidates.extend(api_candidates);
            }
        }
    }

    if candidates.is_empty() {
        if let Ok(public_candidates) = fetch_public_steam_grid_db_cover_candidates(clean_title) {
            candidates.extend(public_candidates);
        }
    }

    if let Some(app_id) = steam_app_id.or_else(|| {
        find_steam_app_id_by_title(clean_title)
            .ok()
            .flatten()
            .map(|item| item.0)
    }) {
        candidates.push(CoverCandidate {
            url: format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{app_id}/library_600x900.jpg"),
            source: "Steam resmi kapak".to_string(),
            matched_title: clean_title.to_string(),
            width: Some(600),
            height: Some(900),
        });
    }

    candidates.retain(|candidate| !candidate.url.trim().is_empty());
    candidates.dedup_by(|first, second| first.url == second.url);
    candidates.truncate(18);
    Ok(candidates)
}

#[tauri::command]
fn store_cover_candidate(app: tauri::AppHandle, url: String, title: String) -> Result<String, String> {
    if !is_allowed_cover_candidate_url(&url) {
        return Err("Seçilen kapak kaynağına izin verilmiyor.".to_string());
    }

    let file_name = format!(
        "selected-cover-{}-{}.{}",
        safe_metadata_file_stem(&title),
        timestamp()?,
        cover_file_extension_from_url(&url)
    );
    let (path, error) = download_cover_from_url(&app, &url, &file_name);
    path.ok_or_else(|| error.unwrap_or_else(|| "Kapak indirilemedi.".to_string()))
}

#[tauri::command]
fn fetch_game_language_info(
    steam_app_id: Option<u32>,
    title: String,
) -> Result<LanguageSupportResult, String> {
    let clean_title = title.trim();
    if clean_title.is_empty() {
        return Ok(LanguageSupportResult {
            turkish_language_support: "unknown".to_string(),
            message: "Dil bilgisi için oyun adı gerekli.".to_string(),
        });
    }

    if let Some(result) = known_language_support_override(clean_title) {
        return Ok(result);
    }

    let steam_message_prefix = match steam_app_id {
        Some(app_id) => Some((app_id, clean_title.to_string())),
        None => match find_steam_app_id_by_title(clean_title) {
            Ok(app_id) => app_id,
            Err(error) => {
                if let Some(result) = fetch_pc_gaming_wiki_language_info(clean_title, Some(error.clone()))? {
                    return Ok(result);
                }
                return Ok(unknown_language_result(format!("Steam araması tamamlanamadı: {error}")));
            }
        },
    };

    let Some((app_id, matched_title)) = steam_message_prefix else {
        if let Some(result) = fetch_pc_gaming_wiki_language_info(clean_title, None)? {
            return Ok(result);
        }
        return Ok(unknown_language_result(
            "Steam mağazasında ve PCGamingWiki içinde güvenilir oyun eşleşmesi bulunamadı.",
        ));
    };

    let steam_result = fetch_steam_language_info_by_app_id(app_id, Some(matched_title));
    match steam_result {
        Ok(result) if result.turkish_language_support != "unknown" => Ok(result),
        Ok(result) => {
            if let Some(fallback) = fetch_pc_gaming_wiki_language_info(clean_title, Some(result.message.clone()))? {
                return Ok(fallback);
            }
            Ok(result)
        }
        Err(error) => {
            if let Some(fallback) = fetch_pc_gaming_wiki_language_info(clean_title, Some(error.clone()))? {
                return Ok(fallback);
            }
            Ok(unknown_language_result(format!("Steam dil bilgisi okunamadı: {error}")))
        }
    }
}

fn fetch_steam_metadata_by_app_id(
    app: &tauri::AppHandle,
    app_id: u32,
    matched_title: Option<String>,
) -> Result<MetadataResult, String> {
    let url = format!("https://store.steampowered.com/api/appdetails?appids={app_id}&l=turkish");
    let response: serde_json::Value = reqwest::blocking::get(url)
        .map_err(|_| "Steam metadata servisine ulaşılamadı. İnternet bağlantını kontrol et.".to_string())?
        .error_for_status()
        .map_err(|error| map_steam_http_error(error.status().map(|status| status.as_u16())))?
        .json()
        .map_err(|_| "Steam metadata yanıtı okunamadı.".to_string())?;

    let app_id_key = app_id.to_string();
    let data = response
        .get(&app_id_key)
        .and_then(|item| item.get("data"))
        .ok_or_else(|| "Steam bu oyun için metadata döndürmedi.".to_string())?;
    let mut genres = data
        .get("genres")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("description").and_then(|value| value.as_str()))
                .map(|value| value.to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    genres.extend(fetch_steam_store_tags(app_id).unwrap_or_default());
    genres.sort();
    genres.dedup();
    let release_year = data
        .get("release_date")
        .and_then(|value| value.get("date"))
        .and_then(|value| value.as_str())
        .and_then(parse_release_year);
    let cover_url = data
        .get("header_image")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string());
    let (cover_path, cover_error) = if let Some(url) = cover_url {
        download_cover_from_url(&app, &url, &format!("metadata-steam-{app_id}.jpg"))
    } else {
        (None, Some("Steam kapak görseli bulunamadı.".to_string()))
    };

    Ok(MetadataResult {
        cover_downloaded: cover_path.is_some(),
        cover_path,
        genres,
        release_year,
        message: cover_error.unwrap_or_else(|| {
            matched_title
                .map(|title| format!("Başlığa göre Steam Store eşleşmesi bulundu: {title}."))
                .unwrap_or_else(|| "Metadata bulundu.".to_string())
        }),
    })
}

fn fetch_steam_language_info_by_app_id(
    app_id: u32,
    matched_title: Option<String>,
) -> Result<LanguageSupportResult, String> {
    let url = format!("https://store.steampowered.com/api/appdetails?appids={app_id}&l=turkish");
    let response: serde_json::Value = reqwest::blocking::get(url)
        .map_err(|_| "Steam dil bilgisi servisine ulaşılamadı. İnternet bağlantını kontrol et.".to_string())?
        .error_for_status()
        .map_err(|error| map_steam_http_error(error.status().map(|status| status.as_u16())))?
        .json()
        .map_err(|_| "Steam dil bilgisi yanıtı okunamadı.".to_string())?;

    let app_id_key = app_id.to_string();
    let data = response
        .get(&app_id_key)
        .and_then(|item| item.get("data"))
        .ok_or_else(|| "Steam bu oyun için dil bilgisi döndürmedi.".to_string())?;
    let supported_languages = data
        .get("supported_languages")
        .and_then(|value| value.as_str())
        .unwrap_or_default();

    if supported_languages.trim().is_empty() {
        return Ok(LanguageSupportResult {
            turkish_language_support: "unknown".to_string(),
            message: "Steam sayfasında desteklenen diller alanı bulunamadı.".to_string(),
        });
    }

    let normalized_languages = strip_html_tags(supported_languages).to_lowercase();
    let has_turkish = normalized_languages.contains("turkish")
        || normalized_languages.contains("türkçe")
        || normalized_languages.contains("turkce");
    let support = if has_turkish { "yes" } else { "no" };
    let prefix = matched_title
        .map(|title| format!("Steam eşleşmesi: {title}. "))
        .unwrap_or_default();
    let message = if has_turkish {
        format!("{prefix}Türkçe dil desteği bulundu.")
    } else {
        format!("{prefix}Steam desteklenen dillerinde Türkçe görünmüyor.")
    };

    Ok(LanguageSupportResult {
        turkish_language_support: support.to_string(),
        message,
    })
}

fn strip_html_tags(value: &str) -> String {
    let mut output = String::new();
    let mut inside_tag = false;

    for character in value.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => output.push(character),
            _ => {}
        }
    }

    output
}

fn fetch_pc_gaming_wiki_language_info(
    title: &str,
    previous_message: Option<String>,
) -> Result<Option<LanguageSupportResult>, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("BGaming/0.1 language lookup")
        .build()
        .map_err(|error| error.to_string())?;

    for query_title in metadata_search_variants(title).into_iter().take(8) {
        let Some(page_title) = search_pc_gaming_wiki_page(&client, title, &query_title)? else {
            continue;
        };
        let html = fetch_pc_gaming_wiki_page_html(&client, &page_title)?;
        if !pc_gaming_wiki_page_matches(title, &page_title, &html) {
            continue;
        }

        let normalized_html = decode_html_text(&strip_html_tags(&html)).to_lowercase();
        let mentions_turkish = normalized_html.contains("turkish") || normalized_html.contains("türkçe");
        let mentions_localization = normalized_html.contains("localizations")
            || normalized_html.contains("localization")
            || normalized_html.contains("language");

        if mentions_turkish {
            return Ok(Some(LanguageSupportResult {
                turkish_language_support: "yes".to_string(),
                message: format!("PCGamingWiki eşleşmesi bulundu: {page_title}. Türkçe desteği görünüyor."),
            }));
        }

        if mentions_localization {
            return Ok(Some(LanguageSupportResult {
                turkish_language_support: "no".to_string(),
                message: format!("PCGamingWiki eşleşmesi bulundu: {page_title}. Türkçe dil satırı görünmüyor."),
            }));
        }
    }

    if previous_message.is_some() {
        return Ok(None);
    }

    Ok(None)
}

fn search_pc_gaming_wiki_page(
    client: &reqwest::blocking::Client,
    original_title: &str,
    query_title: &str,
) -> Result<Option<String>, String> {
    let query = encode_query_component(query_title);
    let url = format!(
        "https://www.pcgamingwiki.com/w/api.php?action=query&list=search&srsearch={query}&format=json&srlimit=8"
    );
    let response: serde_json::Value = client
        .get(url)
        .send()
        .map_err(|_| "PCGamingWiki aramasına ulaşılamadı.".to_string())?
        .error_for_status()
        .map_err(|_| "PCGamingWiki araması başarısız oldu.".to_string())?
        .json()
        .map_err(|_| "PCGamingWiki arama yanıtı okunamadı.".to_string())?;
    let Some(items) = response
        .get("query")
        .and_then(|query| query.get("search"))
        .and_then(|search| search.as_array())
    else {
        return Ok(None);
    };

    let mut best_match: Option<(String, f32)> = None;
    for item in items {
        let Some(candidate_title) = item.get("title").and_then(|value| value.as_str()) else {
            continue;
        };
        let score = title_similarity(original_title, candidate_title).max(title_similarity(query_title, candidate_title));
        if is_reliable_title_match(original_title, candidate_title, score)
            && best_match.as_ref().map(|(_, best_score)| score > *best_score).unwrap_or(true)
        {
            best_match = Some((candidate_title.to_string(), score));
        }
    }

    Ok(best_match.map(|(title, _)| title))
}

fn fetch_pc_gaming_wiki_page_html(
    client: &reqwest::blocking::Client,
    page_title: &str,
) -> Result<String, String> {
    let title = encode_query_component(page_title);
    let url = format!(
        "https://www.pcgamingwiki.com/w/api.php?action=parse&page={title}&prop=text&format=json&redirects=1"
    );
    let response: serde_json::Value = client
        .get(url)
        .send()
        .map_err(|_| "PCGamingWiki sayfasına ulaşılamadı.".to_string())?
        .error_for_status()
        .map_err(|_| "PCGamingWiki sayfası açılamadı.".to_string())?
        .json()
        .map_err(|_| "PCGamingWiki sayfa yanıtı okunamadı.".to_string())?;

    response
        .get("parse")
        .and_then(|parse| parse.get("text"))
        .and_then(|text| text.get("*"))
        .and_then(|text| text.as_str())
        .map(|text| text.to_string())
        .ok_or_else(|| "PCGamingWiki sayfa içeriği okunamadı.".to_string())
}

fn pc_gaming_wiki_page_matches(original_title: &str, page_title: &str, html: &str) -> bool {
    let title_score = title_similarity(original_title, page_title);
    if title_score >= 0.72 {
        return true;
    }

    let normalized_original = normalize_metadata_title(original_title);
    let normalized_html = normalize_metadata_title(&strip_html_tags(html));
    normalized_original.len() >= 4 && normalized_html.contains(&normalized_original)
}

fn unknown_language_result(message: impl Into<String>) -> LanguageSupportResult {
    LanguageSupportResult {
        turkish_language_support: "unknown".to_string(),
        message: message.into(),
    }
}

fn known_language_support_override(title: &str) -> Option<LanguageSupportResult> {
    let normalized = normalize_metadata_title(title);
    let compact = compact_title_key(title);

    let (support, message) = if normalized.contains("faraway 2 jungle escape")
        || normalized.contains("faraway jungle escape")
    {
        (
            "yes",
            "Bilinen eşleşme: Faraway: Jungle Escape. Türkçe dil desteği var.",
        )
    } else if normalized.contains("sherlock holmes chapter 1")
        || normalized.contains("sherlock holmes chapter one")
    {
        (
            "yes",
            "Bilinen eşleşme: Sherlock Holmes Chapter One. Türkçe dil desteği var.",
        )
    } else if normalized.contains("quake 2 rtx")
        || normalized.contains("quake ii rtx")
        || compact == "quake2rtx"
        || compact == "quakeiirtx"
    {
        (
            "no",
            "Bilinen eşleşme: Quake II RTX. Resmi dil bilgisinde Türkçe görünmüyor.",
        )
    } else {
        return None;
    };

    Some(LanguageSupportResult {
        turkish_language_support: support.to_string(),
        message: message.to_string(),
    })
}

fn fetch_steam_grid_db_metadata(
    app: &tauri::AppHandle,
    api_key: &str,
    title: &str,
    steam_app_id: Option<u32>,
) -> Result<MetadataResult, String> {
    let Some((game_id, matched_title, release_year)) = find_steam_grid_db_game(api_key, title, steam_app_id)? else {
        return Ok(empty_metadata_result(
            "SteamGridDB içinde güvenilir kapak eşleşmesi bulunamadı.",
        ));
    };

    let cover_url = fetch_steam_grid_db_cover_url(api_key, game_id)?;

    let (cover_path, cover_error) = if let Some(url) = cover_url {
        download_cover_from_url(
            app,
            &url,
            &format!("metadata-sgdb-{game_id}-{}.jpg", timestamp()?),
        )
    } else {
        (None, Some("SteamGridDB kapak görseli bulunamadı.".to_string()))
    };

    Ok(MetadataResult {
        cover_downloaded: cover_path.is_some(),
        cover_path,
        genres: Vec::new(),
        release_year,
        message: cover_error.unwrap_or_else(|| format!("SteamGridDB kapak eşleşmesi bulundu: {matched_title}.")),
    })
}

fn fetch_steam_grid_db_public_metadata(app: &tauri::AppHandle, title: &str) -> Result<MetadataResult, String> {
    let Some((matched_title, release_year, cover_url)) = find_public_steam_grid_db_cover(title)? else {
        return Ok(empty_metadata_result(
            "SteamGridDB web aramasında güvenilir kapak eşleşmesi bulunamadı.",
        ));
    };

    let (cover_path, cover_error) = download_cover_from_url(
        app,
        &cover_url,
        &format!(
            "metadata-sgdb-game-{}-{}.{}",
            safe_metadata_file_stem(&matched_title),
            timestamp()?,
            cover_file_extension_from_url(&cover_url)
        ),
    );

    Ok(MetadataResult {
        cover_downloaded: cover_path.is_some(),
        cover_path,
        genres: Vec::new(),
        release_year,
        message: cover_error.unwrap_or_else(|| format!("SteamGridDB web kapak eşleşmesi bulundu: {matched_title}.")),
    })
}

fn find_public_steam_grid_db_cover(title: &str) -> Result<Option<(String, Option<i32>, String)>, String> {
    let client = reqwest::blocking::Client::new();

    for query_title in metadata_search_variants(title) {
        if let Some((game_id, matched_title, release_year)) =
            find_public_steam_grid_db_game(&client, title, &query_title)?
        {
            if let Some(cover_url) = fetch_public_steam_grid_db_cover_url(&client, game_id)? {
                return Ok(Some((matched_title, release_year, cover_url)));
            }
        }

        let url = format!(
            "https://www.steamgriddb.com/search/grids/term={}",
            encode_query_component(&query_title)
        );
        let html = client
            .get(url)
            .header(reqwest::header::USER_AGENT, "BGaming metadata lookup")
            .send()
            .map_err(|_| "SteamGridDB web aramasına ulaşılamadı.".to_string())?
            .error_for_status()
            .map_err(|error| match error.status().map(|status| status.as_u16()) {
                Some(404) => "SteamGridDB web aramasında eşleşme bulunamadı.".to_string(),
                Some(429) => "SteamGridDB web araması limitine takıldın. Biraz sonra tekrar dene.".to_string(),
                Some(code) => format!("SteamGridDB web araması hata kodu: {code}."),
                None => "SteamGridDB web araması başarısız oldu.".to_string(),
            })?
            .text()
            .map_err(|_| "SteamGridDB web araması yanıtı okunamadı.".to_string())?;

        let Some(cover_url) = extract_public_steam_grid_db_cover_url(&html) else {
            continue;
        };
        let (matched_title, release_year) = extract_public_steam_grid_db_title_year(&html, &query_title);
        let score = title_similarity(title, &matched_title).max(title_similarity(&query_title, &matched_title));

        if is_reliable_title_match(title, &matched_title, score) || score >= 0.56 {
            return Ok(Some((matched_title, release_year, cover_url)));
        }
    }

    Ok(None)
}

fn find_public_steam_grid_db_game(
    client: &reqwest::blocking::Client,
    original_title: &str,
    query_title: &str,
) -> Result<Option<(u64, String, Option<i32>)>, String> {
    let url = format!(
        "https://www.steamgriddb.com/api/public/search/autocomplete?term={}",
        encode_query_component(query_title)
    );
    let response: serde_json::Value = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 BGaming metadata lookup")
        .header(reqwest::header::REFERER, "https://www.steamgriddb.com/")
        .send()
        .map_err(|_| "SteamGridDB public aramasına ulaşılamadı.".to_string())?
        .error_for_status()
        .map_err(|error| match error.status().map(|status| status.as_u16()) {
            Some(429) => "SteamGridDB public araması limitine takıldın. Biraz sonra tekrar dene.".to_string(),
            Some(code) => format!("SteamGridDB public araması hata kodu: {code}."),
            None => "SteamGridDB public araması başarısız oldu.".to_string(),
        })?
        .json()
        .map_err(|_| "SteamGridDB public araması yanıtı okunamadı.".to_string())?;

    let Some(items) = response.get("data").and_then(|value| value.as_array()) else {
        return Ok(None);
    };

    let mut best_match: Option<(u64, String, Option<i32>, f32)> = None;
    for item in items.iter().take(12) {
        let Some(game_id) = item.get("id").and_then(|value| value.as_u64()) else {
            continue;
        };
        let Some(candidate_title) = item.get("name").and_then(|value| value.as_str()) else {
            continue;
        };

        let score = title_similarity(original_title, candidate_title).max(title_similarity(query_title, candidate_title));
        if !is_reliable_title_match(original_title, candidate_title, score) {
            continue;
        }

        let release_year = item
            .get("release_date")
            .and_then(|value| value.as_i64())
            .and_then(unix_seconds_to_year);

        if best_match
            .as_ref()
            .map(|(_, _, _, best_score)| score > *best_score)
            .unwrap_or(true)
        {
            best_match = Some((game_id, candidate_title.to_string(), release_year, score));
        }
    }

    Ok(best_match.map(|(game_id, title, release_year, _)| (game_id, title, release_year)))
}

fn unix_seconds_to_year(seconds: i64) -> Option<i32> {
    if seconds <= 0 {
        return None;
    }

    let days = seconds.div_euclid(86_400);
    let (year, _, _) = civil_from_days(days);
    Some(year)
}

fn civil_from_days(days_since_unix_epoch: i64) -> (i32, u32, u32) {
    let z = days_since_unix_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 }.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096).div_euclid(365);
    let year = yoe + era * 400;
    let day_of_year = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let month_prime = (5 * day_of_year + 2).div_euclid(153);
    let day = day_of_year - (153 * month_prime + 2).div_euclid(5) + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    let adjusted_year = year + if month <= 2 { 1 } else { 0 };

    (adjusted_year as i32, month as u32, day as u32)
}

fn fetch_public_steam_grid_db_cover_url(
    client: &reqwest::blocking::Client,
    game_id: u64,
) -> Result<Option<String>, String> {
    let body = serde_json::json!({
        "game_id": [game_id],
        "asset_type": "grid",
        "page": 0,
        "limit": 24
    });
    let response: serde_json::Value = client
        .post("https://www.steamgriddb.com/api/public/search/assets")
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 BGaming metadata lookup")
        .header(reqwest::header::REFERER, "https://www.steamgriddb.com/")
        .json(&body)
        .send()
        .map_err(|_| "SteamGridDB public kapak aramasına ulaşılamadı.".to_string())?
        .error_for_status()
        .map_err(|error| match error.status().map(|status| status.as_u16()) {
            Some(429) => "SteamGridDB public kapak araması limitine takıldın. Biraz sonra tekrar dene.".to_string(),
            Some(code) => format!("SteamGridDB public kapak araması hata kodu: {code}."),
            None => "SteamGridDB public kapak araması başarısız oldu.".to_string(),
        })?
        .json()
        .map_err(|_| "SteamGridDB public kapak yanıtı okunamadı.".to_string())?;

    Ok(select_public_steam_grid_db_cover_url(&response))
}

fn fetch_public_steam_grid_db_cover_candidates(title: &str) -> Result<Vec<CoverCandidate>, String> {
    let client = reqwest::blocking::Client::new();

    for query_title in metadata_search_variants(title) {
        let Some((game_id, matched_title, _)) = find_public_steam_grid_db_game(&client, title, &query_title)? else {
            continue;
        };
        let body = serde_json::json!({
            "game_id": [game_id],
            "asset_type": "grid",
            "page": 0,
            "limit": 24
        });
        let response: serde_json::Value = client
            .post("https://www.steamgriddb.com/api/public/search/assets")
            .header(reqwest::header::USER_AGENT, "Mozilla/5.0 BGaming cover gallery")
            .header(reqwest::header::REFERER, "https://www.steamgriddb.com/")
            .json(&body)
            .send()
            .map_err(|_| "SteamGridDB kapak galerisine ulaşılamadı.".to_string())?
            .error_for_status()
            .map_err(|_| "SteamGridDB kapak galerisi yanıt vermedi.".to_string())?
            .json()
            .map_err(|_| "SteamGridDB kapak galerisi okunamadı.".to_string())?;
        let candidates = public_cover_candidates_from_response(&response, &matched_title);

        if !candidates.is_empty() {
            return Ok(candidates);
        }
    }

    Ok(Vec::new())
}

fn public_cover_candidates_from_response(response: &serde_json::Value, matched_title: &str) -> Vec<CoverCandidate> {
    let mut candidates = response
        .get("data")
        .and_then(|data| data.get("assets"))
        .and_then(|value| value.as_array())
        .map(|assets| {
            assets
                .iter()
                .filter(|item| !item.get("nsfw").and_then(|value| value.as_bool()).unwrap_or(false))
                .filter_map(|item| {
                    let candidate = CoverCandidate {
                        url: item.get("url").and_then(|value| value.as_str())?.to_string(),
                        source: "SteamGridDB".to_string(),
                        matched_title: matched_title.to_string(),
                        width: item.get("width").and_then(|value| value.as_i64()),
                        height: item.get("height").and_then(|value| value.as_i64()),
                    };
                    Some((candidate, public_steam_grid_db_cover_score(item)))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    candidates.sort_by(|first, second| second.1.cmp(&first.1));
    candidates.into_iter().map(|(candidate, _)| candidate).collect()
}

fn select_public_steam_grid_db_cover_url(response: &serde_json::Value) -> Option<String> {
    response
        .get("data")
        .and_then(|data| data.get("assets"))
        .and_then(|value| value.as_array())
        .and_then(|assets| {
            assets
                .iter()
                .filter_map(|item| {
                    let url = item.get("url").and_then(|value| value.as_str())?;
                    if item.get("nsfw").and_then(|value| value.as_bool()).unwrap_or(false) {
                        return None;
                    }
                    Some((url.to_string(), public_steam_grid_db_cover_score(item)))
                })
                .max_by_key(|(_, score)| *score)
                .map(|(url, _)| url)
        })
}

fn public_steam_grid_db_cover_score(item: &serde_json::Value) -> i64 {
    let width = item.get("width").and_then(|value| value.as_i64()).unwrap_or(0);
    let height = item.get("height").and_then(|value| value.as_i64()).unwrap_or(0);
    let style = item.get("style").and_then(|value| value.as_str()).unwrap_or("");
    let language = item.get("language").and_then(|value| value.as_str()).unwrap_or("");
    let is_animated = item.get("is_animated").and_then(|value| value.as_bool()).unwrap_or(false);
    let upvotes = item.get("upvotes").and_then(|value| value.as_i64()).unwrap_or(0);
    let hearts = item.get("hearts").and_then(|value| value.as_i64()).unwrap_or(0);
    let downloads = item.get("downloads").and_then(|value| value.as_i64()).unwrap_or(0);
    let aspect_bonus = if width > 0 && height > width { 25 } else { 0 };
    let poster_bonus = if width == 600 && height == 900 { 35 } else { 0 };
    let style_bonus = match style {
        "official" => 30,
        "white_logo" | "alternate" => 18,
        _ => 8,
    };
    let language_bonus = match language {
        "en" | "" => 12,
        _ => 0,
    };
    let animation_penalty = if is_animated { -60 } else { 0 };

    poster_bonus + aspect_bonus + style_bonus + language_bonus + animation_penalty + upvotes * 5 + hearts * 3 + downloads / 100
}

fn extract_public_steam_grid_db_cover_url(html: &str) -> Option<String> {
    let markers = [
        "https://cdn2.steamgriddb.com/grid/",
        "https://cdn.steamgriddb.com/grid/",
        "https://steamgriddb.com/grid/",
        "https:\\/\\/cdn2.steamgriddb.com\\/grid\\/",
        "https:\\/\\/cdn.steamgriddb.com\\/grid\\/",
        "https:\\/\\/steamgriddb.com\\/grid\\/",
    ];

    for marker in markers {
        let mut offset = 0;
        while let Some(relative_index) = html[offset..].find(marker) {
            let start = offset + relative_index;
            let end = html[start..]
                .find(|character| matches!(character, '"' | '\'' | '<' | ')' | ' ' | '\\'))
                .map(|relative_end| start + relative_end)
                .unwrap_or(html.len());
            let candidate = decode_html_text(&html[start..end]).replace("\\/", "/");
            if candidate.contains("/grid/") && !candidate.contains("/thumb/") {
                return Some(candidate);
            }
            offset = end.saturating_add(1);
        }
    }

    None
}

fn extract_public_steam_grid_db_title_year(html: &str, fallback_title: &str) -> (String, Option<i32>) {
    let title_text = extract_tag_text(html, "title").unwrap_or_else(|| fallback_title.to_string());
    let clean = decode_html_text(&title_text)
        .replace(" - SteamGridDB", "")
        .replace(" - SteamGridDB", "")
        .trim()
        .to_string();
    let release_year = parse_release_year(&clean);
    let title = clean
        .split('(')
        .next()
        .unwrap_or(&clean)
        .trim()
        .to_string();

    if title.is_empty() {
        (fallback_title.to_string(), release_year)
    } else {
        (title, release_year)
    }
}

fn extract_tag_text(html: &str, tag_name: &str) -> Option<String> {
    let open_marker = format!("<{tag_name}>");
    let close_marker = format!("</{tag_name}>");
    let start = html.find(&open_marker)? + open_marker.len();
    let end = html[start..].find(&close_marker)? + start;
    Some(html[start..end].to_string())
}

fn fetch_steam_grid_db_cover_url(api_key: &str, game_id: u64) -> Result<Option<String>, String> {
    let urls = [
        format!("https://www.steamgriddb.com/api/v2/grids/game/{game_id}?types=static"),
        format!("https://www.steamgriddb.com/api/v2/grids/game/{game_id}"),
    ];

    let mut last_error = None;
    for url in urls {
        match fetch_steam_grid_db_json(api_key, &url) {
            Ok(response) => {
                if let Some(cover_url) = select_steam_grid_db_cover_url(&response) {
                    return Ok(Some(cover_url));
                }
            }
            Err(error) if error.contains("eşleşme bulunamadı") => {
                last_error = Some(error);
            }
            Err(error) => return Err(error),
        }
    }

    if let Some(error) = last_error {
        Err(error)
    } else {
        Ok(None)
    }
}

fn fetch_steam_grid_db_cover_candidates(
    api_key: &str,
    game_id: u64,
    matched_title: &str,
) -> Result<Vec<CoverCandidate>, String> {
    let url = format!("https://www.steamgriddb.com/api/v2/grids/game/{game_id}?types=static");
    let response = fetch_steam_grid_db_json(api_key, &url)?;
    let mut candidates = response
        .get("data")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter(|item| !item.get("nsfw").and_then(|value| value.as_bool()).unwrap_or(false))
                .filter_map(|item| {
                    let candidate = CoverCandidate {
                        url: item.get("url").and_then(|value| value.as_str())?.to_string(),
                        source: "SteamGridDB".to_string(),
                        matched_title: matched_title.to_string(),
                        width: item.get("width").and_then(|value| value.as_i64()),
                        height: item.get("height").and_then(|value| value.as_i64()),
                    };
                    Some((candidate, steam_grid_db_cover_score(item)))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    candidates.sort_by(|first, second| second.1.cmp(&first.1));
    Ok(candidates.into_iter().map(|(candidate, _)| candidate).collect())
}

fn select_steam_grid_db_cover_url(response: &serde_json::Value) -> Option<String> {
    response
        .get("data")
        .and_then(|value| value.as_array())
        .and_then(|items| {
            items
                .iter()
                .filter(|item| !item.get("nsfw").and_then(|value| value.as_bool()).unwrap_or(false))
                .filter_map(|item| {
                    let url = item.get("url").and_then(|value| value.as_str())?;
                    Some((url, steam_grid_db_cover_score(item)))
                })
                .max_by_key(|(_, score)| *score)
        })
        .map(|(url, _)| url.to_string())
}

fn steam_grid_db_cover_score(item: &serde_json::Value) -> i64 {
    let width = item.get("width").and_then(|value| value.as_f64()).unwrap_or(0.0);
    let height = item.get("height").and_then(|value| value.as_f64()).unwrap_or(0.0);
    let base_score = item.get("score").and_then(|value| value.as_i64()).unwrap_or(0);
    let ratio = if height > 0.0 { width / height } else { 0.0 };
    let portrait_bonus = if (0.55..=0.78).contains(&ratio) {
        100_000
    } else if height > width {
        35_000
    } else {
        0
    };

    base_score + portrait_bonus
}

fn find_steam_grid_db_game(
    api_key: &str,
    title: &str,
    steam_app_id: Option<u32>,
) -> Result<Option<(u64, String, Option<i32>)>, String> {
    if let Some(app_id) = steam_app_id {
        let url = format!("https://www.steamgriddb.com/api/v2/games/steam/{app_id}");
        if let Ok(response) = fetch_steam_grid_db_json(api_key, &url) {
            if let Some(game) = extract_steam_grid_db_game(&response.get("data").cloned().unwrap_or_default()) {
                return Ok(Some(game));
            }
        }
    }

    let mut best_match: Option<(u64, String, Option<i32>, f32)> = None;
    for query_title in metadata_search_variants(title) {
        let url = format!(
            "https://www.steamgriddb.com/api/v2/search/autocomplete/{}",
            encode_path_segment(&query_title)
        );
        let response = match fetch_steam_grid_db_json(api_key, &url) {
            Ok(response) => response,
            Err(error) if error.contains("eşleşme bulunamadı") => continue,
            Err(error) => return Err(error),
        };
        let Some(items) = response.get("data").and_then(|value| value.as_array()) else {
            continue;
        };

        for item in items {
            let Some((game_id, candidate_title, release_year)) = extract_steam_grid_db_game(item) else {
                continue;
            };
            let score = title_similarity(title, &candidate_title).max(title_similarity(&query_title, &candidate_title));
            if is_reliable_title_match(title, &candidate_title, score)
                && best_match
                    .as_ref()
                    .map(|(_, _, _, best_score)| score > *best_score)
                    .unwrap_or(true)
            {
                best_match = Some((game_id, candidate_title, release_year, score));
            }
        }

        if best_match.as_ref().map(|(_, _, _, score)| *score >= 0.86).unwrap_or(false) {
            break;
        }
    }

    Ok(best_match.map(|(game_id, title, release_year, _)| (game_id, title, release_year)))
}

fn extract_steam_grid_db_game(value: &serde_json::Value) -> Option<(u64, String, Option<i32>)> {
    let game = if value.is_array() {
        value.as_array()?.first()?
    } else {
        value
    };
    let id = game.get("id").and_then(|value| value.as_u64())?;
    let title = game
        .get("name")
        .or_else(|| game.get("title"))
        .and_then(|value| value.as_str())?
        .to_string();
    let release_year = game
        .get("release_date")
        .or_else(|| game.get("releaseDate"))
        .or_else(|| game.get("date"))
        .and_then(|value| value.as_str())
        .and_then(parse_release_year);

    Some((id, title, release_year))
}

fn fetch_steam_grid_db_json(api_key: &str, url: &str) -> Result<serde_json::Value, String> {
    reqwest::blocking::Client::new()
        .get(url)
        .bearer_auth(api_key)
        .send()
        .map_err(|_| "SteamGridDB servisine ulaşılamadı. İnternet bağlantını kontrol et.".to_string())?
        .error_for_status()
        .map_err(|error| match error.status().map(|status| status.as_u16()) {
            Some(401) | Some(403) => "SteamGridDB API Key geçersiz veya yetkisiz.".to_string(),
            Some(404) => "SteamGridDB içinde eşleşme bulunamadı.".to_string(),
            Some(429) => "SteamGridDB API limitine takıldın. Biraz sonra tekrar dene.".to_string(),
            Some(code) => format!("SteamGridDB hata kodu: {code}."),
            None => "SteamGridDB isteği başarısız oldu.".to_string(),
        })?
        .json()
        .map_err(|_| "SteamGridDB yanıtı okunamadı.".to_string())
}

fn fetch_rawg_metadata(app: &tauri::AppHandle, api_key: &str, title: &str) -> Result<MetadataResult, String> {
    if api_key.trim().is_empty() {
        return Ok(empty_metadata_result(
            "RAWG API Key boş olduğu için yedek metadata kaynağı denenmedi.",
        ));
    }

    let mut best_result = empty_metadata_result(
        "RAWG içinde güvenilir başlık eşleşmesi bulunamadı. Oyun adını sadeleştirip tekrar deneyebilirsin.",
    );

    for query_title in metadata_search_variants(title) {
        let result = fetch_rawg_metadata_for_query(app, api_key, title, &query_title)?;
        if metadata_result_has_data(&result) {
            return Ok(result);
        }
        best_result = result;
    }

    Ok(best_result)
}

fn fetch_rawg_metadata_for_query(
    app: &tauri::AppHandle,
    api_key: &str,
    original_title: &str,
    query_title: &str,
) -> Result<MetadataResult, String> {
    let query = encode_query_component(query_title);
    let key = encode_query_component(api_key);
    let url = format!("https://api.rawg.io/api/games?key={key}&search={query}&page_size=12");
    let response: serde_json::Value = reqwest::blocking::get(url)
        .map_err(|_| "RAWG metadata servisine ulaşılamadı. İnternet bağlantını kontrol et.".to_string())?
        .error_for_status()
        .map_err(|error| match error.status().map(|status| status.as_u16()) {
            Some(401) | Some(403) => "RAWG API Key geçersiz veya yetkisiz.".to_string(),
            Some(429) => "RAWG API limitine takıldın. Biraz sonra tekrar dene.".to_string(),
            Some(code) => format!("RAWG metadata servisi hata kodu döndürdü: {code}."),
            None => "RAWG metadata isteği başarısız oldu.".to_string(),
        })?
        .json()
        .map_err(|_| "RAWG metadata yanıtı okunamadı.".to_string())?;

    let Some(results) = response.get("results").and_then(|value| value.as_array()) else {
        return Ok(empty_metadata_result("RAWG metadata yanıtında oyun listesi bulunamadı."));
    };

    let mut best_match: Option<(&serde_json::Value, f32)> = None;
    for item in results {
        let Some(candidate_title) = item.get("name").and_then(|value| value.as_str()) else {
            continue;
        };
        let score = title_similarity(original_title, candidate_title).max(title_similarity(query_title, candidate_title));
        if is_reliable_title_match(original_title, candidate_title, score)
            && best_match.map(|(_, best_score)| score > best_score).unwrap_or(true)
        {
            best_match = Some((item, score));
        }
    }

    let Some((item, _)) = best_match else {
        return Ok(empty_metadata_result(
            "RAWG içinde güvenilir başlık eşleşmesi bulunamadı. Oyun adını sadeleştirip tekrar deneyebilirsin.",
        ));
    };

    let matched_title = item
        .get("name")
        .and_then(|value| value.as_str())
        .unwrap_or(original_title)
        .to_string();
    let mut genres = item
        .get("genres")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|genre| genre.get("name").and_then(|value| value.as_str()))
                .filter(|value| is_english_metadata_label(value))
                .map(|value| value.trim().to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if let Some(tags) = item.get("tags").and_then(|value| value.as_array()) {
        for tag in tags {
            let Some(name) = tag.get("name").and_then(|value| value.as_str()) else {
                continue;
            };
            if is_english_metadata_label(name)
                && is_useful_rawg_genre_tag(name)
                && !genres.iter().any(|existing| existing.eq_ignore_ascii_case(name))
            {
                genres.push(name.trim().to_string());
            }
        }
    }
    genres.sort_by(|first, second| first.to_lowercase().cmp(&second.to_lowercase()));
    let release_year = item
        .get("released")
        .and_then(|value| value.as_str())
        .and_then(parse_release_year);
    let cover_url = item
        .get("background_image")
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty());
    let (cover_path, cover_error) = if let Some(url) = cover_url {
        download_cover_from_url(
            app,
            url,
            &format!("metadata-rawg-{}-{}.jpg", safe_metadata_file_stem(&matched_title), timestamp()?),
        )
    } else {
        (None, Some("RAWG kapak görseli bulunamadı.".to_string()))
    };

    Ok(MetadataResult {
        cover_downloaded: cover_path.is_some(),
        cover_path,
        genres,
        release_year,
        message: cover_error.unwrap_or_else(|| format!("RAWG eşleşmesi bulundu: {matched_title}.")),
    })
}

fn fetch_known_game_metadata(title: &str) -> Result<MetadataResult, String> {
    let normalized = normalize_metadata_title(title);
    let Some((release_year, genres)) = known_game_metadata(&normalized) else {
        return Ok(empty_metadata_result(""));
    };

    Ok(MetadataResult {
        cover_path: None,
        cover_downloaded: false,
        genres: genres.into_iter().map(str::to_string).collect(),
        release_year,
        message: "Yerel metadata eşleşmesi bulundu.".to_string(),
    })
}

fn known_game_metadata(normalized_title: &str) -> Option<(Option<i32>, Vec<&'static str>)> {
    match normalized_title {
        "pc building simulator 2" => Some((
            Some(2022),
            vec!["Simulation", "Building", "Management"],
        )),
        "rocket league" => Some((
            Some(2015),
            vec!["Sports", "Racing", "Multiplayer"],
        )),
        _ => None,
    }
}

fn metadata_result_has_data(result: &MetadataResult) -> bool {
    result.cover_path.is_some() || result.release_year.is_some() || !result.genres.is_empty()
}

fn is_english_metadata_label(value: &str) -> bool {
    let clean = value.trim();
    !clean.is_empty()
        && clean.len() <= 48
        && clean
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, ' ' | '-' | '&' | '/' | '\'' | '(' | ')'))
}

fn is_useful_rawg_genre_tag(value: &str) -> bool {
    let key = normalize_metadata_title(value);
    let allowed = [
        "action",
        "adventure",
        "rpg",
        "role playing",
        "strategy",
        "simulation",
        "sports",
        "racing",
        "football",
        "soccer",
        "puzzle",
        "platformer",
        "shooter",
        "fighting",
        "family",
        "educational",
        "indie",
        "massively multiplayer",
        "moba",
        "battle royale",
        "card",
        "board games",
        "survival",
        "survival horror",
        "horror",
        "open world",
        "singleplayer",
        "multiplayer",
        "co op",
        "online co op",
        "local co op",
        "fps",
        "third person",
        "third person shooter",
        "stealth",
        "tactical",
        "turn based",
        "turn based strategy",
        "real time strategy",
        "rts",
        "roguelike",
        "roguelite",
        "sandbox",
        "building",
        "base building",
        "city builder",
        "colony sim",
        "management",
        "anime",
        "sci fi",
        "cyberpunk",
        "fantasy",
        "medieval",
        "zombies",
        "post apocalyptic",
        "parkour",
        "exploration",
        "story rich",
        "choices matter",
        "atmospheric",
        "difficult",
        "souls like",
        "metroidvania",
        "hack and slash",
        "loot",
        "crafting",
        "tower defense",
        "music",
        "vr",
    ];

    allowed.contains(&key.as_str())
}

fn collect_metadata_result(
    result: Result<MetadataResult, String>,
    results: &mut Vec<MetadataResult>,
    errors: &mut Vec<String>,
) {
    match result {
        Ok(metadata) if metadata_result_has_data(&metadata) => results.push(metadata),
        Ok(metadata) if !metadata.message.trim().is_empty() => errors.push(metadata.message),
        Ok(_) => {}
        Err(error) => errors.push(error),
    }
}

fn combine_metadata_results(results: Vec<MetadataResult>) -> Option<MetadataResult> {
    if results.is_empty() {
        return None;
    }

    let mut combined = MetadataResult {
        cover_path: None,
        cover_downloaded: false,
        genres: Vec::new(),
        release_year: None,
        message: String::new(),
    };
    let mut messages = Vec::new();

    for result in results {
        if combined.cover_path.is_none() && result.cover_path.is_some() {
            combined.cover_path = result.cover_path;
            combined.cover_downloaded = result.cover_downloaded;
        } else {
            combined.cover_downloaded = combined.cover_downloaded || result.cover_downloaded;
        }

        if combined.release_year.is_none() {
            combined.release_year = result.release_year;
        }

        for genre in result.genres {
            if !combined.genres.iter().any(|existing| existing.eq_ignore_ascii_case(&genre)) {
                combined.genres.push(genre);
            }
        }

        if !result.message.trim().is_empty() {
            messages.push(result.message);
        }
    }

    combined.genres.sort_by(|first, second| first.to_lowercase().cmp(&second.to_lowercase()));
    combined.message = if messages.is_empty() {
        "Metadata bulundu.".to_string()
    } else {
        messages.join(" ")
    };

    Some(combined)
}

fn empty_metadata_result(message: &str) -> MetadataResult {
    MetadataResult {
        cover_path: None,
        cover_downloaded: false,
        genres: Vec::new(),
        release_year: None,
        message: message.to_string(),
    }
}

fn clean_optional_api_key(value: Option<String>) -> Option<String> {
    value
        .map(|api_key| api_key.trim().to_string())
        .filter(|api_key| !api_key.is_empty())
}

fn safe_metadata_file_stem(value: &str) -> String {
    let stem = normalize_metadata_title(value)
        .replace(' ', "-")
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '-')
        .collect::<String>();

    if stem.is_empty() {
        "game".to_string()
    } else {
        stem.chars().take(48).collect()
    }
}

#[tauri::command]
fn backup_library(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let Some(destination_root) = rfd::FileDialog::new()
        .set_title("BGaming yedek klasörü seç")
        .pick_folder()
    else {
        return Ok(None);
    };

    let timestamp = timestamp()?;
    let backup_dir = destination_root.join(format!("BGaming-backup-{timestamp}"));
    fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;

    let database_path = find_existing_database_path(&app)
        .ok_or_else(|| "Veritabanı dosyası bulunamadı.".to_string())?;
    fs::copy(database_path, backup_dir.join("bgaming.db")).map_err(|error| error.to_string())?;

    let covers_dir = app_data_dir(&app)?.join("covers");
    if covers_dir.exists() {
        copy_dir_all(&covers_dir, &backup_dir.join("covers"))?;
    }

    fs::write(
        backup_dir.join("backup-info.json"),
        format!(
            "{{\"app\":\"BGaming\",\"createdAt\":\"{timestamp}\",\"format\":\"folder-v1\"}}"
        ),
    )
    .map_err(|error| error.to_string())?;

    Ok(Some(backup_dir.to_string_lossy().to_string()))
}

#[tauri::command]
fn select_backup_folder() -> Result<Option<String>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("BGaming yedek klasörü seç")
        .pick_folder()
    else {
        return Ok(None);
    };

    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn restore_library_backup(app: tauri::AppHandle, backup_path: String) -> Result<String, String> {
    let backup_dir = PathBuf::from(backup_path);
    let backup_database = backup_dir.join("bgaming.db");

    if !backup_database.exists() {
        return Err("Seçilen klasörde bgaming.db bulunamadı.".to_string());
    }

    let target_database = find_existing_database_path(&app).unwrap_or(app_data_dir(&app)?.join("bgaming.db"));
    if let Some(parent) = target_database.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::copy(&backup_database, &target_database).map_err(|error| error.to_string())?;

    let backup_covers = backup_dir.join("covers");
    if backup_covers.exists() {
        let target_covers = app_data_dir(&app)?.join("covers");
        if target_covers.exists() {
            fs::remove_dir_all(&target_covers).map_err(|error| error.to_string())?;
        }
        copy_dir_all(&backup_covers, &target_covers)?;
    }

    Ok("Yedek geri yüklendi. Verilerin yenilenmesi için uygulamayı yeniden başlat.".to_string())
}

#[tauri::command]
fn clear_user_data_files(app: tauri::AppHandle) -> Result<(), String> {
    let app_dir = app_data_dir(&app)?;
    let cleanup_dirs = ["covers", "imports", "temp"];

    for directory in cleanup_dirs {
        let path = app_dir.join(directory);
        if path.exists() {
            fs::remove_dir_all(&path).map_err(|error| error.to_string())?;
        }
        fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn scan_steam_libraries(candidates: &mut Vec<InstalledGameCandidate>) {
    let Some(program_files_x86) = env::var_os("ProgramFiles(x86)") else {
        return;
    };
    let steam_apps = PathBuf::from(program_files_x86).join("Steam").join("steamapps");
    scan_steam_app_manifests(&steam_apps, candidates);

    let library_file = steam_apps.join("libraryfolders.vdf");
    let Ok(content) = fs::read_to_string(library_file) else {
        return;
    };

    for line in content.lines() {
        let Some(path) = extract_vdf_value(line, "path") else {
            continue;
        };
        scan_steam_app_manifests(&PathBuf::from(path).join("steamapps"), candidates);
    }
}

fn scan_steam_app_manifests(steam_apps: &Path, candidates: &mut Vec<InstalledGameCandidate>) {
    let Ok(entries) = fs::read_dir(steam_apps) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !file_name.starts_with("appmanifest_") || !file_name.ends_with(".acf") {
            continue;
        }

        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let title = content.lines().find_map(|line| extract_vdf_value(line, "name"));
        let install_dir = content.lines().find_map(|line| extract_vdf_value(line, "installdir"));

        if let Some(title) = title {
            let install_path = install_dir
                .map(|dir| steam_apps.join("common").join(dir).to_string_lossy().to_string())
                .unwrap_or_else(|| steam_apps.to_string_lossy().to_string());
            candidates.push(InstalledGameCandidate {
                title,
                platform_name: "Steam".to_string(),
                install_path,
            });
        }
    }
}

fn scan_epic_manifests(candidates: &mut Vec<InstalledGameCandidate>) {
    let Some(program_data) = env::var_os("ProgramData") else {
        return;
    };
    let manifest_dir = PathBuf::from(program_data)
        .join("Epic")
        .join("EpicGamesLauncher")
        .join("Data")
        .join("Manifests");
    let Ok(entries) = fs::read_dir(manifest_dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("item") {
            continue;
        }

        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };
        let title = json
            .get("DisplayName")
            .and_then(|value| value.as_str())
            .or_else(|| json.get("AppName").and_then(|value| value.as_str()));
        let install_path = json
            .get("InstallLocation")
            .and_then(|value| value.as_str())
            .unwrap_or_default();

        if let Some(title) = title {
            candidates.push(InstalledGameCandidate {
                title: title.to_string(),
                platform_name: "Epic Games".to_string(),
                install_path: install_path.to_string(),
            });
        }
    }
}

fn scan_ubisoft_installs(candidates: &mut Vec<InstalledGameCandidate>) {
    for root in ubisoft_games_roots() {
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };

        for entry in entries.flatten() {
            let folder = entry.path();
            if !ubisoft_install_folder_is_current(&folder) {
                continue;
            }

            let Some(title) = folder
                .file_name()
                .and_then(|value| value.to_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
            else {
                continue;
            };

            candidates.push(InstalledGameCandidate {
                title: title.to_string(),
                platform_name: "Ubisoft Connect".to_string(),
                install_path: folder.to_string_lossy().to_string(),
            });
        }
    }
}

fn scan_ea_installs(candidates: &mut Vec<InstalledGameCandidate>) {
    for root in ea_games_roots() {
        scan_verified_game_root(&root, "EA App", candidates, ea_install_folder_is_current);
    }
}

fn scan_verified_game_root(
    root: &Path,
    platform_name: &str,
    candidates: &mut Vec<InstalledGameCandidate>,
    verifier: fn(&Path) -> bool,
) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        let folder = entry.path();
        let Some(title) = folder
            .file_name()
            .and_then(|value| value.to_str())
            .map(str::trim)
            .filter(|value| is_plausible_game_folder_title(value))
        else {
            continue;
        };
        if should_skip_automatic_candidate(title) || !verifier(&folder) {
            continue;
        }

        candidates.push(InstalledGameCandidate {
            title: title.to_string(),
            platform_name: platform_name.to_string(),
            install_path: folder.to_string_lossy().to_string(),
        });
    }
}

fn find_epic_launch_uri_for_game(title: &str, install_path: Option<&str>) -> Option<String> {
    let manifest_dir = epic_manifest_dir()?;
    let entries = fs::read_dir(manifest_dir).ok()?;
    let clean_install_path = install_path
        .map(normalize_path_for_compare)
        .filter(|value| !value.is_empty());
    let mut best_match: Option<(String, f32)> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("item") {
            continue;
        }

        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };

        let display_name = json
            .get("DisplayName")
            .and_then(|value| value.as_str())
            .or_else(|| json.get("AppName").and_then(|value| value.as_str()))
            .unwrap_or_default();
        let app_name = json
            .get("AppName")
            .and_then(|value| value.as_str())
            .or_else(|| json.get("CatalogItemId").and_then(|value| value.as_str()))
            .unwrap_or_default()
            .trim();

        if app_name.is_empty() {
            continue;
        }

        let manifest_install_path = json
            .get("InstallLocation")
            .and_then(|value| value.as_str())
            .map(normalize_path_for_compare)
            .unwrap_or_default();

        let path_matches = clean_install_path
            .as_ref()
            .is_some_and(|path| !manifest_install_path.is_empty() && (path == &manifest_install_path || path.contains(&manifest_install_path) || manifest_install_path.contains(path)));
        let score = if path_matches {
            1.0
        } else {
            title_similarity(title, display_name).max(compact_title_similarity(title, display_name))
        };

        if score >= 0.62 && best_match.as_ref().map(|(_, best_score)| score > *best_score).unwrap_or(true) {
            best_match = Some((app_name.to_string(), score));
        }
    }

    best_match.map(|(app_name, _)| {
        format!(
            "com.epicgames.launcher://apps/{}?action=launch&silent=true",
            encode_path_segment(&app_name)
        )
    })
}

fn resolve_game_install_folder(
    steam_app_id: Option<u32>,
    install_path: Option<&str>,
    platform_names: &[String],
    title: &str,
) -> Option<PathBuf> {
    if let Some(path) = install_path.and_then(path_to_existing_folder) {
        return Some(path);
    }

    let is_epic_game = is_epic_platform(platform_names);

    if is_epic_game {
        if let Some(path) = find_epic_install_folder_for_game(title, install_path) {
            return Some(path);
        }
        if let Some(path) = find_folder_in_root_by_title(&PathBuf::from(r"C:\Program Files\Epic Games"), title) {
            return Some(path);
        }
    }

    if platform_names.iter().any(|platform| platform.eq_ignore_ascii_case("Steam")) || steam_app_id.is_some() {
        if let Some(app_id) = steam_app_id {
            if let Some(path) = find_steam_install_folder_by_app_id(app_id) {
                return Some(path);
            }
        }
        if let Some(path) = find_steam_install_folder_by_title(title) {
            return Some(path);
        }
    }

    if !is_epic_game {
        if let Some(path) = find_epic_install_folder_for_game(title, install_path) {
            return Some(path);
        }
    }

    let common_match = find_common_install_folder_by_title(title);
    if common_match.is_some() || is_epic_game {
        return common_match;
    }

    install_path.and_then(path_to_existing_folder)
}

fn is_epic_platform(platform_names: &[String]) -> bool {
    platform_names
        .iter()
        .any(|platform| platform.to_ascii_lowercase().contains("epic"))
}

fn path_to_existing_folder(value: &str) -> Option<PathBuf> {
    let path = PathBuf::from(value.trim());
    if path.is_dir() {
        Some(path)
    } else if path.is_file() {
        path.parent().map(Path::to_path_buf)
    } else {
        None
    }
}

fn find_epic_install_folder_for_game(title: &str, install_path: Option<&str>) -> Option<PathBuf> {
    let manifest_dir = epic_manifest_dir();
    let clean_install_path = install_path
        .map(normalize_path_for_compare)
        .filter(|value| !value.is_empty());
    let mut best_match: Option<(PathBuf, f32)> = None;

    if let Some(manifest_dir) = manifest_dir {
        if let Ok(entries) = fs::read_dir(manifest_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|value| value.to_str()) != Some("item") {
                    continue;
                }

                let Ok(content) = fs::read_to_string(&path) else {
                    continue;
                };
                let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
                    continue;
                };

                let display_name = json
                    .get("DisplayName")
                    .and_then(|value| value.as_str())
                    .or_else(|| json.get("AppName").and_then(|value| value.as_str()))
                    .unwrap_or_default();
                let manifest_install_path = json
                    .get("InstallLocation")
                    .and_then(|value| value.as_str())
                    .unwrap_or_default();
                let normalized_manifest_path = normalize_path_for_compare(manifest_install_path);
                let path_matches = clean_install_path
                    .as_ref()
                    .is_some_and(|path| !normalized_manifest_path.is_empty() && (path == &normalized_manifest_path || path.contains(&normalized_manifest_path) || normalized_manifest_path.contains(path)));
                let score = if path_matches {
                    1.0
                } else {
                    title_similarity(title, display_name)
                };

                if score >= 0.62 && best_match.as_ref().map(|(_, best_score)| score > *best_score).unwrap_or(true) {
                    let folder = PathBuf::from(manifest_install_path);
                    if folder.exists() {
                        best_match = Some((folder, score));
                    }
                }
            }
        }
    }

    best_match
        .map(|(folder, _)| folder)
        .or_else(|| find_folder_in_root_by_title(&PathBuf::from(r"C:\Program Files\Epic Games"), title))
        .or_else(|| env::var_os("ProgramFiles").and_then(|program_files| {
            find_folder_in_root_by_title(&PathBuf::from(program_files).join("Epic Games"), title)
        }))
}

fn find_steam_install_folder_by_app_id(app_id: u32) -> Option<PathBuf> {
    for steam_apps in steam_apps_roots() {
        let manifest_path = steam_apps.join(format!("appmanifest_{app_id}.acf"));
        let Ok(content) = fs::read_to_string(manifest_path) else {
            continue;
        };
        let Some(install_dir) = content.lines().find_map(|line| extract_vdf_value(line, "installdir")) else {
            continue;
        };
        let folder = steam_apps.join("common").join(install_dir);
        if folder.exists() {
            return Some(folder);
        }
    }

    None
}

fn find_steam_install_folder_by_title(title: &str) -> Option<PathBuf> {
    let mut best_match: Option<(PathBuf, f32)> = None;

    for steam_apps in steam_apps_roots() {
        let Ok(entries) = fs::read_dir(&steam_apps) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !file_name.starts_with("appmanifest_") || !file_name.ends_with(".acf") {
                continue;
            }
            let Ok(content) = fs::read_to_string(&path) else {
                continue;
            };
            let Some(candidate_title) = content.lines().find_map(|line| extract_vdf_value(line, "name")) else {
                continue;
            };
            let Some(install_dir) = content.lines().find_map(|line| extract_vdf_value(line, "installdir")) else {
                continue;
            };
            let score = title_similarity(title, &candidate_title);
            if score >= 0.62 && best_match.as_ref().map(|(_, best_score)| score > *best_score).unwrap_or(true) {
                let folder = steam_apps.join("common").join(install_dir);
                if folder.exists() {
                    best_match = Some((folder, score));
                }
            }
        }
    }

    best_match.map(|(folder, _)| folder)
}

fn find_common_install_folder_by_title(title: &str) -> Option<PathBuf> {
    let mut best_match: Option<(PathBuf, f32)> = None;

    for root in common_game_search_roots() {
        scan_install_folder_candidates(&root, title, 0, &mut best_match);
        if best_match.as_ref().is_some_and(|(_, score)| *score >= 0.92) {
            break;
        }
    }

    best_match.map(|(folder, _)| folder)
}

fn find_folder_in_root_by_title(root: &Path, title: &str) -> Option<PathBuf> {
    let mut best_match: Option<(PathBuf, f32)> = None;
    scan_install_folder_candidates(root, title, 0, &mut best_match);
    best_match.map(|(folder, _)| folder)
}

fn scan_install_folder_candidates(
    root: &Path,
    title: &str,
    depth: usize,
    best_match: &mut Option<(PathBuf, f32)>,
) {
    if depth > 2 {
        return;
    }

    let Ok(entries) = fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }

        let path = entry.path();
        let folder_name = entry.file_name().to_string_lossy().trim().to_string();
        if folder_name.is_empty() || should_skip_install_search_folder(&folder_name) {
            continue;
        }

        let score = title_similarity(title, &folder_name).max(compact_title_similarity(title, &folder_name));
        if score >= 0.62 && best_match.as_ref().map(|(_, best_score)| score > *best_score).unwrap_or(true) {
            *best_match = Some((path.clone(), score));
        }

        let lower_name = folder_name.to_ascii_lowercase();
        let should_descend = depth == 0
            && [
                "games",
                "epic games",
                "gog galaxy",
                "gog.com",
                "ubisoft",
                "ubisoft game launcher",
                "ea games",
                "origin games",
                "amazon games",
                "riot games",
                "xboxgames",
                "windowsapps",
            ]
            .iter()
            .any(|known| lower_name.contains(known));

        if should_descend {
            scan_install_folder_candidates(&path, title, depth + 1, best_match);
        }
    }
}

fn common_game_search_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Some(program_files) = env::var_os("ProgramFiles") {
        let root = PathBuf::from(program_files);
        roots.push(root.clone());
        roots.push(root.join("Epic Games"));
        roots.push(root.join("GOG Galaxy").join("Games"));
        roots.push(root.join("Ubisoft").join("Ubisoft Game Launcher").join("games"));
        roots.push(root.join("EA Games"));
        roots.push(root.join("Amazon Games"));
        roots.push(root.join("Riot Games"));
    }

    if let Some(program_files_x86) = env::var_os("ProgramFiles(x86)") {
        let root = PathBuf::from(program_files_x86);
        roots.push(root.clone());
        roots.push(root.join("GOG Galaxy").join("Games"));
        roots.push(root.join("Ubisoft").join("Ubisoft Game Launcher").join("games"));
        roots.push(root.join("EA Games"));
        roots.push(root.join("Origin Games"));
        roots.push(root.join("Riot Games"));
    }

    if let Some(program_data) = env::var_os("ProgramData") {
        roots.push(PathBuf::from(program_data).join("Microsoft").join("Windows").join("Start Menu").join("Programs"));
    }

    for drive in 'C'..='Z' {
        let root = PathBuf::from(format!("{drive}:\\"));
        roots.push(root.join("Games"));
        roots.push(root.join("Oyunlar"));
        roots.push(root.join("XboxGames"));
        roots.push(root.join("Epic Games"));
        roots.push(root.join("GOG Games"));
        roots.push(root.join("EA Games"));
        roots.push(root.join("Ubisoft Games"));
    }

    roots
        .into_iter()
        .filter(|path| path.exists())
        .fold(Vec::<PathBuf>::new(), |mut unique_roots, path| {
            let normalized = normalize_path_for_compare(&path.to_string_lossy());
            if !unique_roots
                .iter()
                .any(|existing| normalize_path_for_compare(&existing.to_string_lossy()) == normalized)
            {
                unique_roots.push(path);
            }
            unique_roots
        })
}

fn should_skip_install_search_folder(folder_name: &str) -> bool {
    let lower_name = folder_name.to_ascii_lowercase();
    [
        "$",
        ".",
        "common files",
        "internet explorer",
        "microsoft",
        "windows",
        "windows defender",
        "windows mail",
        "windows media player",
        "windows nt",
        "windows photo viewer",
        "windows sidebar",
        "windowsapps",
        "modifiablewindowsapps",
        "uninstall",
        "redist",
        "redistributables",
        "_commonredist",
        "directx",
        "directxredist",
        "launcher",
        "steamworks shared",
        "support",
        "egstore",
    ]
    .iter()
    .any(|prefix| lower_name.starts_with(prefix))
}

fn should_skip_automatic_candidate(title: &str) -> bool {
    let normalized = title.to_ascii_lowercase();
    [
        "directxredist",
        "launcher",
        "steamworks common redistributables",
        "steamworks shared",
        "driver booster for steam",
    ]
    .iter()
    .any(|blocked| normalized == *blocked || normalized.contains(blocked))
}

fn steam_apps_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Some(program_files_x86) = env::var_os("ProgramFiles(x86)") {
        let steam_apps = PathBuf::from(program_files_x86).join("Steam").join("steamapps");
        roots.push(steam_apps.clone());

        let library_file = steam_apps.join("libraryfolders.vdf");
        if let Ok(content) = fs::read_to_string(library_file) {
            for line in content.lines() {
                if let Some(path) = extract_vdf_value(line, "path") {
                    roots.push(PathBuf::from(path).join("steamapps"));
                }
            }
        }
    }

    roots
}

fn epic_manifest_dir() -> Option<PathBuf> {
    env::var_os("ProgramData").map(|program_data| {
        PathBuf::from(program_data)
            .join("Epic")
            .join("EpicGamesLauncher")
            .join("Data")
            .join("Manifests")
    })
}

fn ubisoft_games_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Some(program_files) = env::var_os("ProgramFiles") {
        roots.push(
            PathBuf::from(program_files)
                .join("Ubisoft")
                .join("Ubisoft Game Launcher")
                .join("games"),
        );
    }

    if let Some(program_files_x86) = env::var_os("ProgramFiles(x86)") {
        roots.push(
            PathBuf::from(program_files_x86)
                .join("Ubisoft")
                .join("Ubisoft Game Launcher")
                .join("games"),
        );
    }

    roots
}

fn ea_games_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Some(program_files) = env::var_os("ProgramFiles") {
        let root = PathBuf::from(program_files);
        roots.push(root.join("EA Games"));
        roots.push(root.join("Origin Games"));
    }
    if let Some(program_files_x86) = env::var_os("ProgramFiles(x86)") {
        let root = PathBuf::from(program_files_x86);
        roots.push(root.join("EA Games"));
        roots.push(root.join("Origin Games"));
    }
    if let Some(program_data) = env::var_os("ProgramData") {
        let machine_file = PathBuf::from(program_data).join("EA Desktop").join("machine.ini");
        if let Ok(content) = fs::read_to_string(machine_file) {
            for line in content.lines() {
                if let Some(path) = line.strip_prefix("machine.downloadinplacedir=") {
                    roots.push(PathBuf::from(path.trim()));
                }
            }
        }
    }
    for drive in 'C'..='Z' {
        let root = PathBuf::from(format!("{drive}:\\"));
        roots.push(root.join("EA Games"));
        roots.push(root.join("Origin Games"));
    }

    unique_existing_paths(roots)
}

fn unique_existing_paths(roots: Vec<PathBuf>) -> Vec<PathBuf> {
    roots
        .into_iter()
        .filter(|path| path.exists())
        .fold(Vec::<PathBuf>::new(), |mut unique_roots, path| {
            let normalized = normalize_path_for_compare(&path.to_string_lossy());
            if !unique_roots
                .iter()
                .any(|existing| normalize_path_for_compare(&existing.to_string_lossy()) == normalized)
            {
                unique_roots.push(path);
            }
            unique_roots
        })
}

fn path_is_inside_root(folder: &Path, root: &Path) -> bool {
    let folder = normalize_path_for_compare(&folder.to_string_lossy());
    let root = normalize_path_for_compare(&root.to_string_lossy());
    folder == root || folder.starts_with(&format!("{root}\\"))
}

fn is_ea_install_folder_path(folder: &Path) -> bool {
    ea_games_roots().iter().any(|root| path_is_inside_root(folder, root))
}

fn is_plausible_game_folder_title(title: &str) -> bool {
    normalize_metadata_title(title)
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .count()
        >= 3
}

fn contains_probable_game_executable(folder: &Path) -> bool {
    find_launchable_executable(folder).is_some()
}

fn normalize_path_for_compare(value: &str) -> String {
    value
        .trim()
        .trim_end_matches(['\\', '/'])
        .replace('/', "\\")
        .to_ascii_lowercase()
}

fn scan_common_game_dirs(candidates: &mut Vec<InstalledGameCandidate>) {
    let mut roots = Vec::new();

    if let Some(program_files) = env::var_os("ProgramFiles") {
        let root = PathBuf::from(program_files);
        roots.push((root.join("Epic Games"), "Epic Games"));
        roots.push((root.join("GOG Galaxy").join("Games"), "GOG"));
        roots.push((root.join("Ubisoft").join("Ubisoft Game Launcher").join("games"), "Ubisoft Connect"));
        roots.push((root.join("EA Games"), "EA App"));
        roots.push((root.join("Amazon Games"), "Amazon Games"));
    }

    if let Some(program_files_x86) = env::var_os("ProgramFiles(x86)") {
        let root = PathBuf::from(program_files_x86);
        roots.push((root.join("GOG Galaxy").join("Games"), "GOG"));
        roots.push((root.join("Ubisoft").join("Ubisoft Game Launcher").join("games"), "Ubisoft Connect"));
    }

    for (root, platform_name) in roots {
        scan_one_level_directory(&root, platform_name, candidates);
    }
}

fn scan_windows_shortcuts(candidates: &mut Vec<InstalledGameCandidate>) {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = candidates;
    }

    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'SilentlyContinue'
$roots = @()
if ($env:USERPROFILE) {
  $roots += (Join-Path $env:USERPROFILE 'Desktop')
  $roots += (Join-Path $env:USERPROFILE 'OneDrive\Desktop')
  $roots += (Join-Path $env:USERPROFILE 'OneDrive\Masaüstü')
}
if ($env:PUBLIC) { $roots += (Join-Path $env:PUBLIC 'Desktop') }
if ($env:APPDATA) { $roots += (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs') }
if ($env:ProgramData) { $roots += (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs') }
$shell = New-Object -ComObject WScript.Shell
$items = foreach ($root in ($roots | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique)) {
  Get-ChildItem -LiteralPath $root -Filter *.lnk -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    $shortcut = $shell.CreateShortcut($_.FullName)
    if ($shortcut.TargetPath) {
      [pscustomobject]@{
        title = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
        targetPath = $shortcut.TargetPath
        workingDirectory = $shortcut.WorkingDirectory
        arguments = $shortcut.Arguments
      }
    }
  }
}
$items | ConvertTo-Json -Compress
"#;

        let Ok(output) = Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
            .output()
        else {
            return;
        };

        if !output.status.success() {
            return;
        }

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            return;
        }

        let shortcuts = parse_windows_shortcut_candidates(&stdout);
        for shortcut in shortcuts {
            if let Some(candidate) = installed_candidate_from_shortcut(shortcut) {
                candidates.push(candidate);
            }
        }
    }
}

fn parse_windows_shortcut_candidates(content: &str) -> Vec<WindowsShortcutCandidate> {
    if let Ok(items) = serde_json::from_str::<Vec<WindowsShortcutCandidate>>(content) {
        return items;
    }

    serde_json::from_str::<WindowsShortcutCandidate>(content)
        .map(|item| vec![item])
        .unwrap_or_default()
}

fn installed_candidate_from_shortcut(shortcut: WindowsShortcutCandidate) -> Option<InstalledGameCandidate> {
    let title = clean_shortcut_title(&shortcut.title);
    if title.is_empty() || should_skip_shortcut_title(&title) {
        return None;
    }

    if let Some(install_folder) = find_epic_install_folder_from_shortcut_arguments(&shortcut.arguments) {
        return Some(InstalledGameCandidate {
            title,
            platform_name: "Epic Games".to_string(),
            install_path: install_folder.to_string_lossy().to_string(),
        });
    }

    let target_path = PathBuf::from(shortcut.target_path.trim());
    let working_directory = shortcut.working_directory.trim();
    let arguments = shortcut.arguments.trim();
    let install_folder = if target_path.exists() {
        if target_path.is_dir() {
            Some(target_path)
        } else {
            target_path.parent().map(Path::to_path_buf)
        }
    } else if !working_directory.is_empty() {
        path_to_existing_folder(working_directory)
    } else {
        extract_existing_folder_from_shortcut_arguments(arguments)
    }?;

    if !looks_like_game_install_folder(&install_folder, &title) {
        return None;
    }

    Some(InstalledGameCandidate {
        title,
        platform_name: infer_platform_from_path(&install_folder),
        install_path: install_folder.to_string_lossy().to_string(),
    })
}

fn clean_shortcut_title(title: &str) -> String {
    title
        .trim()
        .trim_end_matches(" - Shortcut")
        .trim_end_matches(" - Kısayol")
        .trim()
        .to_string()
}

fn should_skip_shortcut_title(title: &str) -> bool {
    let normalized = title.to_ascii_lowercase();
    [
        "bgaming",
        "about irfanview",
        "adobe acrobat",
        "amazon games",
        "cpu-z",
        "driver booster",
        "ea",
        "edit cpu-z",
        "faceit",
        "git",
        "github desktop",
        "google play games",
        "google chrome",
        "idle",
        "iobit",
        "irfanview",
        "microsoft edge",
        "node.js",
        "onedrive",
        "python",
        "riot istemcisi",
        "rockstar games launcher",
        "sql server",
        "discord",
        "steam",
        "steamworks common redistributables",
        "telegram",
        "ubisoft connect",
        "uninstall",
        "visual studio installer",
        "windows media player",
        "windows software development kit",
        "winrar",
        "epic games launcher",
        "riot client",
        "nvidia app",
        "playnite",
        "gemini",
    ]
    .iter()
    .any(|blocked| normalized == *blocked || normalized.contains(&format!("{blocked}.bat")))
}

fn extract_existing_folder_from_shortcut_arguments(arguments: &str) -> Option<PathBuf> {
    arguments
        .split('"')
        .find_map(|part| {
            let value = part.trim();
            if value.len() > 2 && (value.contains(":\\") || value.contains(":/")) {
        path_to_existing_folder(value)
            } else {
                None
            }
        })
}

fn find_epic_install_folder_from_shortcut_arguments(arguments: &str) -> Option<PathBuf> {
    let app_name = extract_epic_app_name_from_arguments(arguments)?;
    find_epic_install_folder_by_app_name(&app_name)
}

fn extract_epic_app_name_from_arguments(arguments: &str) -> Option<String> {
    let marker = "com.epicgames.launcher://apps/";
    let start = arguments.find(marker)? + marker.len();
    let rest = &arguments[start..];
    let encoded_app_name = rest
        .split(['?', '&', '"', '\''])
        .next()
        .unwrap_or_default()
        .trim();

    if encoded_app_name.is_empty() {
        None
    } else {
        Some(percent_decode_path_segment(encoded_app_name))
    }
}

fn percent_decode_path_segment(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded = Vec::new();
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(hex) = u8::from_str_radix(&value[index + 1..index + 3], 16) {
                decoded.push(hex);
                index += 3;
                continue;
            }
        }

        decoded.push(bytes[index]);
        index += 1;
    }

    String::from_utf8_lossy(&decoded).to_string()
}

fn find_epic_install_folder_by_app_name(app_name: &str) -> Option<PathBuf> {
    let manifest_dir = epic_manifest_dir()?;
    let entries = fs::read_dir(manifest_dir).ok()?;
    let normalized_app_name = app_name.trim();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("item") {
            continue;
        }

        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };

        let manifest_app_name = json
            .get("AppName")
            .and_then(|value| value.as_str())
            .or_else(|| json.get("CatalogItemId").and_then(|value| value.as_str()))
            .unwrap_or_default()
            .trim();

        if manifest_app_name.eq_ignore_ascii_case(normalized_app_name) {
            let install_path = json
                .get("InstallLocation")
                .and_then(|value| value.as_str())
                .unwrap_or_default();
            if let Some(folder) = path_to_existing_folder(install_path) {
                return Some(folder);
            }
        }
    }

    None
}

fn looks_like_game_install_folder(folder: &Path, title: &str) -> bool {
    let _ = title;
    let path_text = normalize_path_for_compare(&folder.to_string_lossy());
    [
        "\\epic games\\",
        "\\steamapps\\common\\",
        "\\gog galaxy\\games\\",
        "\\gog games\\",
        "\\ubisoft",
        "\\ea games\\",
        "\\origin games\\",
        "\\amazon games\\",
        "\\riot games\\",
        "\\xboxgames\\",
        "\\games\\",
        "\\oyunlar\\",
    ]
    .iter()
    .any(|marker| path_text.contains(marker))
}

fn infer_platform_from_path(folder: &Path) -> String {
    let path_text = normalize_path_for_compare(&folder.to_string_lossy());
    if path_text.contains("\\epic games\\") {
        "Epic Games".to_string()
    } else if path_text.contains("\\steamapps\\common\\") || path_text.contains("\\steam\\") {
        "Steam".to_string()
    } else if path_text.contains("\\gog") {
        "GOG".to_string()
    } else if path_text.contains("\\ubisoft") {
        "Ubisoft Connect".to_string()
    } else if path_text.contains("\\ea games\\") || path_text.contains("\\origin games\\") {
        "EA App".to_string()
    } else if path_text.contains("\\amazon games\\") {
        "Amazon Games".to_string()
    } else {
        "Manuel / Bilinmeyen".to_string()
    }
}

fn scan_one_level_directory(root: &Path, platform_name: &str, candidates: &mut Vec<InstalledGameCandidate>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }
        let title = entry.file_name().to_string_lossy().trim().to_string();
        if title.is_empty() || title.starts_with('.') || should_skip_install_search_folder(&title) {
            continue;
        }

        candidates.push(InstalledGameCandidate {
            title,
            platform_name: platform_name.to_string(),
            install_path: entry.path().to_string_lossy().to_string(),
        });
    }
}

fn launch_uri(uri: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", uri])
            .spawn()
            .map_err(|error| format!("Oyun başlatılamadı: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(uri)
            .spawn()
            .map_err(|error| format!("Oyun başlatılamadı: {error}"))?;
        return Ok(());
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(uri)
            .spawn()
            .map_err(|error| format!("Oyun başlatılamadı: {error}"))?;
        Ok(())
    }
}

fn open_folder(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|error| format!("Klasör açılamadı: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|error| format!("Klasör açılamadı: {error}"))?;
        return Ok(());
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|error| format!("Klasör açılamadı: {error}"))?;
        Ok(())
    }
}

fn find_launchable_executable(root: &Path) -> Option<PathBuf> {
    let mut best_match: Option<(PathBuf, u8)> = None;
    collect_launchable_executables(root, root, 0, &mut best_match);
    best_match.map(|(path, _)| path)
}

fn collect_launchable_executables(root: &Path, current_dir: &Path, depth: usize, best_match: &mut Option<(PathBuf, u8)>) {
    if depth > 3 {
        return;
    }

    let Ok(entries) = fs::read_dir(current_dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if file_type.is_dir() {
            let folder_name = entry.file_name().to_string_lossy().to_ascii_lowercase();
            if ["_commonredist", "redist", "redistributables", "support", "engine", "binaries", "content"]
                .contains(&folder_name.as_str())
            {
                continue;
            }
            collect_launchable_executables(root, &path, depth + 1, best_match);
            continue;
        }

        if !file_type.is_file() || path.extension().and_then(|value| value.to_str()).map(|value| !value.eq_ignore_ascii_case("exe")).unwrap_or(true) {
            continue;
        }

        let score = executable_launch_score(root, &path, depth);
        if best_match
            .as_ref()
            .map(|(_, best_score)| score > *best_score)
            .unwrap_or(true)
        {
            *best_match = Some((path, score));
        }
    }
}

fn executable_launch_score(root: &Path, path: &Path, depth: usize) -> u8 {
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let root_name = root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if stem == root_name {
        return 100;
    }
    if !root_name.is_empty() && (stem.contains(&root_name) || root_name.contains(&stem)) {
        return 90;
    }
    if ["launcher", "launch", "start", "game"].iter().any(|keyword| stem.contains(keyword)) {
        return 72u8.saturating_sub(depth as u8 * 4);
    }
    if ["setup", "install", "unins", "uninstall", "crash", "report", "redist", "unitycrashhandler"]
        .iter()
        .any(|keyword| stem.contains(keyword))
    {
        return 10;
    }

    55u8.saturating_sub(depth as u8 * 4)
}

fn extract_vdf_value(line: &str, key: &str) -> Option<String> {
    let trimmed = line.trim();
    let prefix = format!("\"{key}\"");
    if !trimmed.starts_with(&prefix) {
        return None;
    }

    let value = trimmed[prefix.len()..].trim().trim_matches('"').to_string();
    if value.is_empty() {
        None
    } else {
        Some(value.replace("\\\\", "\\"))
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(CloseBehaviorState {
            minimize_to_tray: AtomicBool::new(true),
        })
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--background-startup"]),
        ))
        .setup(|app| {
            if is_background_startup() {
                ensure_tray_icon(app.handle())?;
            } else {
                restore_window_state(app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = save_window_state(window);
                    let minimize_to_tray = window
                        .state::<CloseBehaviorState>()
                        .minimize_to_tray
                        .load(Ordering::Relaxed);

                    if minimize_to_tray {
                        api.prevent_close();
                        let _ = window.hide();
                        let _ = ensure_tray_icon(window.app_handle());
                    } else {
                        window.app_handle().exit(0);
                    }
                } else if matches!(window.label(), "quick-launcher-widget" | "surprise-widget") {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            select_and_store_cover,
            delete_cover_file,
            select_import_file,
            save_text_report,
            save_profile_image,
            select_scan_folder,
            set_mini_mode,
            set_widget_open,
            set_close_button_behavior,
            scan_installed_games,
            scan_trusted_installed_games,
            check_installed_game_states,
            launch_game,
            reveal_game_folder,
            copy_import_cover,
            get_app_storage_paths,
            merge_duplicate_games_native,
            test_steam_connection,
            fetch_steam_library,
            fetch_latest_github_release,
            fetch_game_metadata,
            fetch_cover_candidates,
            store_cover_candidate,
            fetch_game_language_info,
            backup_library,
            select_backup_folder,
            restore_library_backup,
            clear_user_data_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn timestamp() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())
        .map(|duration| duration.as_millis())
}

fn bool_to_int(value: bool) -> i32 {
    if value {
        1
    } else {
        0
    }
}

fn clean_names(values: &[String]) -> Vec<String> {
    let mut names = Vec::new();

    for value in values {
        let clean_value = value.trim();
        if clean_value.is_empty() || names.iter().any(|existing: &String| existing.eq_ignore_ascii_case(clean_value)) {
            continue;
        }
        names.push(clean_value.to_string());
    }

    names
}

fn sqlite_error_message(error: sqlx::Error) -> String {
    let message = error.to_string();
    let lower_message = message.to_ascii_lowercase();

    if lower_message.contains("database is locked") || lower_message.contains("database table is locked") {
        "Veritabanı başka bir işlem tarafından kilitli. Açık ikinci BGaming penceresi varsa kapatıp tekrar deneyin.".to_string()
    } else {
        message
    }
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

fn find_existing_database_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    database_candidates(app)
        .into_iter()
        .find(|candidate| candidate.exists())
}

fn database_candidates(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(path) = app.path().app_data_dir() {
        candidates.push(path.join("bgaming.db"));
    }

    if let Ok(path) = app.path().app_config_dir() {
        candidates.push(path.join("bgaming.db"));
    }

    if let Ok(path) = app.path().app_local_data_dir() {
        candidates.push(path.join("bgaming.db"));
    }

    candidates
}

fn copy_dir_all(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| error.to_string())?;

    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let entry_type = entry.file_type().map_err(|error| error.to_string())?;
        let target_path = target.join(entry.file_name());

        if entry_type.is_dir() {
            copy_dir_all(&entry.path(), &target_path)?;
        } else {
            fs::copy(entry.path(), target_path).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn clean_required(value: &str, message: &str) -> Result<String, String> {
    let clean = value.trim();
    if clean.is_empty() {
        return Err(message.to_string());
    }

    Ok(clean.to_string())
}

fn resolve_steam_id(api_key: &str, input: &str) -> Result<String, String> {
    let clean = clean_required(input, "SteamID veya profil linki bos olamaz.")?;

    if clean.chars().all(|character| character.is_ascii_digit()) && clean.len() >= 16 {
        return Ok(clean);
    }

    if let Some(profile_id) = extract_between(&clean, "/profiles/") {
        if profile_id.chars().all(|character| character.is_ascii_digit()) {
            return Ok(profile_id);
        }
    }

    let vanity = if let Some(value) = extract_between(&clean, "/id/") {
        value
    } else {
        clean.trim_matches('/').to_string()
    };

    let response: ResolveVanityResponse = reqwest::blocking::Client::new()
        .get("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/")
        .query(&[
            ("key", api_key),
            ("vanityurl", vanity.as_str()),
            ("format", "json"),
        ])
        .send()
        .map_err(|_| "Steam API'ye ulaşılamadı. İnternet bağlantını kontrol et.".to_string())?
        .error_for_status()
        .map_err(|error| map_steam_http_error(error.status().map(|status| status.as_u16())))?
        .json()
        .map_err(|_| "SteamID çözme yanıtı okunamadı.".to_string())?;

    if response.response.success == 1 {
        return response
            .response
            .steamid
            .ok_or_else(|| "SteamID cozulemedi.".to_string());
    }

    Err(response
        .response
        .message
        .unwrap_or_else(|| "SteamID veya profil linki cozulemedi.".to_string()))
}

fn fetch_player_summary(api_key: &str, steam_id: &str) -> Result<SteamPlayer, String> {
    let response: PlayerSummariesResponse = reqwest::blocking::Client::new()
        .get("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/")
        .query(&[
            ("key", api_key),
            ("steamids", steam_id),
            ("format", "json"),
        ])
        .send()
        .map_err(|_| "Steam API'ye ulaşılamadı. İnternet bağlantını kontrol et.".to_string())?
        .error_for_status()
        .map_err(|error| map_steam_http_error(error.status().map(|status| status.as_u16())))?
        .json()
        .map_err(|_| "Steam profil yanıtı okunamadı.".to_string())?;

    response
        .response
        .players
        .into_iter()
        .next()
        .ok_or_else(|| "Steam profili bulunamadı. SteamID veya profil linkini kontrol et.".to_string())
}

fn fetch_owned_games(api_key: &str, steam_id: &str) -> Result<OwnedGamesResponse, String> {
    let response: OwnedGamesResponse = reqwest::blocking::Client::new()
        .get("https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/")
        .query(&[
            ("key", api_key),
            ("steamid", steam_id),
            ("include_appinfo", "true"),
            ("include_played_free_games", "true"),
            ("format", "json"),
        ])
        .send()
        .map_err(|_| "Steam API'ye ulaşılamadı. İnternet bağlantını kontrol et.".to_string())?
        .error_for_status()
        .map_err(|error| map_steam_http_error(error.status().map(|status| status.as_u16())))?
        .json()
        .map_err(|_| "Steam kütüphane yanıtı okunamadı.".to_string())?;

    if response.response.games.is_none() {
        return Err("Steam kütüphanesi okunamadı. Profil gizli olabilir veya API Key bu hesaba erişemiyor olabilir.".to_string());
    }

    Ok(response)
}

fn download_steam_cover(app: &tauri::AppHandle, app_id: u32) -> (Option<String>, Option<String>) {
    let url = format!("https://cdn.akamai.steamstatic.com/steam/apps/{app_id}/header.jpg");
    download_cover_from_url(app, &url, &format!("steam-{app_id}.jpg"))
}

fn download_cover_from_url(app: &tauri::AppHandle, url: &str, file_name: &str) -> (Option<String>, Option<String>) {
    let client = reqwest::blocking::Client::new();
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 BGaming cover downloader")
        .send();
    let Ok(response) = response else {
        return (None, Some("Kapak indirilemedi.".to_string()));
    };

    if !response.status().is_success() {
        return (None, Some("Steam kapak görseli bulunamadı.".to_string()));
    }

    let Ok(bytes) = response.bytes() else {
        return (None, Some("Kapak verisi okunamadi.".to_string()));
    };
    let Ok(covers_dir) = app_data_dir(app).map(|path| path.join("covers")) else {
        return (None, Some("Kapak klasörü hazırlanamadı.".to_string()));
    };

    if let Err(error) = fs::create_dir_all(&covers_dir) {
        return (None, Some(error.to_string()));
    }

    let target_path = covers_dir.join(file_name);
    if let Err(error) = fs::write(&target_path, bytes) {
        return (None, Some(error.to_string()));
    }

    (Some(target_path.to_string_lossy().to_string()), None)
}

fn cover_file_extension_from_url(url: &str) -> &'static str {
    let lower = url
        .split(['?', '#'])
        .next()
        .unwrap_or(url)
        .to_ascii_lowercase();

    if lower.ends_with(".png") {
        "png"
    } else if lower.ends_with(".webp") {
        "webp"
    } else {
        "jpg"
    }
}

fn is_allowed_cover_candidate_url(url: &str) -> bool {
    [
        "https://cdn.steamgriddb.com/",
        "https://cdn2.steamgriddb.com/",
        "https://steamgriddb.com/",
        "https://shared.akamai.steamstatic.com/",
        "https://cdn.akamai.steamstatic.com/",
    ]
    .iter()
    .any(|prefix| url.starts_with(prefix))
}

fn extract_between(input: &str, marker: &str) -> Option<String> {
    let index = input.find(marker)?;
    let rest = &input[index + marker.len()..];
    let value = rest
        .split(['/', '?', '#'])
        .next()
        .unwrap_or("")
        .trim();

    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn map_steam_http_error(status: Option<u16>) -> String {
    match status {
        Some(401) | Some(403) => "Steam API Key gecersiz veya yetkisiz.".to_string(),
        Some(404) => "Steam profili veya endpoint bulunamadı.".to_string(),
        Some(429) => "Steam API limitine takildin. Biraz sonra tekrar dene.".to_string(),
        Some(code) => format!("Steam API hata kodu: {code}."),
        None => "Steam API istegi basarisiz oldu.".to_string(),
    }
}

fn parse_release_year(value: &str) -> Option<i32> {
    value
        .split(|character: char| !character.is_ascii_digit())
        .find(|part| part.len() == 4)
        .and_then(|year| year.parse::<i32>().ok())
        .filter(|year| (1970..=2100).contains(year))
}

fn fetch_steam_store_tags(app_id: u32) -> Result<Vec<String>, String> {
    let url = format!("https://store.steampowered.com/app/{app_id}/?l=turkish");
    let html = reqwest::blocking::get(url)
        .map_err(|_| "Steam mağaza etiketleri okunamadı.".to_string())?
        .error_for_status()
        .map_err(|_| "Steam mağaza sayfası açılamadı.".to_string())?
        .text()
        .map_err(|_| "Steam mağaza sayfası çözümlenemedi.".to_string())?;

    let mut tags: Vec<String> = Vec::new();
    for segment in html.split("app_tag") {
        let Some(after_tag) = segment.split('>').nth(1) else {
            continue;
        };
        let Some(raw_tag) = after_tag.split('<').next() else {
            continue;
        };
        let tag = decode_html_text(raw_tag).trim().to_string();
        if tag.len() >= 2 && !tags.iter().any(|existing| existing.eq_ignore_ascii_case(&tag)) {
            tags.push(tag);
        }
        if tags.len() >= 12 {
            break;
        }
    }

    Ok(tags)
}

fn find_steam_app_id_by_title(title: &str) -> Result<Option<(u32, String)>, String> {
    let mut best_match: Option<(u32, String, f32)> = None;

    for query_title in metadata_search_variants(title) {
        let Some((app_id, candidate_title, score)) = search_steam_store_query(title, &query_title)? else {
            continue;
        };

        if best_match
            .as_ref()
            .map(|(_, _, best_score)| score > *best_score)
            .unwrap_or(true)
        {
            best_match = Some((app_id, candidate_title, score));
        }

        if score >= 0.86 {
            break;
        }
    }

    Ok(best_match.map(|(app_id, candidate_title, _)| (app_id, candidate_title)))
}

fn search_steam_store_query(original_title: &str, query_title: &str) -> Result<Option<(u32, String, f32)>, String> {
    let query = encode_query_component(query_title);
    let url = format!("https://store.steampowered.com/api/storesearch/?term={query}&l=turkish&cc=TR");
    let response: serde_json::Value = reqwest::blocking::get(url)
        .map_err(|_| "Steam Store aramasına ulaşılamadı. İnternet bağlantını kontrol et.".to_string())?
        .error_for_status()
        .map_err(|_| "Steam Store araması başarısız oldu.".to_string())?
        .json()
        .map_err(|_| "Steam Store arama yanıtı okunamadı.".to_string())?;
    let Some(items) = response.get("items").and_then(|value| value.as_array()) else {
        return Ok(None);
    };

    let mut best_match: Option<(u32, String, f32)> = None;
    for item in items.iter().take(25) {
        let Some(app_id) = item
            .get("id")
            .and_then(|value| value.as_u64())
            .and_then(|value| u32::try_from(value).ok())
        else {
            continue;
        };
        let Some(candidate_title) = item.get("name").and_then(|value| value.as_str()) else {
            continue;
        };
        let score = title_similarity(original_title, candidate_title).max(title_similarity(query_title, candidate_title));
        if is_reliable_title_match(original_title, candidate_title, score)
            && best_match.as_ref().map(|(_, _, best_score)| score > *best_score).unwrap_or(true)
        {
            best_match = Some((app_id, candidate_title.to_string(), score));
        }
    }

    Ok(best_match)
}

fn encode_query_component(value: &str) -> String {
    let mut encoded = String::new();

    for byte in value.as_bytes() {
        match *byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(*byte as char);
            }
            b' ' => encoded.push('+'),
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }

    encoded
}

fn encode_path_segment(value: &str) -> String {
    let mut encoded = String::new();

    for byte in value.as_bytes() {
        match *byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(*byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }

    encoded
}

fn metadata_search_variants(title: &str) -> Vec<String> {
    let mut variants = Vec::new();
    push_unique_variant(&mut variants, title);
    push_unique_variant(&mut variants, &remove_leading_zeroes_from_numbers(title));
    push_unique_variant(&mut variants, &title.replace('&', " and "));
    push_unique_variant(&mut variants, &title.replace('\'', ""));
    for alias in known_title_aliases(title) {
        push_unique_variant(&mut variants, &alias);
    }

    let normalized = normalize_metadata_title(title);
    push_unique_variant(&mut variants, &normalized);
    push_unique_variant(&mut variants, &normalized.replace(" and ", " "));
    push_unique_variant(&mut variants, &separate_digit_boundaries(&normalized));
    push_unique_variant(&mut variants, &strip_known_edition_suffixes(&normalized));

    for separator in [" - ", " – ", " — ", ": "] {
        if let Some(left) = title.split(separator).next() {
            push_unique_variant(&mut variants, left);
            push_unique_variant(&mut variants, &remove_leading_zeroes_from_numbers(left));
            let normalized_left = normalize_metadata_title(left);
            push_unique_variant(&mut variants, &normalized_left);
            push_unique_variant(&mut variants, &separate_digit_boundaries(&normalized_left));
            push_unique_variant(&mut variants, &strip_known_edition_suffixes(&normalized_left));
        }
    }

    variants
        .into_iter()
        .filter(|variant| normalize_metadata_title(variant).len() >= 3)
        .take(16)
        .collect()
}

fn push_unique_variant(variants: &mut Vec<String>, value: &str) {
    let clean = value.trim();
    if clean.is_empty() {
        return;
    }
    let normalized = normalize_metadata_title(clean);
    if normalized.is_empty() || variants.iter().any(|existing| normalize_metadata_title(existing) == normalized) {
        return;
    }

    variants.push(clean.to_string());
}

fn strip_known_edition_suffixes(value: &str) -> String {
    let mut clean = value.trim().to_string();
    let suffixes = [
        " game of the year edition",
        " legacy of thieves collection",
        " definitive series",
        " reloaded edition",
        " definitive edition",
        " enhanced edition",
        " complete edition",
        " limited edition",
        " ultimate edition",
        " deluxe edition",
        " standard edition",
        " special edition",
        " anniversary edition",
        " collectors edition",
        " collector edition",
        " gold edition",
        " goty edition",
        " directors cut",
        " director s cut",
        " complete story",
        " remastered",
        " edition",
        " season 1",
        " season 2",
    ];

    loop {
        let before = clean.clone();
        for suffix in suffixes {
            if clean.ends_with(suffix) && clean.len() > suffix.len() + 3 {
                clean.truncate(clean.len() - suffix.len());
                clean = clean.trim().to_string();
                break;
            }
        }
        if clean == before {
            break;
        }
    }

    clean
}

fn known_title_aliases(title: &str) -> Vec<String> {
    let normalized = normalize_metadata_title(title);
    let mut aliases = Vec::new();

    if normalized.starts_with("twd ") {
        aliases.push(normalized.replacen("twd", "the walking dead", 1));
    }
    if normalized == "twd the telltale definitive series" {
        aliases.push("the walking dead the telltale definitive series".to_string());
    }
    if normalized.contains("telltale batman season 1") {
        aliases.push("batman the telltale series".to_string());
    }
    if normalized.contains("telltale batman season 2") {
        aliases.push("batman the enemy within".to_string());
        aliases.push("batman the telltale series season 2".to_string());
    }
    if normalized.contains("mirrors edge") {
        aliases.push(normalized.replace("mirrors edge", "mirror edge"));
        aliases.push(normalized.replace("mirrors edge", "mirror s edge"));
    }
    if normalized.contains("golaco 2") || normalized.contains("golazo 2") {
        aliases.push("golazo 2".to_string());
    }
    if normalized.contains("real bout fatal fury 2") {
        aliases.push("real bout fatal fury 2 the newcomers".to_string());
    }
    if normalized.contains("faraway 2 jungle escape") {
        aliases.push("faraway jungle escape".to_string());
        aliases.push("faraway 2 jungle escape".to_string());
    }
    if normalized.contains("sherlock holmes chapter 1") {
        aliases.push("sherlock holmes chapter one".to_string());
    }
    if normalized.contains("quake 2 rtx") {
        aliases.push("quake ii rtx".to_string());
    }

    aliases
}

fn separate_digit_boundaries(value: &str) -> String {
    let mut result = String::new();
    let mut last_was_digit: Option<bool> = None;

    for character in value.chars() {
        let is_digit = character.is_ascii_digit();
        if let Some(previous_was_digit) = last_was_digit {
            if previous_was_digit != is_digit && !result.ends_with(' ') {
                result.push(' ');
            }
        }
        result.push(character);
        last_was_digit = Some(is_digit);
    }

    result.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn remove_leading_zeroes_from_numbers(value: &str) -> String {
    value
        .split_whitespace()
        .map(|part| {
            let trimmed = part.trim_matches(|character: char| !character.is_ascii_alphanumeric());
            if trimmed.chars().all(|character| character.is_ascii_digit()) {
                part.replace(trimmed, &normalize_metadata_token(trimmed))
            } else {
                part.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_reliable_title_match(original_title: &str, candidate_title: &str, score: f32) -> bool {
    if score >= 0.62 {
        return true;
    }
    if score < 0.46 {
        return false;
    }

    let original_tokens = comparable_title_tokens(&normalize_metadata_title(original_title));
    let candidate_tokens = comparable_title_tokens(&normalize_metadata_title(candidate_title));
    if original_tokens.len() < 2 || candidate_tokens.len() < 2 {
        return false;
    }

    original_tokens
        .iter()
        .take(2)
        .all(|token| candidate_tokens.iter().any(|candidate| candidate == token))
}

fn title_similarity(first: &str, second: &str) -> f32 {
    let first_normalized = normalize_metadata_title(first);
    let second_normalized = normalize_metadata_title(second);
    let compact_score = compact_title_similarity(first, second);

    if first_normalized.is_empty() || second_normalized.is_empty() {
        return compact_score;
    }
    if first_normalized == second_normalized {
        return 1.0;
    }
    if first_normalized.contains(&second_normalized) || second_normalized.contains(&first_normalized) {
        return 0.92_f32.max(compact_score);
    }

    let first_tokens = comparable_title_tokens(&first_normalized);
    let second_tokens = comparable_title_tokens(&second_normalized);
    if first_tokens.is_empty() || second_tokens.is_empty() {
        return compact_score;
    }

    let intersection = first_tokens
        .iter()
        .filter(|token| second_tokens.iter().any(|candidate| candidate == *token))
        .count();
    let union = first_tokens
        .iter()
        .chain(second_tokens.iter())
        .fold(Vec::<String>::new(), |mut tokens, token| {
            if !tokens.iter().any(|existing| existing == token) {
                tokens.push(token.clone());
            }
            tokens
        })
        .len()
        .max(1);
    let smaller_side = first_tokens.len().min(second_tokens.len()).max(1);
    let coverage = intersection as f32 / smaller_side as f32;
    let jaccard = intersection as f32 / union as f32;

    jaccard.max(coverage * 0.9).max(compact_score)
}

fn compact_title_similarity(first: &str, second: &str) -> f32 {
    let first_compact = compact_title_key(first);
    let second_compact = compact_title_key(second);

    if first_compact.is_empty() || second_compact.is_empty() {
        return 0.0;
    }
    if first_compact == second_compact {
        return 1.0;
    }
    if first_compact.len() >= 4
        && second_compact.len() >= 4
        && (first_compact.contains(&second_compact) || second_compact.contains(&first_compact))
    {
        return 0.94;
    }

    0.0
}

fn compact_title_key(value: &str) -> String {
    normalize_metadata_title(value)
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect()
}

fn comparable_title_tokens(value: &str) -> Vec<String> {
    let ignored = [
        "the",
        "a",
        "an",
        "s",
        "of",
        "game",
        "edition",
        "complete",
        "definitive",
        "enhanced",
        "remastered",
        "goty",
        "collection",
        "series",
        "season",
        "bundle",
        "pack",
        "reloaded",
        "standard",
        "deluxe",
        "ultimate",
        "gold",
        "special",
        "anniversary",
        "collector",
        "collectors",
        "director",
        "directors",
        "cut",
        "pc",
        "windows",
    ];

    value
        .split_whitespace()
        .filter(|token| token.len() > 1 && !ignored.contains(token))
        .map(normalize_comparable_token)
        .collect()
}

fn normalize_metadata_title(value: &str) -> String {
    let mut normalized = String::new();
    let mut last_was_space = false;
    let mut last_kind: Option<MetadataCharKind> = None;

    for character in value.to_lowercase().chars() {
        for character in fold_metadata_character(character).chars() {
            let kind = if character.is_ascii_digit() {
                Some(MetadataCharKind::Digit)
            } else if character.is_ascii_alphabetic() {
                Some(MetadataCharKind::Letter)
            } else {
                None
            };

            if let Some(kind) = kind {
                if last_kind.is_some_and(|previous| previous != kind) && !last_was_space {
                    normalized.push(' ');
                }
                normalized.push(character);
                last_was_space = false;
                last_kind = Some(kind);
            } else if !last_was_space {
                normalized.push(' ');
                last_was_space = true;
                last_kind = None;
            }
        }
    }

    normalized
        .split_whitespace()
        .map(normalize_metadata_token)
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalize_metadata_token(token: &str) -> String {
    if token.chars().all(|character| character.is_ascii_digit()) {
        let clean_number = token.trim_start_matches('0');
        if clean_number.is_empty() {
            "0".to_string()
        } else {
            clean_number.to_string()
        }
    } else {
        token.to_string()
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum MetadataCharKind {
    Letter,
    Digit,
}

fn fold_metadata_character(character: char) -> String {
    match character {
        'á' | 'à' | 'â' | 'ä' | 'ã' | 'å' | 'ā' => "a".to_string(),
        'ç' | 'ć' | 'č' => "c".to_string(),
        'é' | 'è' | 'ê' | 'ë' | 'ē' => "e".to_string(),
        'ğ' => "g".to_string(),
        'í' | 'ì' | 'î' | 'ï' | 'ı' | 'ī' => "i".to_string(),
        'ñ' => "n".to_string(),
        'ó' | 'ò' | 'ô' | 'ö' | 'õ' | 'ø' | 'ō' => "o".to_string(),
        'ş' | 'ś' | 'š' => "s".to_string(),
        'ú' | 'ù' | 'û' | 'ü' | 'ū' => "u".to_string(),
        'ý' | 'ÿ' => "y".to_string(),
        'ž' | 'ź' | 'ż' => "z".to_string(),
        'æ' => "ae".to_string(),
        'œ' => "oe".to_string(),
        'ß' => "ss".to_string(),
        _ if character.is_ascii() => character.to_string(),
        _ => " ".to_string(),
    }
}

fn normalize_comparable_token(token: &str) -> String {
    let clean = normalize_metadata_token(token);
    if clean.len() > 4 && clean.ends_with('s') {
        clean.trim_end_matches('s').to_string()
    } else {
        clean
    }
}

fn decode_html_text(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn restore_window_state(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if let Ok(path) = window_state_path(app) {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(state) = serde_json::from_str::<WindowState>(&content) {
                if state.width >= 1000 && state.height >= 650 {
                    let _ = window.set_size(Size::Physical(PhysicalSize {
                        width: state.width,
                        height: state.height,
                    }));
                    let _ = window.set_position(Position::Physical(PhysicalPosition {
                        x: state.x,
                        y: state.y,
                    }));
                }
            }
        }
    }

    let _ = window.show();
    let _ = window.maximize();
    let _ = window.set_focus();
}

fn is_background_startup() -> bool {
    env::args().any(|argument| argument == "--background-startup")
}

fn save_window_state(window: &tauri::Window) -> Result<(), String> {
    let size = window.outer_size().map_err(|error| error.to_string())?;
    let position = window.outer_position().map_err(|error| error.to_string())?;
    if size.width < 1000 || size.height < 650 {
        return Ok(());
    }

    let state = WindowState {
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
    };
    let app = window.app_handle();
    let path = window_state_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let content = serde_json::to_string_pretty(&state).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn window_state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("window-state.json"))
}
