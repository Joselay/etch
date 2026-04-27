use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::{run_git, run_git_bare};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigEntry {
    pub key: String,
    pub value: String,
}

fn validate_key(key: &str) -> AppResult<()> {
    if key.is_empty() {
        return Err(AppError::Other("config key must not be empty".into()));
    }
    if key.starts_with('-') {
        return Err(AppError::Other(format!("invalid config key: {key}")));
    }
    let ok = key
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'));
    if !ok {
        return Err(AppError::Other(format!("invalid config key: {key}")));
    }
    Ok(())
}

pub fn read_config(repo: Option<&Path>, key: &str, global: bool) -> AppResult<Option<String>> {
    validate_key(key)?;
    let mut args: Vec<&str> = vec!["config"];
    if global {
        args.push("--global");
    }
    args.push("--get");
    args.push(key);
    let result = if global {
        run_git_bare(&args)
    } else if let Some(p) = repo {
        run_git(p, &args)
    } else {
        return Err(AppError::Other(
            "repo path required when global=false".into(),
        ));
    };
    match result {
        Ok(out) => {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if s.is_empty() {
                Ok(None)
            } else {
                Ok(Some(s))
            }
        }
        // git config --get returns 1 when key is missing — treat as None.
        Err(AppError::Git(_)) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Keys Etch is allowed to write through `write_config`. Anything that git
/// resolves to an executable or shell snippet (`core.editor`, `core.pager`,
/// `credential.helper`, `*.textconv`, `*.smudge`, `gpg.program`, ...) is
/// deliberately excluded — a UI-driven write to those would be a persistent
/// code-execution vector if anything ever reached this command with attacker
/// input. Add to this list cautiously and only after confirming the value
/// space cannot trigger code execution.
const WRITABLE_CONFIG_KEYS: &[&str] = &[
    // Signing — surfaced by the settings UI.
    "commit.gpgsign",
    "tag.gpgsign",
    "push.gpgsign",
    "user.signingkey",
    "gpg.format",
    // Line-ending normalization — read-only today, but safe value space.
    "core.autocrlf",
    "core.eol",
    "core.safecrlf",
];

fn ensure_writable(key: &str) -> AppResult<()> {
    if WRITABLE_CONFIG_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(AppError::Other(format!(
            "config key not writable from the app: {key}"
        )))
    }
}

pub fn write_config(repo: Option<&Path>, key: &str, value: &str, global: bool) -> AppResult<()> {
    validate_key(key)?;
    ensure_writable(key)?;
    if value.starts_with('-') {
        return Err(AppError::Other(format!("invalid value: {value}")));
    }
    // Defense-in-depth: even within the allowlist, refuse values containing
    // control characters that could embed extra config lines or break parsing.
    if value.chars().any(|c| c == '\0' || c == '\n' || c == '\r') {
        return Err(AppError::Other("invalid value: control character".into()));
    }
    let mut args: Vec<&str> = vec!["config"];
    if global {
        args.push("--global");
    }
    args.push("--");
    args.push(key);
    args.push(value);
    if global {
        run_git_bare(&args)?;
    } else if let Some(p) = repo {
        run_git(p, &args)?;
    } else {
        return Err(AppError::Other(
            "repo path required when global=false".into(),
        ));
    }
    Ok(())
}

pub fn unset_config(repo: Option<&Path>, key: &str, global: bool) -> AppResult<()> {
    validate_key(key)?;
    ensure_writable(key)?;
    let mut args: Vec<&str> = vec!["config"];
    if global {
        args.push("--global");
    }
    args.push("--unset");
    args.push("--");
    args.push(key);
    let result = if global {
        run_git_bare(&args)
    } else if let Some(p) = repo {
        run_git(p, &args)
    } else {
        return Err(AppError::Other(
            "repo path required when global=false".into(),
        ));
    };
    // git config --unset returns 5 when the key is already missing; we treat
    // that as success.
    match result {
        Ok(_) => Ok(()),
        Err(AppError::Git(_)) => Ok(()),
        Err(e) => Err(e),
    }
}

pub fn list_config(repo: Option<&Path>, global: bool) -> AppResult<Vec<ConfigEntry>> {
    let mut args: Vec<&str> = vec!["config", "--list", "-z"];
    if global {
        args.push("--global");
    }
    let out = if global {
        run_git_bare(&args)?
    } else if let Some(p) = repo {
        run_git(p, &args)?
    } else {
        return Err(AppError::Other(
            "repo path required when global=false".into(),
        ));
    };
    // -z separates entries with NUL; key and value within each are separated
    // by newline.
    let text = String::from_utf8_lossy(&out.stdout);
    let mut entries = Vec::new();
    for record in text.split('\0') {
        if record.is_empty() {
            continue;
        }
        let mut parts = record.splitn(2, '\n');
        let key = parts.next().unwrap_or("").to_string();
        let value = parts.next().unwrap_or("").to_string();
        if key.is_empty() {
            continue;
        }
        entries.push(ConfigEntry { key, value });
    }
    Ok(entries)
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CrlfConfig {
    pub autocrlf: Option<String>,
    pub eol: Option<String>,
    pub safecrlf: Option<String>,
}

pub fn read_crlf_config(repo: &Path) -> AppResult<CrlfConfig> {
    Ok(CrlfConfig {
        autocrlf: read_config(Some(repo), "core.autocrlf", false)?,
        eol: read_config(Some(repo), "core.eol", false)?,
        safecrlf: read_config(Some(repo), "core.safecrlf", false)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn init_tmp_repo() -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        run_git(tmp.path(), &["init", "-q", "-b", "main"]).unwrap();
        tmp
    }

    #[test]
    fn write_config_rejects_dangerous_keys() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        for key in [
            "core.editor",
            "core.pager",
            "core.sshCommand",
            "credential.helper",
            "gpg.program",
            "diff.external",
            "filter.foo.smudge",
            "filter.foo.clean",
            "diff.foo.textconv",
        ] {
            let err = write_config(Some(p), key, "evil", false).unwrap_err();
            assert!(
                format!("{err}").contains("not writable"),
                "expected rejection for {key}, got: {err}"
            );
        }
    }

    #[test]
    fn write_config_allows_signing_keys() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        write_config(Some(p), "commit.gpgsign", "true", false).unwrap();
        write_config(Some(p), "gpg.format", "ssh", false).unwrap();
        write_config(Some(p), "user.signingkey", "ABCD1234", false).unwrap();
    }

    #[test]
    fn write_config_rejects_control_chars_in_value() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        let err = write_config(Some(p), "user.signingkey", "ok\nextra=evil", false).unwrap_err();
        assert!(format!("{err}").contains("control character"));
        let err = write_config(Some(p), "user.signingkey", "ok\0evil", false).unwrap_err();
        assert!(format!("{err}").contains("control character"));
    }

    #[test]
    fn unset_config_rejects_dangerous_keys() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        let err = unset_config(Some(p), "core.editor", false).unwrap_err();
        assert!(format!("{err}").contains("not writable"));
    }
}
