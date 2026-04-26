use std::collections::{BTreeSet, HashMap};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::error::{AppError, AppResult};

const SERVICE: &str = "com.menglay.etch";
const SETTINGS_FILE: &str = "settings.json";

/// Non-secret settings persisted to disk. The keychain only stores actual
/// tokens; this file records which hosts have tokens so existence checks
/// never need to unlock the keychain (and trigger the macOS ACL prompt).
#[derive(Default, Serialize, Deserialize)]
struct SettingsFile {
    #[serde(default)]
    token_hosts: BTreeSet<String>,
}

struct SettingsStore {
    path: PathBuf,
    data: Mutex<SettingsFile>,
    /// In-memory session cache. Once a token has been unlocked from the
    /// keychain in this process, reuse it instead of prompting again.
    token_cache: Mutex<HashMap<String, String>>,
}

static STORE: OnceLock<SettingsStore> = OnceLock::new();

pub fn init(app: &tauri::App) -> AppResult<()> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(format!("app_data_dir: {e}")))?;
    std::fs::create_dir_all(&dir)?;
    let path = dir.join(SETTINGS_FILE);
    let data = if path.exists() {
        let buf = std::fs::read_to_string(&path)?;
        serde_json::from_str::<SettingsFile>(&buf).unwrap_or_default()
    } else {
        SettingsFile::default()
    };
    let store = SettingsStore {
        path,
        data: Mutex::new(data),
        token_cache: Mutex::new(HashMap::new()),
    };
    let _ = STORE.set(store);
    Ok(())
}

fn store() -> AppResult<&'static SettingsStore> {
    STORE
        .get()
        .ok_or_else(|| AppError::Other("settings not initialized".into()))
}

fn persist(store: &SettingsStore) -> AppResult<()> {
    let data = store.data.lock().unwrap();
    let buf = serde_json::to_string_pretty(&*data)
        .map_err(|e| AppError::Other(format!("serialize settings: {e}")))?;
    std::fs::write(&store.path, buf)?;
    Ok(())
}

fn entry_for(host: &str) -> AppResult<Entry> {
    Entry::new(SERVICE, &format!("token:{host}")).map_err(|e| AppError::Keychain(e.to_string()))
}

/// Cheap, non-prompting existence check. Reads the on-disk index only.
pub fn has_token(host: &str) -> bool {
    store()
        .ok()
        .map(|s| s.data.lock().unwrap().token_hosts.contains(host))
        .unwrap_or(false)
}

/// Return the token for `host`, prompting the user via the OS keychain at
/// most once per process. Callers must only invoke this when they actually
/// need the secret (e.g. right before an authenticated request).
pub fn get_token(host: &str) -> AppResult<Option<String>> {
    let store = store()?;
    if let Some(cached) = store.token_cache.lock().unwrap().get(host) {
        return Ok(Some(cached.clone()));
    }
    if !has_token(host) {
        return Ok(None);
    }
    let entry = entry_for(host)?;
    match entry.get_password() {
        Ok(token) => {
            store
                .token_cache
                .lock()
                .unwrap()
                .insert(host.to_string(), token.clone());
            Ok(Some(token))
        }
        Err(keyring::Error::NoEntry) => {
            // Index claimed the token existed, but the keychain has lost it
            // (e.g. user deleted it via Keychain Access). Heal the index.
            store.data.lock().unwrap().token_hosts.remove(host);
            let _ = persist(store);
            Ok(None)
        }
        Err(e) => Err(AppError::Keychain(e.to_string())),
    }
}

pub fn set_token(host: &str, token: &str) -> AppResult<()> {
    let store = store()?;
    entry_for(host)?
        .set_password(token)
        .map_err(|e| AppError::Keychain(e.to_string()))?;
    store
        .data
        .lock()
        .unwrap()
        .token_hosts
        .insert(host.to_string());
    persist(store)?;
    store
        .token_cache
        .lock()
        .unwrap()
        .insert(host.to_string(), token.to_string());
    Ok(())
}

pub fn clear_token(host: &str) -> AppResult<()> {
    let store = store()?;
    match entry_for(host)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(AppError::Keychain(e.to_string())),
    }
    store.data.lock().unwrap().token_hosts.remove(host);
    persist(store)?;
    store.token_cache.lock().unwrap().remove(host);
    Ok(())
}

pub fn known_hosts() -> &'static [ProviderHost] {
    &[ProviderHost {
        host: "github.com",
        label: "GitHub",
        token_help_url: "https://github.com/settings/tokens/new?scopes=repo&description=Etch",
    }]
}

#[derive(Debug, Clone, Copy)]
pub struct ProviderHost {
    pub host: &'static str,
    pub label: &'static str,
    pub token_help_url: &'static str,
}
