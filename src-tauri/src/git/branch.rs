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

fn validate_commit_ish(s: &str) -> AppResult<()> {
    // Allow short & full hex SHAs, branch names, tag names — same character set
    // as ref names, which covers all of the above.
    validate_ref_like(s, "commit-ish")
}

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

pub fn merge(repo: &Path, target: &str, no_ff: bool) -> AppResult<()> {
    validate_commit_ish(target)?;
    let mut args: Vec<&str> = vec!["merge"];
    if no_ff {
        args.push("--no-ff");
    }
    args.push("--");
    args.push(target);
    run_git(repo, &args)?;
    Ok(())
}

pub fn revert(repo: &Path, commit: &str, no_edit: bool) -> AppResult<()> {
    validate_commit_ish(commit)?;
    let mut args: Vec<&str> = vec!["revert"];
    if no_edit {
        args.push("--no-edit");
    }
    args.push("--");
    args.push(commit);
    run_git(repo, &args)?;
    Ok(())
}

pub fn cherry_pick(repo: &Path, commit: &str) -> AppResult<()> {
    validate_commit_ish(commit)?;
    run_git(repo, &["cherry-pick", "--", commit])?;
    Ok(())
}

pub fn abort_merge(repo: &Path) -> AppResult<()> {
    run_git(repo, &["merge", "--abort"])?;
    Ok(())
}

pub fn abort_revert(repo: &Path) -> AppResult<()> {
    run_git(repo, &["revert", "--abort"])?;
    Ok(())
}

pub fn abort_cherry_pick(repo: &Path) -> AppResult<()> {
    run_git(repo, &["cherry-pick", "--abort"])?;
    Ok(())
}

#[derive(Debug, Clone, Copy)]
pub enum ResetMode {
    Soft,
    Mixed,
    Hard,
}

impl ResetMode {
    fn flag(self) -> &'static str {
        match self {
            ResetMode::Soft => "--soft",
            ResetMode::Mixed => "--mixed",
            ResetMode::Hard => "--hard",
        }
    }
}

pub fn reset(repo: &Path, target: &str, mode: ResetMode) -> AppResult<()> {
    // `git reset --hard -- <ref>` is rejected ("Cannot do hard reset with paths");
    // git wants the ref as the treeish positional. `validate_commit_ish` above
    // already blocks flag-like input, so dropping `--` is safe.
    validate_commit_ish(target)?;
    run_git(repo, &["reset", mode.flag(), target])?;
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
    fn merge_fast_forward() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        checkout(p, "topic", true).unwrap();
        fs::write(p.join("b.txt"), "x\n").unwrap();
        run_git(p, &["add", "b.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "topic"]).unwrap();
        checkout(p, "main", false).unwrap();
        merge(p, "topic", false).unwrap();
        assert_eq!(current_branch(p), "main");
        assert!(p.join("b.txt").exists());
    }

    #[test]
    fn revert_reverses_a_commit() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        fs::write(p.join("b.txt"), "added\n").unwrap();
        run_git(p, &["add", "b.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "add b"]).unwrap();
        let head = String::from_utf8_lossy(&run_git(p, &["rev-parse", "HEAD"]).unwrap().stdout)
            .trim()
            .to_string();
        revert(p, &head, true).unwrap();
        assert!(!p.join("b.txt").exists());
    }

    #[test]
    fn cherry_pick_moves_commit() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        checkout(p, "topic", true).unwrap();
        fs::write(p.join("b.txt"), "from topic\n").unwrap();
        run_git(p, &["add", "b.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "add b"]).unwrap();
        let topic_commit = String::from_utf8_lossy(
            &run_git(p, &["rev-parse", "HEAD"]).unwrap().stdout,
        )
        .trim()
        .to_string();
        checkout(p, "main", false).unwrap();
        cherry_pick(p, &topic_commit).unwrap();
        assert!(p.join("b.txt").exists());
    }

    #[test]
    fn reset_hard_moves_head() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        let first = String::from_utf8_lossy(&run_git(p, &["rev-parse", "HEAD"]).unwrap().stdout)
            .trim()
            .to_string();
        fs::write(p.join("b.txt"), "more\n").unwrap();
        run_git(p, &["add", "b.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "more"]).unwrap();

        reset(p, &first, ResetMode::Hard).unwrap();
        let now = String::from_utf8_lossy(&run_git(p, &["rev-parse", "HEAD"]).unwrap().stdout)
            .trim()
            .to_string();
        assert_eq!(now, first);
        assert!(!p.join("b.txt").exists());
    }

    #[test]
    fn rejects_flag_injection() {
        let tmp = init_tmp_repo();
        assert!(merge(tmp.path(), "--exec=evil", false).is_err());
        assert!(revert(tmp.path(), "--reset", true).is_err());
        assert!(cherry_pick(tmp.path(), "--abort").is_err());
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
