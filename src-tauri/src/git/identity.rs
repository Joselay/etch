use std::path::Path;
use std::process::Command;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub name: Option<String>,
    pub email: Option<String>,
}

/// Read git identity. `repo` is optional — when supplied, reads the
/// effective value (repo-local override falling back to global).
pub fn read_identity(repo: Option<&Path>) -> AppResult<Identity> {
    Ok(Identity {
        name: read_one(repo, "user.name")?,
        email: read_one(repo, "user.email")?,
    })
}

fn read_one(repo: Option<&Path>, key: &str) -> AppResult<Option<String>> {
    let out = match repo {
        Some(r) => run_git_optional(r, &["config", "--get", key]),
        None => run_git_bare_optional(&["config", "--global", "--get", key]),
    }?;
    Ok(out.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()))
}

/// Treat "not set" (exit 1 with empty stderr) as `Ok(None)` rather than an error.
fn run_git_optional(repo: &Path, args: &[&str]) -> AppResult<Option<String>> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
    if output.status.success() {
        return Ok(Some(String::from_utf8_lossy(&output.stdout).into_owned()));
    }
    if output.status.code() == Some(1) && output.stderr.is_empty() {
        return Ok(None);
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(AppError::Git(if stderr.is_empty() {
        format!("git exited with status {}", output.status)
    } else {
        stderr
    }))
}

fn run_git_bare_optional(args: &[&str]) -> AppResult<Option<String>> {
    let output = Command::new("git")
        .args(args)
        .output()
        .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
    if output.status.success() {
        return Ok(Some(String::from_utf8_lossy(&output.stdout).into_owned()));
    }
    if output.status.code() == Some(1) && output.stderr.is_empty() {
        return Ok(None);
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(AppError::Git(if stderr.is_empty() {
        format!("git exited with status {}", output.status)
    } else {
        stderr
    }))
}

pub fn write_identity(
    repo: Option<&Path>,
    name: Option<&str>,
    email: Option<&str>,
) -> AppResult<()> {
    if let Some(n) = name {
        write_one(repo, "user.name", n.trim())?;
    }
    if let Some(e) = email {
        write_one(repo, "user.email", e.trim())?;
    }
    Ok(())
}

fn write_one(repo: Option<&Path>, key: &str, value: &str) -> AppResult<()> {
    if value.is_empty() {
        // Unset rather than write empty string.
        match repo {
            Some(r) => {
                let output = Command::new("git")
                    .arg("-C")
                    .arg(r)
                    .args(["config", "--unset", key])
                    .output()
                    .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
                // Exit 5 = not set; treat as success.
                if !output.status.success() && output.status.code() != Some(5) {
                    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    return Err(AppError::Git(stderr));
                }
            }
            None => {
                let output = Command::new("git")
                    .args(["config", "--global", "--unset", key])
                    .output()
                    .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
                if !output.status.success() && output.status.code() != Some(5) {
                    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    return Err(AppError::Git(stderr));
                }
            }
        }
        return Ok(());
    }
    match repo {
        Some(r) => {
            run_git(r, &["config", key, value])?;
        }
        None => {
            let output = Command::new("git")
                .args(["config", "--global", key, value])
                .output()
                .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                return Err(AppError::Git(stderr));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_repo() -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        run_git(tmp.path(), &["init", "-q", "-b", "main"]).unwrap();
        tmp
    }

    #[test]
    fn read_and_write_repo_identity() {
        let tmp = tmp_repo();
        write_identity(Some(tmp.path()), Some("Alice"), Some("a@b.c")).unwrap();
        let id = read_identity(Some(tmp.path())).unwrap();
        assert_eq!(id.name.as_deref(), Some("Alice"));
        assert_eq!(id.email.as_deref(), Some("a@b.c"));
    }

    #[test]
    fn empty_value_unsets() {
        let tmp = tmp_repo();
        write_identity(Some(tmp.path()), Some("Alice"), None).unwrap();
        write_identity(Some(tmp.path()), Some(""), None).unwrap();
        // After unset, repo-local lookup should yield None (or fall back to global
        // if the test host has one — read only the local scope).
        let out = run_git_optional(tmp.path(), &["config", "--local", "--get", "user.name"]).unwrap();
        assert!(out.is_none());
    }
}
