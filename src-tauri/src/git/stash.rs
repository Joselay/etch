use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StashEntry {
    /// Stash ref, e.g. `stash@{0}`.
    pub ref_name: String,
    pub index: usize,
    pub message: String,
    pub branch: Option<String>,
}

pub fn list_stashes(repo: &Path) -> AppResult<Vec<StashEntry>> {
    // Use a stable separator unlikely to appear in stash metadata.
    let out = run_git(
        repo,
        &[
            "stash",
            "list",
            "--format=%gd%x00%gs",
        ],
    )?;
    let text = String::from_utf8_lossy(&out.stdout);
    let mut entries = Vec::new();
    for (idx, line) in text.lines().enumerate() {
        let mut parts = line.splitn(2, '\0');
        let ref_name = parts.next().unwrap_or("").to_string();
        let raw_msg = parts.next().unwrap_or("").to_string();
        if ref_name.is_empty() {
            continue;
        }
        // `git stash` reflog subjects look like:
        //   `WIP on main: abc1234 last commit`
        //   `On main: custom message`
        let (branch, message) = parse_stash_subject(&raw_msg);
        entries.push(StashEntry {
            ref_name,
            index: idx,
            message,
            branch,
        });
    }
    Ok(entries)
}

fn parse_stash_subject(s: &str) -> (Option<String>, String) {
    let rest = s.strip_prefix("WIP on ").or_else(|| s.strip_prefix("On "));
    match rest {
        Some(r) => {
            if let Some((branch, tail)) = r.split_once(": ") {
                (Some(branch.to_string()), tail.to_string())
            } else {
                (None, s.to_string())
            }
        }
        None => (None, s.to_string()),
    }
}

pub fn create_stash(
    repo: &Path,
    message: Option<&str>,
    include_untracked: bool,
    keep_index: bool,
    paths: &[String],
) -> AppResult<()> {
    let mut args: Vec<&str> = vec!["stash", "push"];
    if include_untracked {
        args.push("--include-untracked");
    }
    if keep_index {
        args.push("--keep-index");
    }
    if let Some(m) = message {
        let trimmed = m.trim();
        if !trimmed.is_empty() {
            args.push("-m");
            args.push(trimmed);
        }
    }
    if !paths.is_empty() {
        // Reject pathspecs that look like flags so they can't be smuggled past
        // git's argument parser, mirroring `validate_stash_ref`.
        for p in paths {
            if p.starts_with('-') {
                return Err(AppError::Other(format!("invalid stash path: {p}")));
            }
        }
        args.push("--");
        for p in paths {
            args.push(p);
        }
    }
    run_git(repo, &args)?;
    Ok(())
}

fn validate_stash_ref(r: &str) -> AppResult<()> {
    // Only accept the canonical `stash@{N}` form to avoid flag injection.
    if !r.starts_with("stash@{") || !r.ends_with('}') {
        return Err(AppError::Other(format!("invalid stash ref: {r}")));
    }
    let inner = &r["stash@{".len()..r.len() - 1];
    if !inner.chars().all(|c| c.is_ascii_digit()) || inner.is_empty() {
        return Err(AppError::Other(format!("invalid stash ref: {r}")));
    }
    Ok(())
}

pub fn apply_stash(repo: &Path, ref_name: &str) -> AppResult<()> {
    validate_stash_ref(ref_name)?;
    run_git(repo, &["stash", "apply", "--", ref_name])?;
    Ok(())
}

pub fn pop_stash(repo: &Path, ref_name: &str) -> AppResult<()> {
    validate_stash_ref(ref_name)?;
    run_git(repo, &["stash", "pop", "--", ref_name])?;
    Ok(())
}

pub fn drop_stash(repo: &Path, ref_name: &str) -> AppResult<()> {
    validate_stash_ref(ref_name)?;
    run_git(repo, &["stash", "drop", "--", ref_name])?;
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
    fn create_list_apply_drop_cycle() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        fs::write(p.join("a.txt"), "changed\n").unwrap();
        create_stash(p, Some("my work"), false, false, &[]).unwrap();

        let list = list_stashes(p).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].ref_name, "stash@{0}");
        assert!(list[0].message.contains("my work"));

        apply_stash(p, "stash@{0}").unwrap();
        drop_stash(p, "stash@{0}").unwrap();
        assert_eq!(list_stashes(p).unwrap().len(), 0);
    }

    #[test]
    fn pop_removes_entry() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        fs::write(p.join("a.txt"), "changed\n").unwrap();
        create_stash(p, None, false, false, &[]).unwrap();
        // Reset working copy so pop doesn't conflict.
        run_git(p, &["checkout", "--", "a.txt"]).unwrap();
        pop_stash(p, "stash@{0}").unwrap();
        assert_eq!(list_stashes(p).unwrap().len(), 0);
    }

    #[test]
    fn partial_stash_only_stashes_selected_paths() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        fs::write(p.join("a.txt"), "a-changed\n").unwrap();
        fs::write(p.join("b.txt"), "b-new\n").unwrap();
        run_git(p, &["add", "b.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "add b"]).unwrap();
        fs::write(p.join("b.txt"), "b-changed\n").unwrap();

        create_stash(p, Some("just a"), false, false, &["a.txt".to_string()]).unwrap();

        // a.txt was stashed (back to "hello\n"); b.txt still dirty.
        assert_eq!(fs::read_to_string(p.join("a.txt")).unwrap(), "hello\n");
        assert_eq!(fs::read_to_string(p.join("b.txt")).unwrap(), "b-changed\n");
    }

    #[test]
    fn rejects_path_starting_with_dash() {
        let tmp = init_tmp_repo();
        let res = create_stash(
            tmp.path(),
            None,
            false,
            false,
            &["--upload-pack=evil".to_string()],
        );
        assert!(res.is_err());
    }

    #[test]
    fn rejects_bogus_ref() {
        let tmp = init_tmp_repo();
        assert!(apply_stash(tmp.path(), "--upload-pack=evil").is_err());
        assert!(drop_stash(tmp.path(), "stash@{x}").is_err());
    }
}
