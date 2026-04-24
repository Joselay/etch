use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::settings::{clear_token, has_token, known_hosts, set_token};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderToken {
    pub host: String,
    pub label: String,
    pub token_help_url: String,
    pub has_token: bool,
}

/// Reads only the on-disk presence index — no keychain access, no prompt.
#[tauri::command]
pub fn cmd_list_provider_tokens() -> AppResult<Vec<ProviderToken>> {
    let mut out = Vec::new();
    for p in known_hosts() {
        out.push(ProviderToken {
            host: p.host.to_string(),
            label: p.label.to_string(),
            token_help_url: p.token_help_url.to_string(),
            has_token: has_token(p.host),
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn cmd_set_provider_token(host: String, token: String) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || set_token(&host, &token))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_clear_provider_token(host: String) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || clear_token(&host))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}
