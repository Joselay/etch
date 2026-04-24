use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

// Reject remote/branch names that could be interpreted as git flags
// (e.g. `--upload-pack=evil`) or contain shell/path separators beyond
// what git's own refname rules allow.
fn validate_ref_arg(name: &str, kind: &str) -> AppResult<()> {
    if name.is_empty() {
        return Err(AppError::Other(format!("{kind} must not be empty")));
    }
    if name.starts_with('-') {
        return Err(AppError::Other(format!("invalid {kind}: {name}")));
    }
    let ok = name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '/'));
    if !ok {
        return Err(AppError::Other(format!("invalid {kind}: {name}")));
    }
    Ok(())
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpstreamStatus {
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub detached: bool,
}

pub fn upstream_status(repo: &Path) -> AppResult<UpstreamStatus> {
    let out = run_git(repo, &["status", "--porcelain=v2", "--branch"])?;
    let text = String::from_utf8_lossy(&out.stdout);
    let mut s = UpstreamStatus::default();
    for line in text.lines() {
        let Some(rest) = line.strip_prefix("# ") else {
            continue;
        };
        if let Some(v) = rest.strip_prefix("branch.head ") {
            if v == "(detached)" {
                s.detached = true;
            } else {
                s.branch = Some(v.to_string());
            }
        } else if let Some(v) = rest.strip_prefix("branch.upstream ") {
            s.upstream = Some(v.to_string());
        } else if let Some(v) = rest.strip_prefix("branch.ab ") {
            // format: "+N -M"
            let mut it = v.split_whitespace();
            if let Some(a) = it.next() {
                s.ahead = a.trim_start_matches('+').parse().unwrap_or(0);
            }
            if let Some(b) = it.next() {
                s.behind = b.trim_start_matches('-').parse().unwrap_or(0);
            }
        }
    }
    Ok(s)
}

pub fn fetch(repo: &Path, remote: Option<&str>, prune: bool) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["fetch"];
    if prune {
        args.push("--prune");
    }
    if let Some(r) = remote {
        validate_ref_arg(r, "remote")?;
        args.push("--");
        args.push(r);
    } else {
        args.push("--all");
    }
    run_git(repo, &args)?;
    Ok(())
}

pub fn pull(repo: &Path, ff_only: bool) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["pull"];
    if ff_only {
        args.push("--ff-only");
    }
    run_git(repo, &args)?;
    Ok(())
}

pub fn push(
    repo: &Path,
    remote: Option<&str>,
    branch: Option<&str>,
    set_upstream: bool,
    force_with_lease: bool,
) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["push"];
    if set_upstream {
        args.push("--set-upstream");
    }
    if force_with_lease {
        args.push("--force-with-lease");
    }
    if let Some(r) = remote {
        validate_ref_arg(r, "remote")?;
        args.push("--");
        args.push(r);
        if let Some(b) = branch {
            validate_ref_arg(b, "branch")?;
            args.push(b);
        }
    }
    run_git(repo, &args)?;
    Ok(())
}
