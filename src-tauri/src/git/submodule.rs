use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SubmoduleStatus {
    UpToDate,
    Modified,
    Uninitialized,
    Conflict,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmoduleInfo {
    pub path: String,
    pub current_oid: Option<String>,
    pub describe: Option<String>,
    pub status: SubmoduleStatus,
}

pub fn list_submodules(repo: &Path) -> AppResult<Vec<SubmoduleInfo>> {
    let out = match run_git(repo, &["submodule", "status"]) {
        Ok(o) => o,
        // No submodules → git returns empty stdout; non-repo or no submodules
        // both should yield empty list rather than an error.
        Err(_) => return Ok(Vec::new()),
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let mut result = Vec::new();
    for line in text.lines() {
        if line.is_empty() {
            continue;
        }
        // Format: "<prefix><sha> <path> [(<describe>)]"
        // prefix: ' ' up-to-date, '+' modified, '-' uninitialized, 'U' conflict
        let mut chars = line.chars();
        let prefix = chars.next().unwrap_or(' ');
        let rest: String = chars.collect();
        let mut parts = rest.splitn(3, ' ');
        let oid = parts.next().unwrap_or("").to_string();
        let path = parts.next().unwrap_or("").to_string();
        let describe = parts.next().map(|d| {
            d.trim()
                .trim_start_matches('(')
                .trim_end_matches(')')
                .to_string()
        });
        let status = match prefix {
            ' ' => SubmoduleStatus::UpToDate,
            '+' => SubmoduleStatus::Modified,
            '-' => SubmoduleStatus::Uninitialized,
            'U' => SubmoduleStatus::Conflict,
            _ => SubmoduleStatus::Modified,
        };
        result.push(SubmoduleInfo {
            path,
            current_oid: if oid.is_empty() { None } else { Some(oid) },
            describe,
            status,
        });
    }
    Ok(result)
}

fn validate_path(p: &str) -> AppResult<()> {
    if p.is_empty() {
        return Err(AppError::Other("submodule path must not be empty".into()));
    }
    if p.starts_with('-') {
        return Err(AppError::Other(format!("invalid submodule path: {p}")));
    }
    Ok(())
}

pub fn init_submodule(repo: &Path, path: &str) -> AppResult<()> {
    validate_path(path)?;
    run_git(repo, &["submodule", "init", "--", path])?;
    Ok(())
}

pub fn update_submodule(repo: &Path, path: &str, init: bool) -> AppResult<()> {
    validate_path(path)?;
    let mut args: Vec<&str> = vec!["submodule", "update"];
    if init {
        args.push("--init");
    }
    args.push("--");
    args.push(path);
    run_git(repo, &args)?;
    Ok(())
}

pub fn sync_submodules(repo: &Path) -> AppResult<()> {
    run_git(repo, &["submodule", "sync"])?;
    Ok(())
}
