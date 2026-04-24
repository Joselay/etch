use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

#[derive(Debug, Serialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepoState {
    pub merging: bool,
    pub reverting: bool,
    pub cherry_picking: bool,
    pub rebasing: bool,
    pub bisecting: bool,
    pub has_conflicts: bool,
}

pub fn repo_state(repo: &Path) -> AppResult<RepoState> {
    // Resolve the git dir (handles worktrees + submodules properly).
    let out = run_git(repo, &["rev-parse", "--git-dir"])?;
    let git_dir_rel = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if git_dir_rel.is_empty() {
        return Err(AppError::Git("empty git dir".into()));
    }
    let git_dir = if Path::new(&git_dir_rel).is_absolute() {
        std::path::PathBuf::from(&git_dir_rel)
    } else {
        repo.join(&git_dir_rel)
    };

    let merging = git_dir.join("MERGE_HEAD").exists();
    let reverting = git_dir.join("REVERT_HEAD").exists();
    let cherry_picking = git_dir.join("CHERRY_PICK_HEAD").exists();
    let rebasing = git_dir.join("rebase-merge").exists() || git_dir.join("rebase-apply").exists();
    let bisecting = git_dir.join("BISECT_LOG").exists();

    // Cheap conflict check: `git diff --name-only --diff-filter=U` lists
    // unmerged paths. Empty output = no conflicts.
    let conflicts_out = run_git(repo, &["diff", "--name-only", "--diff-filter=U"])?;
    let has_conflicts = !conflicts_out.stdout.is_empty();

    Ok(RepoState {
        merging,
        reverting,
        cherry_picking,
        rebasing,
        bisecting,
        has_conflicts,
    })
}

/// After conflicts are resolved the user commits to finish a merge/revert/cherry-pick.
/// We piggy-back on the existing `commit` path for merge (no extra flag needed).
/// For revert and cherry-pick, `--continue` is the idiomatic flow — they pick
/// up the previously-generated message and commit.
pub fn continue_revert(repo: &Path) -> AppResult<()> {
    run_git(repo, &["revert", "--continue"])?;
    Ok(())
}

pub fn continue_cherry_pick(repo: &Path) -> AppResult<()> {
    run_git(repo, &["cherry-pick", "--continue"])?;
    Ok(())
}

pub fn continue_merge(repo: &Path) -> AppResult<()> {
    // `git commit --no-edit` picks up MERGE_MSG and finishes the merge.
    run_git(repo, &["commit", "--no-edit"])?;
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
    fn clean_repo_has_no_state() {
        let tmp = init_tmp_repo();
        let s = repo_state(tmp.path()).unwrap();
        assert_eq!(s, RepoState::default());
    }

    #[test]
    fn detects_merge_conflict() {
        let tmp = init_tmp_repo();
        let p = tmp.path();

        // Create conflicting branches.
        run_git(p, &["checkout", "-b", "topic"]).unwrap();
        fs::write(p.join("a.txt"), "from topic\n").unwrap();
        run_git(p, &["commit", "-q", "-am", "topic change"]).unwrap();
        run_git(p, &["checkout", "main"]).unwrap();
        fs::write(p.join("a.txt"), "from main\n").unwrap();
        run_git(p, &["commit", "-q", "-am", "main change"]).unwrap();
        // Attempting to merge will conflict; we don't care about the exit code.
        let _ = std::process::Command::new("git")
            .arg("-C")
            .arg(p)
            .args(["merge", "--no-edit", "topic"])
            .output();

        let s = repo_state(p).unwrap();
        assert!(s.merging);
        assert!(s.has_conflicts);
    }
}
