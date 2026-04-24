use serde::Serialize;

use crate::error::AppResult;
use crate::settings::{clear_token, get_token, known_hosts, set_token};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderToken {
    pub host: String,
    pub label: String,
    pub token_help_url: String,
    pub has_token: bool,
}

#[tauri::command]
pub fn cmd_list_provider_tokens() -> AppResult<Vec<ProviderToken>> {
    let mut out = Vec::new();
    for p in known_hosts() {
        let has_token = get_token(p.host)?.is_some();
        out.push(ProviderToken {
            host: p.host.to_string(),
            label: p.label.to_string(),
            token_help_url: p.token_help_url.to_string(),
            has_token,
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn cmd_set_provider_token(host: String, token: String) -> AppResult<()> {
    set_token(&host, &token)
}

#[tauri::command]
pub fn cmd_clear_provider_token(host: String) -> AppResult<()> {
    clear_token(&host)
}
