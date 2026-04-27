use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;
use crate::git::validate::validate_commit_ish;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TodoAction {
    Pick,
    Reword,
    Edit,
    Squash,
    Fixup,
    Drop,
}

impl TodoAction {
    fn keyword(self) -> &'static str {
        match self {
            TodoAction::Pick => "pick",
            TodoAction::Reword => "reword",
            TodoAction::Edit => "edit",
            TodoAction::Squash => "squash",
            TodoAction::Fixup => "fixup",
            TodoAction::Drop => "drop",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoEntry {
    pub action: TodoAction,
    pub oid: String,
    pub summary: String,
}

/// Build the default todo list for `git rebase -i <upstream>` (or `--onto`) —
/// the commits reachable from `from` but not `onto`, in chronological order.
pub fn preview_todo(repo: &Path, from: &str, onto: &str) -> AppResult<Vec<TodoEntry>> {
    validate_commit_ish(from)?;
    validate_commit_ish(onto)?;
    let range = format!("{onto}..{from}");
    let out = run_git(
        repo,
        &[
            "log",
            "--reverse",
            "--no-merges",
            "--pretty=format:%H%x00%s",
            &range,
        ],
    )?;
    let text = String::from_utf8_lossy(&out.stdout);
    let mut entries = Vec::new();
    for line in text.lines() {
        if line.is_empty() {
            continue;
        }
        let (oid, summary) = line.split_once('\0').unwrap_or((line, ""));
        entries.push(TodoEntry {
            action: TodoAction::Pick,
            oid: oid.to_string(),
            summary: summary.to_string(),
        });
    }
    Ok(entries)
}

fn serialize_todo(todo: &[TodoEntry]) -> String {
    let mut s = String::new();
    for e in todo {
        if matches!(e.action, TodoAction::Drop) {
            // `drop` lines are valid, but writing a comment-style dropped entry
            // also works and keeps the oid in the log if the user inspects it.
        }
        s.push_str(e.action.keyword());
        s.push(' ');
        s.push_str(&e.oid);
        if !e.summary.is_empty() {
            s.push(' ');
            s.push_str(&e.summary);
        }
        s.push('\n');
    }
    s
}

/// Write a shell script that copies `$ETCH_TODO_FILE` over its first argument,
/// then mark it executable (Unix) so git can invoke it as GIT_SEQUENCE_EDITOR.
/// On Windows we still ship a sh script: git invokes editors via the bundled
/// sh from Git for Windows, and sh would mangle backslashes in a .cmd path.
fn write_sequence_editor_script(dir: &Path) -> AppResult<PathBuf> {
    let script = dir.join("seq-editor.sh");
    let body = "#!/bin/sh\ncat \"$ETCH_TODO_FILE\" > \"$1\"\n";
    std::fs::write(&script, body)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&script)?.permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&script, perms)?;
    }
    Ok(script)
}

/// git on Windows invokes editors through sh, which strips backslashes from
/// the path. Pass forward slashes so the script actually runs.
fn shell_path(p: &Path) -> String {
    if cfg!(windows) {
        p.to_string_lossy().replace('\\', "/")
    } else {
        p.to_string_lossy().into_owned()
    }
}

fn rebase_in_progress(repo: &Path) -> bool {
    repo.join(".git/rebase-merge").exists() || repo.join(".git/rebase-apply").exists()
}

/// Marker that records the temp work dir holding the GIT_SEQUENCE_EDITOR
/// script for an in-flight interactive rebase. We can't delete the script
/// until the rebase actually finishes — git may re-invoke it on --continue
/// if the user reschedules a reword/edit step — so we persist the path here
/// and clean it up when continue_rebase / abort_rebase observe completion.
fn etch_rebase_marker(repo: &Path) -> PathBuf {
    repo.join(".git").join("etch-rebase-work")
}

fn cleanup_persisted_work_dir(repo: &Path) {
    let marker = etch_rebase_marker(repo);
    if let Ok(content) = std::fs::read_to_string(&marker) {
        let path = PathBuf::from(content.trim());
        if path.exists() {
            let _ = std::fs::remove_dir_all(&path);
        }
        let _ = std::fs::remove_file(&marker);
    }
}

fn temp_work_dir() -> AppResult<PathBuf> {
    let mut base = std::env::temp_dir();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    base.push(format!("etch-rebase-{}-{}", std::process::id(), nanos));
    std::fs::create_dir_all(&base)?;
    Ok(base)
}

/// Start an interactive rebase with a pre-built todo list. The current branch
/// (or `from`, if not HEAD) is rebased onto `onto`. Returns Ok even when the
/// rebase pauses on conflict; the caller checks repo_state.
pub fn start_interactive_rebase(
    repo: &Path,
    onto: &str,
    upstream: &str,
    todo: &[TodoEntry],
) -> AppResult<()> {
    validate_commit_ish(onto)?;
    validate_commit_ish(upstream)?;
    if todo.is_empty() {
        return Err(AppError::Git("todo list is empty".into()));
    }
    // Validate that each oid resolves inside this repo to avoid a confusing
    // mid-rebase failure when the caller built the list from stale state.
    for e in todo {
        validate_commit_ish(&e.oid)?;
        run_git(
            repo,
            &["rev-parse", "--verify", &format!("{}^{{commit}}", e.oid)],
        )
        .map_err(|_| AppError::Git(format!("unknown commit {}", e.oid)))?;
    }

    let work = temp_work_dir()?;
    let todo_path = work.join("todo");
    std::fs::write(&todo_path, serialize_todo(todo))?;
    let script = write_sequence_editor_script(&work)?;

    let mut cmd = std::process::Command::new("git");
    cmd.env("GIT_EDITOR", ":")
        .env("GIT_SEQUENCE_EDITOR", shell_path(&script))
        .env("ETCH_TODO_FILE", shell_path(&todo_path))
        .arg("-C")
        .arg(repo);
    if onto == upstream {
        cmd.args(["rebase", "-i", upstream]);
    } else {
        cmd.args(["rebase", "-i", "--onto", onto, upstream]);
    }
    let output = cmd
        .output()
        .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
    let still_rebasing = rebase_in_progress(repo);
    if !output.status.success() && !still_rebasing {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(AppError::Git(if stderr.is_empty() {
            format!("git exited with status {}", output.status)
        } else {
            stderr
        }));
    }
    if still_rebasing {
        // Persist the work-dir path so continue_rebase / abort_rebase can
        // clean it up after the rebase actually finishes.
        let _ = std::fs::write(etch_rebase_marker(repo), work.to_string_lossy().as_bytes());
    } else {
        let _ = std::fs::remove_dir_all(&work);
    }
    Ok(())
}

/// Start a non-interactive rebase of the current branch onto `onto`.
/// Optional `upstream` scopes the commits to replay (`git rebase --onto <onto> <upstream>`).
/// Returns Ok even when the rebase pauses on a conflict; the caller inspects
/// repo_state to tell whether it ran to completion or stopped mid-way.
pub fn start_rebase(repo: &Path, onto: &str, upstream: Option<&str>) -> AppResult<()> {
    validate_commit_ish(onto)?;
    if let Some(up) = upstream {
        validate_commit_ish(up)?;
    }
    let status = if let Some(up) = upstream {
        std::process::Command::new("git")
            .env("GIT_EDITOR", ":")
            .env("GIT_SEQUENCE_EDITOR", ":")
            .arg("-C")
            .arg(repo)
            .args(["rebase", "--onto", onto, up])
            .output()
    } else {
        std::process::Command::new("git")
            .env("GIT_EDITOR", ":")
            .env("GIT_SEQUENCE_EDITOR", ":")
            .arg("-C")
            .arg(repo)
            .args(["rebase", onto])
            .output()
    }
    .map_err(|e| crate::error::AppError::Git(format!("failed to spawn git: {e}")))?;
    // Pausing on a conflict exits non-zero. Surface stderr only if no rebase
    // is in progress — that indicates a real failure (bad ref, dirty tree).
    if !status.status.success() {
        let rebase_running =
            repo.join(".git/rebase-merge").exists() || repo.join(".git/rebase-apply").exists();
        if !rebase_running {
            let stderr = String::from_utf8_lossy(&status.stderr).trim().to_string();
            return Err(crate::error::AppError::Git(if stderr.is_empty() {
                format!("git exited with status {}", status.status)
            } else {
                stderr
            }));
        }
    }
    Ok(())
}

pub fn continue_rebase(repo: &Path) -> AppResult<()> {
    // `GIT_EDITOR=:` skips the commit-message editor when a reword/squash step
    // is the next to apply; the user edits messages through the UI instead.
    let result = run_with_no_editor(repo, &["rebase", "--continue"]);
    if !rebase_in_progress(repo) {
        cleanup_persisted_work_dir(repo);
    }
    result
}

pub fn abort_rebase(repo: &Path) -> AppResult<()> {
    let result = run_git(repo, &["rebase", "--abort"]).map(|_| ());
    if !rebase_in_progress(repo) {
        cleanup_persisted_work_dir(repo);
    }
    result
}

pub fn skip_rebase(repo: &Path) -> AppResult<()> {
    run_git(repo, &["rebase", "--skip"])?;
    Ok(())
}

fn run_with_no_editor(repo: &Path, args: &[&str]) -> AppResult<()> {
    use std::process::Command;
    let output = Command::new("git")
        .env("GIT_EDITOR", ":")
        .env("GIT_SEQUENCE_EDITOR", ":")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .map_err(|e| crate::error::AppError::Git(format!("failed to spawn git: {e}")))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(crate::error::AppError::Git(if stderr.is_empty() {
            format!("git exited with status {}", output.status)
        } else {
            stderr
        }));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn init_rebase_conflict_repo() -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        run_git(p, &["init", "-q", "-b", "main"]).unwrap();
        run_git(p, &["config", "user.email", "t@t.com"]).unwrap();
        run_git(p, &["config", "user.name", "t"]).unwrap();
        run_git(p, &["config", "commit.gpgsign", "false"]).unwrap();
        fs::write(p.join("a.txt"), "base\n").unwrap();
        run_git(p, &["add", "a.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "base"]).unwrap();

        run_git(p, &["checkout", "-q", "-b", "topic"]).unwrap();
        fs::write(p.join("a.txt"), "topic\n").unwrap();
        run_git(p, &["commit", "-q", "-am", "topic"]).unwrap();
        run_git(p, &["checkout", "-q", "main"]).unwrap();
        fs::write(p.join("a.txt"), "main\n").unwrap();
        run_git(p, &["commit", "-q", "-am", "main"]).unwrap();
        run_git(p, &["checkout", "-q", "topic"]).unwrap();
        // rebase topic onto main -> conflict
        let _ = std::process::Command::new("git")
            .arg("-C")
            .arg(p)
            .args(["rebase", "main"])
            .output();
        tmp
    }

    #[test]
    fn start_rebase_completes_fast_forward() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        run_git(p, &["init", "-q", "-b", "main"]).unwrap();
        run_git(p, &["config", "user.email", "t@t.com"]).unwrap();
        run_git(p, &["config", "user.name", "t"]).unwrap();
        run_git(p, &["config", "commit.gpgsign", "false"]).unwrap();
        fs::write(p.join("a.txt"), "1\n").unwrap();
        run_git(p, &["add", "a.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "base"]).unwrap();
        run_git(p, &["checkout", "-q", "-b", "topic"]).unwrap();
        fs::write(p.join("b.txt"), "b\n").unwrap();
        run_git(p, &["add", "b.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "topic"]).unwrap();
        run_git(p, &["checkout", "-q", "main"]).unwrap();
        fs::write(p.join("c.txt"), "c\n").unwrap();
        run_git(p, &["add", "c.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "main"]).unwrap();
        run_git(p, &["checkout", "-q", "topic"]).unwrap();

        start_rebase(p, "main", None).unwrap();
        let state = crate::git::state::repo_state(p).unwrap();
        assert!(!state.rebasing);
    }

    #[test]
    fn start_rebase_pauses_on_conflict() {
        let tmp = init_rebase_conflict_repo();
        let state = crate::git::state::repo_state(tmp.path()).unwrap();
        assert!(state.rebasing);
        assert!(state.has_conflicts);
    }

    #[test]
    fn preview_todo_lists_range_in_chronological_order() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        run_git(p, &["init", "-q", "-b", "main"]).unwrap();
        run_git(p, &["config", "user.email", "t@t.com"]).unwrap();
        run_git(p, &["config", "user.name", "t"]).unwrap();
        run_git(p, &["config", "commit.gpgsign", "false"]).unwrap();
        fs::write(p.join("a.txt"), "1\n").unwrap();
        run_git(p, &["add", "a.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "base"]).unwrap();
        run_git(p, &["checkout", "-q", "-b", "topic"]).unwrap();
        for (i, body) in ["two\n", "three\n", "four\n"].iter().enumerate() {
            fs::write(p.join("a.txt"), body).unwrap();
            run_git(p, &["commit", "-q", "-am", &format!("c{i}")]).unwrap();
        }
        let todo = preview_todo(p, "topic", "main").unwrap();
        assert_eq!(todo.len(), 3);
        assert_eq!(todo[0].summary, "c0");
        assert_eq!(todo[2].summary, "c2");
        assert!(todo.iter().all(|e| matches!(e.action, TodoAction::Pick)));
    }

    #[test]
    fn serialize_todo_emits_one_line_per_entry() {
        let out = serialize_todo(&[
            TodoEntry {
                action: TodoAction::Pick,
                oid: "aaaa".into(),
                summary: "one".into(),
            },
            TodoEntry {
                action: TodoAction::Drop,
                oid: "bbbb".into(),
                summary: "two".into(),
            },
        ]);
        assert_eq!(out, "pick aaaa one\ndrop bbbb two\n");
    }

    #[test]
    fn start_interactive_rebase_drops_commit() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        run_git(p, &["init", "-q", "-b", "main"]).unwrap();
        run_git(p, &["config", "user.email", "t@t.com"]).unwrap();
        run_git(p, &["config", "user.name", "t"]).unwrap();
        run_git(p, &["config", "commit.gpgsign", "false"]).unwrap();
        fs::write(p.join("a.txt"), "1\n").unwrap();
        run_git(p, &["add", "a.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "base"]).unwrap();
        run_git(p, &["checkout", "-q", "-b", "topic"]).unwrap();
        fs::write(p.join("b.txt"), "b\n").unwrap();
        run_git(p, &["add", "b.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "keep"]).unwrap();
        fs::write(p.join("c.txt"), "c\n").unwrap();
        run_git(p, &["add", "c.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "drop-me"]).unwrap();

        let mut todo = preview_todo(p, "topic", "main").unwrap();
        assert_eq!(todo.len(), 2);
        todo[1].action = TodoAction::Drop;
        start_interactive_rebase(p, "main", "main", &todo).unwrap();

        let state = crate::git::state::repo_state(p).unwrap();
        assert!(!state.rebasing);
        // commit "drop-me" should no longer exist on the branch
        let log = run_git(p, &["log", "--format=%s"]).unwrap();
        let text = String::from_utf8_lossy(&log.stdout);
        assert!(!text.contains("drop-me"));
        assert!(text.contains("keep"));
    }

    #[test]
    fn interactive_rebase_preserves_work_dir_until_completion() {
        // Build topic and main with a conflicting change so the interactive
        // rebase pauses on conflict; verify the GIT_SEQUENCE_EDITOR script
        // and todo file survive until --abort cleans them up.
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        run_git(p, &["init", "-q", "-b", "main"]).unwrap();
        run_git(p, &["config", "user.email", "t@t.com"]).unwrap();
        run_git(p, &["config", "user.name", "t"]).unwrap();
        run_git(p, &["config", "commit.gpgsign", "false"]).unwrap();
        fs::write(p.join("a.txt"), "base\n").unwrap();
        run_git(p, &["add", "a.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "base"]).unwrap();
        run_git(p, &["checkout", "-q", "-b", "topic"]).unwrap();
        fs::write(p.join("a.txt"), "topic\n").unwrap();
        run_git(p, &["commit", "-q", "-am", "topic"]).unwrap();
        run_git(p, &["checkout", "-q", "main"]).unwrap();
        fs::write(p.join("a.txt"), "main\n").unwrap();
        run_git(p, &["commit", "-q", "-am", "main"]).unwrap();
        run_git(p, &["checkout", "-q", "topic"]).unwrap();

        let todo = preview_todo(p, "topic", "main").unwrap();
        let _ = start_interactive_rebase(p, "main", "main", &todo);

        // Conflict pause -> work dir must be preserved and tracked.
        let marker = p.join(".git/etch-rebase-work");
        assert!(marker.exists(), "marker file should record work dir");
        let work_dir = std::fs::read_to_string(&marker).unwrap();
        let work_path = std::path::PathBuf::from(work_dir.trim());
        assert!(work_path.exists(), "work dir should outlive the spawn");

        // Aborting the rebase must clean up both the work dir and the marker.
        abort_rebase(p).unwrap();
        assert!(!marker.exists(), "marker should be removed after abort");
        assert!(
            !work_path.exists(),
            "work dir should be removed after abort"
        );
    }

    #[test]
    fn rejects_flag_injection_in_refs() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        run_git(p, &["init", "-q", "-b", "main"]).unwrap();
        run_git(p, &["config", "user.email", "t@t.com"]).unwrap();
        run_git(p, &["config", "user.name", "t"]).unwrap();
        run_git(p, &["config", "commit.gpgsign", "false"]).unwrap();
        fs::write(p.join("a.txt"), "1\n").unwrap();
        run_git(p, &["add", "a.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "base"]).unwrap();

        assert!(start_rebase(p, "--exec=touch /tmp/pwned", None).is_err());
        assert!(start_rebase(p, "main", Some("--root")).is_err());
        assert!(preview_todo(p, "--exec=evil", "main").is_err());
        assert!(preview_todo(p, "main", "--exec=evil").is_err());
        let bogus_todo = vec![TodoEntry {
            action: TodoAction::Pick,
            oid: "main".into(),
            summary: "x".into(),
        }];
        assert!(start_interactive_rebase(p, "--exec=evil", "main", &bogus_todo).is_err());
        assert!(start_interactive_rebase(p, "main", "--exec=evil", &bogus_todo).is_err());
        let evil_oid_todo = vec![TodoEntry {
            action: TodoAction::Pick,
            oid: "--exec=evil".into(),
            summary: "x".into(),
        }];
        assert!(start_interactive_rebase(p, "main", "main", &evil_oid_todo).is_err());
    }

    #[test]
    fn abort_rebase_clears_state() {
        let tmp = init_rebase_conflict_repo();
        let state = crate::git::state::repo_state(tmp.path()).unwrap();
        assert!(state.rebasing);
        abort_rebase(tmp.path()).unwrap();
        let state = crate::git::state::repo_state(tmp.path()).unwrap();
        assert!(!state.rebasing);
    }
}
