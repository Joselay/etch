use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::{run_git_bare, run_git_bare_cancellable};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub path: String,
    pub head_ref: Option<String>,
    pub head_commit_id: Option<String>,
    pub is_detached: bool,
}

pub fn open_repo(path: &Path) -> AppResult<RepoInfo> {
    let repo = gix::open(path).map_err(|e| match e {
        gix::open::Error::NotARepository { .. } => {
            AppError::RepoNotFound(path.display().to_string())
        }
        other => AppError::Git(other.to_string()),
    })?;

    let work_dir = repo
        .work_dir()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| repo.git_dir().to_path_buf());

    let head = repo.head().map_err(|e| AppError::Git(e.to_string()))?;
    let is_detached = matches!(head.kind, gix::head::Kind::Detached { .. });

    let head_ref = match &head.kind {
        gix::head::Kind::Symbolic(r) => Some(r.name.as_bstr().to_string()),
        gix::head::Kind::Unborn(name) => Some(name.as_bstr().to_string()),
        gix::head::Kind::Detached { .. } => None,
    };

    let head_commit_id = match &head.kind {
        gix::head::Kind::Detached { target, .. } => Some(target.to_string()),
        gix::head::Kind::Symbolic(r) => r.target.try_id().map(|id| id.to_string()),
        gix::head::Kind::Unborn(_) => None,
    };

    Ok(RepoInfo {
        path: work_dir.display().to_string(),
        head_ref,
        head_commit_id,
        is_detached,
    })
}

/// Initialize a new git repo at `path`. Creates the directory if it does not
/// already exist. Uses `main` as the initial branch.
pub fn init_repo(path: &Path) -> AppResult<PathBuf> {
    std::fs::create_dir_all(path)?;
    // Run `git init` inside the directory we just created, so a path starting
    // with `-` can't be misread as a flag.
    let out = std::process::Command::new("git")
        .current_dir(path)
        .args(["init", "-b", "main"])
        .output()
        .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(AppError::Git(if stderr.is_empty() {
            format!("git init failed with status {}", out.status)
        } else {
            stderr
        }));
    }
    Ok(path.to_path_buf())
}

/// Clone `url` into `dest` (which must not already exist as a non-empty dir).
/// Returns the resulting working directory path.
pub fn clone_repo_cancellable(
    url: &str,
    dest: &Path,
    cancel: Option<Arc<AtomicBool>>,
) -> AppResult<PathBuf> {
    if url.trim().is_empty() {
        return Err(AppError::Other("clone URL must not be empty".into()));
    }
    if url.starts_with('-') {
        return Err(AppError::Other(format!("invalid clone URL: {url}")));
    }
    if let Some(parent) = dest.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let dest_str = dest
        .to_str()
        .ok_or_else(|| AppError::Other("destination path is not valid UTF-8".into()))?;
    let args = ["clone", "--progress", "--", url, dest_str];
    if let Some(flag) = cancel {
        run_git_bare_cancellable(&args, flag)?;
    } else {
        run_git_bare(&args)?;
    }
    Ok(dest.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_this_repo() {
        let here = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace dir");
        let info = open_repo(here).expect("open");
        assert!(info.head_commit_id.is_some() || info.head_ref.is_some());
    }

    #[test]
    fn rejects_non_repo() {
        let tmp = tempfile::tempdir().unwrap();
        let err = open_repo(tmp.path()).unwrap_err();
        assert!(matches!(err, AppError::RepoNotFound(_)));
    }

    #[test]
    fn init_creates_repo() {
        let tmp = tempfile::tempdir().unwrap();
        let target = tmp.path().join("new");
        init_repo(&target).unwrap();
        let info = open_repo(&target).unwrap();
        assert_eq!(info.head_ref.as_deref(), Some("refs/heads/main"));
    }

    #[test]
    fn clone_rejects_flag_like_url() {
        let tmp = tempfile::tempdir().unwrap();
        let err =
            clone_repo_cancellable("--upload-pack=evil", &tmp.path().join("x"), None).unwrap_err();
        assert!(matches!(err, AppError::Other(_)));
    }

    #[test]
    fn clone_local_repo() {
        // Set up a source repo and clone it through our function.
        let src = tempfile::tempdir().unwrap();
        crate::git::cli::run_git(src.path(), &["init", "-q", "-b", "main"]).unwrap();
        crate::git::cli::run_git(src.path(), &["config", "user.email", "t@t.com"]).unwrap();
        crate::git::cli::run_git(src.path(), &["config", "user.name", "t"]).unwrap();
        crate::git::cli::run_git(src.path(), &["config", "commit.gpgsign", "false"]).unwrap();
        std::fs::write(src.path().join("a.txt"), "hi\n").unwrap();
        crate::git::cli::run_git(src.path(), &["add", "a.txt"]).unwrap();
        crate::git::cli::run_git(src.path(), &["commit", "-q", "-m", "init"]).unwrap();

        let dst_parent = tempfile::tempdir().unwrap();
        let dst = dst_parent.path().join("cloned");
        clone_repo_cancellable(src.path().to_str().unwrap(), &dst, None).unwrap();
        assert!(dst.join(".git").exists());
    }
}
