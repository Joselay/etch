use std::path::Path;

use serde::Serialize;

use crate::error::AppResult;
use crate::git::cli::{run_git, run_git_stdin};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitResult {
    pub id: String,
}

pub fn stage_paths(repo: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args: Vec<&str> = vec!["add", "--"];
    for p in paths {
        args.push(p);
    }
    run_git(repo, &args)?;
    Ok(())
}

pub fn unstage_paths(repo: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args: Vec<&str> = vec!["reset", "--"];
    for p in paths {
        args.push(p);
    }
    run_git(repo, &args)?;
    Ok(())
}

pub fn discard_paths(repo: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args: Vec<&str> = vec!["checkout", "--"];
    for p in paths {
        args.push(p);
    }
    run_git(repo, &args)?;
    Ok(())
}

pub fn clean_untracked_paths(repo: &Path, paths: &[String]) -> AppResult<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let mut args: Vec<&str> = vec!["clean", "-f", "-d", "--"];
    for p in paths {
        args.push(p);
    }
    run_git(repo, &args)?;
    Ok(())
}

/// Apply a unified diff patch using `git apply`.
///
/// - `cached`: apply to the index (stage). Without, applies to the working tree.
/// - `reverse`: apply in reverse (used to unstage or discard a hunk).
/// - When reversing in the working tree (cached=false, reverse=true), the
///   patch is discarded from the working copy. Destructive — callers should
///   confirm.
pub fn apply_patch(repo: &Path, patch: &str, cached: bool, reverse: bool) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["apply", "--whitespace=nowarn"];
    if cached {
        args.push("--cached");
    }
    if reverse {
        args.push("--reverse");
    }
    args.push("-");
    run_git_stdin(repo, &args, patch.as_bytes())?;
    Ok(())
}

pub fn commit(
    repo: &Path,
    message: &str,
    amend: bool,
    sign_off: bool,
    sign: Option<bool>,
) -> AppResult<CommitResult> {
    let mut args: Vec<&str> = vec!["commit"];
    if amend {
        args.push("--amend");
    }
    if sign_off {
        args.push("--signoff");
    }
    match sign {
        Some(true) => args.push("--gpg-sign"),
        Some(false) => args.push("--no-gpg-sign"),
        None => {}
    }
    args.push("-m");
    args.push(message);
    run_git(repo, &args)?;
    let out = run_git(repo, &["rev-parse", "HEAD"])?;
    let id = String::from_utf8_lossy(&out.stdout).trim().to_string();
    Ok(CommitResult { id })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn init_tmp_repo() -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        run_git(tmp.path(), &["init", "-q"]).unwrap();
        run_git(tmp.path(), &["config", "user.email", "t@t.com"]).unwrap();
        run_git(tmp.path(), &["config", "user.name", "t"]).unwrap();
        run_git(tmp.path(), &["config", "commit.gpgsign", "false"]).unwrap();
        tmp
    }

    #[test]
    fn apply_patch_stages_hunk() {
        let tmp = init_tmp_repo();
        fs::write(tmp.path().join("a.txt"), "1\n2\n3\n").unwrap();
        stage_paths(tmp.path(), &["a.txt".to_string()]).unwrap();
        commit(tmp.path(), "init", false, false, Some(false)).unwrap();

        fs::write(tmp.path().join("a.txt"), "1\n2\n3\n4\n").unwrap();

        let patch = "diff --git a/a.txt b/a.txt\n\
             --- a/a.txt\n\
             +++ b/a.txt\n\
             @@ -1,3 +1,4 @@\n \
            1\n \
            2\n \
            3\n\
             +4\n";

        apply_patch(tmp.path(), patch, true, false).unwrap();
        let out = run_git(tmp.path(), &["diff", "--cached", "--name-only"]).unwrap();
        assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), "a.txt");

        // Reverse from index unstages.
        apply_patch(tmp.path(), patch, true, true).unwrap();
        let out = run_git(tmp.path(), &["diff", "--cached", "--name-only"]).unwrap();
        assert!(out.stdout.is_empty());
    }

    #[test]
    fn stage_and_commit_roundtrip() {
        let tmp = init_tmp_repo();
        fs::write(tmp.path().join("a.txt"), "hello\n").unwrap();
        stage_paths(tmp.path(), &["a.txt".to_string()]).unwrap();
        let res = commit(tmp.path(), "init", false, false, Some(false)).unwrap();
        assert_eq!(res.id.len(), 40);

        fs::write(tmp.path().join("a.txt"), "hello\nworld\n").unwrap();
        stage_paths(tmp.path(), &["a.txt".to_string()]).unwrap();
        unstage_paths(tmp.path(), &["a.txt".to_string()]).unwrap();
    }
}
