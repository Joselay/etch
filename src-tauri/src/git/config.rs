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

pub fn write_config(repo: Option<&Path>, key: &str, value: &str, global: bool) -> AppResult<()> {
    validate_key(key)?;
    if value.starts_with('-') {
        return Err(AppError::Other(format!("invalid value: {value}")));
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
