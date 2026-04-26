use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub path: String,
    pub head_oid: Option<String>,
    pub branch: Option<String>,
    pub is_main: bool,
    pub is_locked: bool,
    pub is_detached: bool,
}

pub fn list_worktrees(repo: &Path) -> AppResult<Vec<WorktreeInfo>> {
    let out = run_git(repo, &["worktree", "list", "--porcelain"])?;
    let text = String::from_utf8_lossy(&out.stdout);
    let mut result = Vec::new();
    let mut current: Option<WorktreeInfo> = None;
    let mut first = true;
    for line in text.lines() {
        if line.is_empty() {
            if let Some(w) = current.take() {
                result.push(w);
            }
            continue;
        }
        if let Some(rest) = line.strip_prefix("worktree ") {
            if let Some(prev) = current.take() {
                result.push(prev);
            }
            current = Some(WorktreeInfo {
                path: rest.to_string(),
                head_oid: None,
                branch: None,
                is_main: first,
                is_locked: false,
                is_detached: false,
            });
            first = false;
        } else if let Some(w) = current.as_mut() {
            if let Some(rest) = line.strip_prefix("HEAD ") {
                w.head_oid = Some(rest.to_string());
            } else if let Some(rest) = line.strip_prefix("branch ") {
                w.branch = Some(rest.to_string());
            } else if line == "detached" {
                w.is_detached = true;
            } else if line.starts_with("locked") {
                w.is_locked = true;
            }
        }
    }
    if let Some(w) = current.take() {
        result.push(w);
    }
    Ok(result)
}

fn validate(s: &str, kind: &str) -> AppResult<()> {
    if s.is_empty() {
        return Err(AppError::Other(format!("{kind} must not be empty")));
    }
    if s.starts_with('-') {
        return Err(AppError::Other(format!("invalid {kind}: {s}")));
    }
    Ok(())
}

pub fn add_worktree(repo: &Path, path: &str, branch: Option<&str>, create: bool) -> AppResult<()> {
    validate(path, "path")?;
    let mut args: Vec<&str> = vec!["worktree", "add"];
    if create {
        args.push("-b");
        if let Some(b) = branch {
            validate(b, "branch")?;
            args.push(b);
        } else {
            return Err(AppError::Other("branch required when create=true".into()));
        }
    }
    args.push("--");
    args.push(path);
    if !create {
        if let Some(b) = branch {
            validate(b, "branch")?;
            args.push(b);
        }
    }
    run_git(repo, &args)?;
    Ok(())
}

pub fn remove_worktree(repo: &Path, path: &str, force: bool) -> AppResult<()> {
    validate(path, "path")?;
    let mut args: Vec<&str> = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push("--");
    args.push(path);
    run_git(repo, &args)?;
    Ok(())
}

pub fn prune_worktrees(repo: &Path) -> AppResult<()> {
    run_git(repo, &["worktree", "prune"])?;
    Ok(())
}
