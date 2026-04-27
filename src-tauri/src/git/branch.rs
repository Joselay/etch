use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;
use crate::git::validate::{validate_commit_ish, validate_ref_arg};

pub fn create_branch(repo: &Path, name: &str, start_point: Option<&str>) -> AppResult<()> {
    validate_ref_arg(name, "branch name")?;
    if let Some(sp) = start_point {
        validate_commit_ish(sp)?;
    }
    let mut args: Vec<&str> = vec!["branch", "--", name];
    if let Some(sp) = start_point {
        args.push(sp);
    }
    run_git(repo, &args)?;
    Ok(())
}

pub fn checkout(repo: &Path, target: &str, create: bool) -> AppResult<()> {
    // `git checkout -- <target>` switches to pathspec mode, and
    // `git checkout -b -- <name>` reorders the new-branch name argument.
    // We can't safely insert `--`, so rely on `validate_ref_arg` (which
    // already rejects flag-like names) for injection protection — same
    // approach `reset` uses below.
    validate_ref_arg(target, "target")?;
    let mut args: Vec<&str> = vec!["checkout"];
    if create {
        args.push("-b");
    }
    args.push(target);
    run_git(repo, &args)?;
    Ok(())
}

pub fn checkout_tracking(repo: &Path, local_name: &str, upstream: &str) -> AppResult<()> {
    // Same `--` constraint as `checkout`; use `validate_ref_arg` instead.
    validate_ref_arg(local_name, "branch name")?;
    validate_ref_arg(upstream, "upstream")?;
    run_git(repo, &["checkout", "-b", local_name, "--track", upstream])?;
    Ok(())
}

pub fn delete_branch(repo: &Path, name: &str, force: bool) -> AppResult<()> {
    validate_ref_arg(name, "branch name")?;
    let flag = if force { "-D" } else { "-d" };
    run_git(repo, &["branch", flag, "--", name])?;
    Ok(())
}

pub fn rename_branch(repo: &Path, old: &str, new: &str, force: bool) -> AppResult<()> {
    validate_ref_arg(old, "branch name")?;
    validate_ref_arg(new, "branch name")?;
    let flag = if force { "-M" } else { "-m" };
    run_git(repo, &["branch", flag, "--", old, new])?;
    Ok(())
}

pub fn merge(repo: &Path, target: &str, no_ff: bool, squash: bool) -> AppResult<()> {
    validate_commit_ish(target)?;
    if no_ff && squash {
        return Err(AppError::Other(
            "--no-ff and --squash are mutually exclusive".into(),
        ));
    }
    let mut args: Vec<&str> = vec!["merge"];
    if no_ff {
        args.push("--no-ff");
    }
    if squash {
        args.push("--squash");
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
        merge(p, "topic", false, false).unwrap();
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
        let topic_commit =
            String::from_utf8_lossy(&run_git(p, &["rev-parse", "HEAD"]).unwrap().stdout)
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
        assert!(merge(tmp.path(), "--exec=evil", false, false).is_err());
        assert!(revert(tmp.path(), "--reset", true).is_err());
        assert!(cherry_pick(tmp.path(), "--abort").is_err());
    }

    #[test]
    fn checkout_rejects_flag_like_targets() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        assert!(checkout(p, "--detach", false).is_err());
        assert!(checkout(p, "-p", false).is_err());
        assert!(checkout(p, "--orphan=evil", true).is_err());
    }

    #[test]
    fn checkout_tracking_rejects_flag_like_args() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        assert!(checkout_tracking(p, "--detach", "origin/main").is_err());
        assert!(checkout_tracking(p, "ok", "--upload-pack=evil").is_err());
    }

    #[test]
    fn create_branch_rejects_flag_like_names() {
        let tmp = init_tmp_repo();
        assert!(create_branch(tmp.path(), "--force", None).is_err());
        assert!(create_branch(tmp.path(), "ok", Some("--exec=evil")).is_err());
    }

    #[test]
    fn rename_branch_rejects_flag_like_names() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        create_branch(p, "feature", None).unwrap();
        assert!(rename_branch(p, "feature", "--force", false).is_err());
        assert!(rename_branch(p, "--force", "renamed", false).is_err());
    }

    #[test]
    fn delete_branch_rejects_flag_like_name() {
        let tmp = init_tmp_repo();
        assert!(delete_branch(tmp.path(), "--force", false).is_err());
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
