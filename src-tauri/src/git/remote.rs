use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::{run_git, run_git_cancellable};

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

pub fn fetch_cancellable(
    repo: &Path,
    remote: Option<&str>,
    prune: bool,
    cancel: Option<Arc<AtomicBool>>,
) -> AppResult<()> {
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
    if let Some(flag) = cancel {
        run_git_cancellable(repo, &args, flag)?;
    } else {
        run_git(repo, &args)?;
    }
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
    pub push_url: Option<String>,
}

pub fn list_remotes(repo: &Path) -> AppResult<Vec<RemoteInfo>> {
    // `git remote -v` prints two lines per remote: `<name>\t<url> (fetch|push)`.
    // We collapse them; when fetch == push, `push_url` is None.
    let out = run_git(repo, &["remote", "-v"])?;
    let text = String::from_utf8_lossy(&out.stdout);
    let mut map: std::collections::BTreeMap<String, (Option<String>, Option<String>)> =
        std::collections::BTreeMap::new();
    for line in text.lines() {
        let mut cols = line.splitn(2, '\t');
        let name = cols.next().unwrap_or("").to_string();
        let rest = cols.next().unwrap_or("");
        // rest: "<url> (fetch)" or "<url> (push)"
        let (url, kind) = match rest.rsplit_once(' ') {
            Some((u, k)) => (u.to_string(), k.trim_matches(|c| c == '(' || c == ')')),
            None => (rest.to_string(), ""),
        };
        let entry = map.entry(name).or_default();
        if kind == "push" {
            entry.1 = Some(url);
        } else {
            entry.0 = Some(url);
        }
    }
    let mut remotes = Vec::new();
    for (name, (fetch, push)) in map {
        let url = fetch.clone().or(push.clone()).unwrap_or_default();
        let push_url = match (&fetch, &push) {
            (Some(f), Some(p)) if f != p => Some(p.clone()),
            _ => None,
        };
        remotes.push(RemoteInfo {
            name,
            url,
            push_url,
        });
    }
    Ok(remotes)
}

pub fn add_remote(repo: &Path, name: &str, url: &str) -> AppResult<()> {
    validate_ref_arg(name, "remote")?;
    if url.is_empty() || url.starts_with('-') {
        return Err(AppError::Other(format!("invalid URL: {url}")));
    }
    run_git(repo, &["remote", "add", "--", name, url])?;
    Ok(())
}

pub fn remove_remote(repo: &Path, name: &str) -> AppResult<()> {
    validate_ref_arg(name, "remote")?;
    run_git(repo, &["remote", "remove", "--", name])?;
    Ok(())
}

pub fn rename_remote(repo: &Path, old: &str, new: &str) -> AppResult<()> {
    validate_ref_arg(old, "remote")?;
    validate_ref_arg(new, "remote")?;
    run_git(repo, &["remote", "rename", "--", old, new])?;
    Ok(())
}

pub fn set_remote_url(repo: &Path, name: &str, url: &str, push: bool) -> AppResult<()> {
    validate_ref_arg(name, "remote")?;
    if url.is_empty() || url.starts_with('-') {
        return Err(AppError::Other(format!("invalid URL: {url}")));
    }
    let mut args: Vec<&str> = vec!["remote", "set-url"];
    if push {
        args.push("--push");
    }
    args.push("--");
    args.push(name);
    args.push(url);
    run_git(repo, &args)?;
    Ok(())
}

pub fn set_upstream(repo: &Path, branch: &str, remote: &str, remote_branch: &str) -> AppResult<()> {
    validate_ref_arg(branch, "branch")?;
    validate_ref_arg(remote, "remote")?;
    validate_ref_arg(remote_branch, "branch")?;
    let upstream = format!("{remote}/{remote_branch}");
    run_git(
        repo,
        &["branch", "--set-upstream-to", &upstream, "--", branch],
    )?;
    Ok(())
}

pub fn unset_upstream(repo: &Path, branch: &str) -> AppResult<()> {
    validate_ref_arg(branch, "branch")?;
    run_git(repo, &["branch", "--unset-upstream", "--", branch])?;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn init_tmp_repo() -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        run_git(tmp.path(), &["init", "-q", "-b", "main"]).unwrap();
        tmp
    }

    #[test]
    fn add_list_rename_remove_cycle() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        add_remote(p, "origin", "https://example.com/a.git").unwrap();
        add_remote(p, "fork", "https://example.com/b.git").unwrap();
        let remotes = list_remotes(p).unwrap();
        assert_eq!(remotes.len(), 2);
        assert!(remotes.iter().any(|r| r.name == "origin"));

        rename_remote(p, "fork", "upstream").unwrap();
        let names: Vec<_> = list_remotes(p).unwrap().into_iter().map(|r| r.name).collect();
        assert!(names.contains(&"upstream".to_string()));
        assert!(!names.contains(&"fork".to_string()));

        set_remote_url(p, "origin", "https://example.com/c.git", false).unwrap();
        let origin = list_remotes(p)
            .unwrap()
            .into_iter()
            .find(|r| r.name == "origin")
            .unwrap();
        assert_eq!(origin.url, "https://example.com/c.git");

        remove_remote(p, "origin").unwrap();
        assert_eq!(list_remotes(p).unwrap().len(), 1);
    }

    #[test]
    fn remote_ops_reject_flag_injection() {
        let tmp = init_tmp_repo();
        assert!(add_remote(tmp.path(), "--evil", "https://x").is_err());
        assert!(add_remote(tmp.path(), "origin", "--upload-pack=x").is_err());
        assert!(rename_remote(tmp.path(), "--evil", "origin").is_err());
    }
}
