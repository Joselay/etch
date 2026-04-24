use std::path::Path;

use crate::error::AppResult;
use crate::git::cli::run_git;

pub fn create_branch(repo: &Path, name: &str, start_point: Option<&str>) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["branch", "--", name];
    if let Some(sp) = start_point {
        args.push(sp);
    }
    run_git(repo, &args)?;
    Ok(())
}

pub fn checkout(repo: &Path, target: &str, create: bool) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["checkout"];
    if create {
        args.push("-b");
    }
    args.push(target);
    run_git(repo, &args)?;
    Ok(())
}

pub fn checkout_tracking(repo: &Path, local_name: &str, upstream: &str) -> AppResult<()> {
    run_git(repo, &["checkout", "-b", local_name, "--track", upstream])?;
    Ok(())
}

pub fn delete_branch(repo: &Path, name: &str, force: bool) -> AppResult<()> {
    let flag = if force { "-D" } else { "-d" };
    run_git(repo, &["branch", flag, "--", name])?;
    Ok(())
}

pub fn rename_branch(repo: &Path, old: &str, new: &str, force: bool) -> AppResult<()> {
    let flag = if force { "-M" } else { "-m" };
    run_git(repo, &["branch", flag, old, new])?;
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

    fn current_branch(repo: &Path) -> String {
        let out = run_git(repo, &["rev-parse", "--abbrev-ref", "HEAD"]).unwrap();
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    #[test]
    fn create_checkout_rename_delete_roundtrip() {
        let tmp = init_tmp_repo();
        let p = tmp.path();

        create_branch(p, "feature", None).unwrap();
        checkout(p, "feature", false).unwrap();
        assert_eq!(current_branch(p), "feature");

        rename_branch(p, "feature", "feature-renamed", false).unwrap();
        assert_eq!(current_branch(p), "feature-renamed");

        checkout(p, "main", false).unwrap();
        delete_branch(p, "feature-renamed", false).unwrap();
    }

    #[test]
    fn checkout_create_shorthand() {
        let tmp = init_tmp_repo();
        checkout(tmp.path(), "topic", true).unwrap();
        assert_eq!(current_branch(tmp.path()), "topic");
    }

    #[test]
    fn delete_unmerged_requires_force() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        checkout(p, "side", true).unwrap();
        fs::write(p.join("b.txt"), "x\n").unwrap();
        run_git(p, &["add", "b.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "side"]).unwrap();
        checkout(p, "main", false).unwrap();

        assert!(delete_branch(p, "side", false).is_err());
        delete_branch(p, "side", true).unwrap();
    }
}
