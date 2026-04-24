use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

fn validate_ref_like(s: &str, kind: &str) -> AppResult<()> {
    if s.is_empty() {
        return Err(AppError::Other(format!("{kind} must not be empty")));
    }
    if s.starts_with('-') {
        return Err(AppError::Other(format!("invalid {kind}: {s}")));
    }
    let ok = s
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '/'));
    if !ok {
        return Err(AppError::Other(format!("invalid {kind}: {s}")));
    }
    Ok(())
}

/// Create a lightweight (message=None) or annotated tag. When `target` is
/// None, tags the current HEAD.
pub fn create_tag(
    repo: &Path,
    name: &str,
    message: Option<&str>,
    target: Option<&str>,
    force: bool,
) -> AppResult<()> {
    validate_ref_like(name, "tag")?;
    if let Some(t) = target {
        validate_ref_like(t, "target")?;
    }
    let mut args: Vec<&str> = vec!["tag"];
    if force {
        args.push("-f");
    }
    if let Some(m) = message {
        let trimmed = m.trim();
        if !trimmed.is_empty() {
            args.push("-a");
            args.push("-m");
            args.push(trimmed);
        }
    }
    args.push("--");
    args.push(name);
    if let Some(t) = target {
        args.push(t);
    }
    run_git(repo, &args)?;
    Ok(())
}

pub fn delete_tag(repo: &Path, name: &str) -> AppResult<()> {
    validate_ref_like(name, "tag")?;
    run_git(repo, &["tag", "-d", "--", name])?;
    Ok(())
}

/// Push a tag to a remote. If `delete` is true, removes the tag on the remote.
pub fn push_tag(repo: &Path, remote: &str, name: &str, delete: bool) -> AppResult<()> {
    validate_ref_like(remote, "remote")?;
    validate_ref_like(name, "tag")?;
    let refspec = if delete {
        format!(":refs/tags/{name}")
    } else {
        format!("refs/tags/{name}")
    };
    run_git(repo, &["push", "--", remote, &refspec])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn init_tmp_repo() -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        run_git(tmp.path(), &["init", "-q", "-b", "main"]).unwrap();
        run_git(tmp.path(), &["config", "user.email", "t@t.com"]).unwrap();
        run_git(tmp.path(), &["config", "user.name", "t"]).unwrap();
        run_git(tmp.path(), &["config", "commit.gpgsign", "false"]).unwrap();
        fs::write(tmp.path().join("a.txt"), "hello\n").unwrap();
        run_git(tmp.path(), &["add", "a.txt"]).unwrap();
        run_git(tmp.path(), &["commit", "-q", "-m", "init"]).unwrap();
        tmp
    }

    #[test]
    fn create_lightweight_and_delete() {
        let tmp = init_tmp_repo();
        create_tag(tmp.path(), "v0.1.0", None, None, false).unwrap();
        let out = run_git(tmp.path(), &["tag", "--list"]).unwrap();
        assert!(String::from_utf8_lossy(&out.stdout).contains("v0.1.0"));
        delete_tag(tmp.path(), "v0.1.0").unwrap();
        let out = run_git(tmp.path(), &["tag", "--list"]).unwrap();
        assert!(!String::from_utf8_lossy(&out.stdout).contains("v0.1.0"));
    }

    #[test]
    fn create_annotated() {
        let tmp = init_tmp_repo();
        create_tag(tmp.path(), "v0.2.0", Some("release"), None, false).unwrap();
        let out = run_git(tmp.path(), &["cat-file", "-t", "v0.2.0"]).unwrap();
        assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), "tag");
    }

    #[test]
    fn rejects_flagish_names() {
        let tmp = init_tmp_repo();
        assert!(create_tag(tmp.path(), "--force-evil", None, None, false).is_err());
        assert!(delete_tag(tmp.path(), "--exec=x").is_err());
    }
}
