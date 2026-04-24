use std::path::Path;

use serde::Serialize;

use crate::error::AppResult;
use crate::git::cli::run_git;

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

pub fn commit(repo: &Path, message: &str, amend: bool) -> AppResult<CommitResult> {
    let mut args: Vec<&str> = vec!["commit"];
    if amend {
        args.push("--amend");
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
    fn stage_and_commit_roundtrip() {
        let tmp = init_tmp_repo();
        fs::write(tmp.path().join("a.txt"), "hello\n").unwrap();
        stage_paths(tmp.path(), &["a.txt".to_string()]).unwrap();
        let res = commit(tmp.path(), "init", false).unwrap();
        assert_eq!(res.id.len(), 40);

        fs::write(tmp.path().join("a.txt"), "hello\nworld\n").unwrap();
        stage_paths(tmp.path(), &["a.txt".to_string()]).unwrap();
        unstage_paths(tmp.path(), &["a.txt".to_string()]).unwrap();
    }
}
