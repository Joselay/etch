use std::path::Path;

use serde::Serialize;

use crate::error::AppResult;
use crate::git::cli::run_git;

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SigningConfig {
    /// Whether `commit.gpgsign` is true at any scope (repo overrides global).
    pub enabled: bool,
    /// `gpg.format` — typically "openpgp" (default), "ssh", or "x509".
    pub format: Option<String>,
    /// `user.signingkey` — opaque to Etch; format depends on `format`.
    pub key: Option<String>,
}

fn read_config(repo: &Path, key: &str) -> Option<String> {
    // Read from union of repo + global. `git config --get` returns 1 when
    // missing — treat that as None instead of bubbling up.
    let out = run_git(repo, &["config", "--get", key]).ok()?;
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

pub fn read_signing_config(repo: &Path) -> AppResult<SigningConfig> {
    let enabled = read_config(repo, "commit.gpgsign")
        .map(|v| matches!(v.as_str(), "true" | "1" | "yes" | "on"))
        .unwrap_or(false);
    let format = read_config(repo, "gpg.format");
    let key = read_config(repo, "user.signingkey");
    Ok(SigningConfig {
        enabled,
        format,
        key,
    })
}

/// Read `commit.template` (a file path) and return its contents, if both the
/// config key and the file exist.
pub fn read_commit_template(repo: &Path) -> AppResult<Option<String>> {
    let Some(path) = read_config(repo, "commit.template") else {
        return Ok(None);
    };
    let expanded = if let Some(rest) = path.strip_prefix("~/") {
        match std::env::var("HOME") {
            Ok(home) => format!("{home}/{rest}"),
            Err(_) => path.clone(),
        }
    } else {
        path.clone()
    };
    let p = std::path::Path::new(&expanded);
    if !p.is_absolute() {
        // Relative to repo root.
        let abs = repo.join(p);
        if !abs.exists() {
            return Ok(None);
        }
        return Ok(std::fs::read_to_string(&abs).ok());
    }
    if !p.exists() {
        return Ok(None);
    }
    Ok(std::fs::read_to_string(p).ok())
}
