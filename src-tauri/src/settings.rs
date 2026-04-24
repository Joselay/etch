use keyring::Entry;

use crate::error::{AppError, AppResult};

const SERVICE: &str = "com.menglay.loom";

fn entry_for(host: &str) -> AppResult<Entry> {
    Entry::new(SERVICE, &format!("token:{host}"))
        .map_err(|e| AppError::Other(format!("keyring: {e}")))
}

pub fn get_token(host: &str) -> AppResult<Option<String>> {
    let entry = entry_for(host)?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Other(format!("keyring: {e}"))),
    }
}

pub fn set_token(host: &str, token: &str) -> AppResult<()> {
    entry_for(host)?
        .set_password(token)
        .map_err(|e| AppError::Other(format!("keyring: {e}")))
}

pub fn clear_token(host: &str) -> AppResult<()> {
    let entry = entry_for(host)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Other(format!("keyring: {e}"))),
    }
}

pub fn known_hosts() -> &'static [ProviderHost] {
    &[ProviderHost {
        host: "github.com",
        label: "GitHub",
        token_help_url: "https://github.com/settings/tokens/new?scopes=repo&description=Loom",
    }]
}

#[derive(Debug, Clone, Copy)]
pub struct ProviderHost {
    pub host: &'static str,
    pub label: &'static str,
    pub token_help_url: &'static str,
}
