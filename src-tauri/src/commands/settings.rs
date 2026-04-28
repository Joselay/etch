use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::providers::github::{validate_token as validate_github_token, TokenIdentity};
use crate::settings::{clear_token, get_token, has_token, known_hosts, set_token};

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

/// Validate either a freshly-pasted token (when `token` is provided) or the
/// token currently in the keychain for `host`. Returns the resolved identity
/// so the UI can show *who* the token authenticates as.
#[tauri::command]
pub async fn cmd_validate_provider_token(
    host: String,
    token: Option<String>,
) -> AppResult<TokenIdentity> {
    tauri::async_runtime::spawn_blocking(move || -> AppResult<TokenIdentity> {
        let token = match token {
            Some(t) if !t.trim().is_empty() => t.trim().to_string(),
            _ => get_token(&host)?
                .ok_or_else(|| AppError::Auth(format!("no token saved for {host}")))?,
        };
        match host.as_str() {
            "github.com" => validate_github_token(&token),
            _ => Err(AppError::Other(format!("unknown provider host: {host}"))),
        }
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}
