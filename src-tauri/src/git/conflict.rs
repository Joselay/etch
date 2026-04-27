use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

/// Lexical check that a user-supplied path is repo-relative and contains no
/// traversal. Rejects absolute paths, `..` escapes, control characters, and
/// the leading `-` that git would parse as a flag. Returns the normalized
/// relative form so callers can pass a canonical string to git.
fn validate_relative_path(rel: &str) -> AppResult<String> {
    if rel.is_empty() {
        return Err(AppError::Other("path must not be empty".into()));
    }
    if rel
        .chars()
        .any(|c| c == '\0' || c == '\n' || c == '\r' || c == ':')
    {
        return Err(AppError::Other("invalid character in path".into()));
    }
    if rel.starts_with('-') {
        return Err(AppError::Other("path must not begin with '-'".into()));
    }
    let mut normalized = PathBuf::new();
    let mut depth: usize = 0;
    for c in Path::new(rel).components() {
        match c {
            Component::Normal(part) => {
                normalized.push(part);
                depth += 1;
            }
            Component::CurDir => {}
            Component::ParentDir => {
                if depth == 0 {
                    return Err(AppError::Other("path escapes repository root".into()));
                }
                normalized.pop();
                depth -= 1;
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(AppError::Other(
                    "path must be relative to repository".into(),
                ));
            }
        }
    }
    normalized
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Other("path contains invalid UTF-8".into()))
}

/// After the parent directory exists on disk, verify that resolving symlinks
/// keeps the target under the repo root.
fn assert_under_repo(repo: &Path, target: &Path) -> AppResult<()> {
    let canonical_repo = repo.canonicalize()?;
    let check = match target.canonicalize() {
        Ok(p) => p,
        Err(_) => target
            .parent()
            .ok_or_else(|| AppError::Other("invalid path".into()))?
            .canonicalize()?,
    };
    if !check.starts_with(&canonical_repo) {
        return Err(AppError::Other("path escapes repository root".into()));
    }
    Ok(())
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConflictKind {
    BothModified,
    BothAdded,
    BothDeleted,
    DeletedByUs,
    DeletedByThem,
    AddedByUs,
    AddedByThem,
    Unknown,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictEntry {
    pub path: String,
    pub kind: ConflictKind,
    pub code: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictSides {
    pub path: String,
    pub base: Option<String>,
    pub ours: Option<String>,
    pub theirs: Option<String>,
    pub working: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ResolveSide {
    Ours,
    Theirs,
}

fn classify(index_code: char, worktree_code: char) -> ConflictKind {
    match (index_code, worktree_code) {
        ('U', 'U') => ConflictKind::BothModified,
        ('A', 'A') => ConflictKind::BothAdded,
        ('D', 'D') => ConflictKind::BothDeleted,
        ('D', 'U') => ConflictKind::DeletedByUs,
        ('U', 'D') => ConflictKind::DeletedByThem,
        ('A', 'U') => ConflictKind::AddedByUs,
        ('U', 'A') => ConflictKind::AddedByThem,
        _ => ConflictKind::Unknown,
    }
}

pub fn list_conflicts(repo: &Path) -> AppResult<Vec<ConflictEntry>> {
    let out = run_git(repo, &["status", "--porcelain=v1", "-z"])?;
    let mut entries = Vec::new();
    let mut parts = out.stdout.split(|b| *b == 0).peekable();
    while let Some(chunk) = parts.next() {
        if chunk.len() < 3 {
            continue;
        }
        let index_code = chunk[0] as char;
        let worktree_code = chunk[1] as char;
        let is_conflict = index_code == 'U'
            || worktree_code == 'U'
            || (index_code == 'A' && worktree_code == 'A')
            || (index_code == 'D' && worktree_code == 'D');
        if !is_conflict {
            // rename/copy entries carry an extra NUL-separated old path; skip it
            if index_code == 'R' || index_code == 'C' {
                let _ = parts.next();
            }
            continue;
        }
        let path = String::from_utf8_lossy(&chunk[3..]).to_string();
        entries.push(ConflictEntry {
            path,
            kind: classify(index_code, worktree_code),
            code: format!("{index_code}{worktree_code}"),
        });
    }
    Ok(entries)
}

fn show_stage(repo: &Path, stage: u8, file: &str) -> Option<String> {
    let spec = format!(":{stage}:{file}");
    match run_git(repo, &["show", &spec]) {
        Ok(out) => Some(String::from_utf8_lossy(&out.stdout).to_string()),
        Err(_) => None,
    }
}

pub fn read_conflict_sides(repo: &Path, file: &str) -> AppResult<ConflictSides> {
    let normalized = validate_relative_path(file)?;
    let target = repo.join(&normalized);
    let base = show_stage(repo, 1, &normalized);
    let ours = show_stage(repo, 2, &normalized);
    let theirs = show_stage(repo, 3, &normalized);
    let working = if assert_under_repo(repo, &target).is_ok() {
        std::fs::read_to_string(&target).ok()
    } else {
        None
    };
    Ok(ConflictSides {
        path: normalized,
        base,
        ours,
        theirs,
        working,
    })
}

pub fn resolve_with(repo: &Path, file: &str, side: ResolveSide) -> AppResult<()> {
    let normalized = validate_relative_path(file)?;
    match side {
        ResolveSide::Ours => {
            run_git(repo, &["checkout", "--ours", "--", &normalized])?;
        }
        ResolveSide::Theirs => {
            run_git(repo, &["checkout", "--theirs", "--", &normalized])?;
        }
    }
    run_git(repo, &["add", "--", &normalized])?;
    Ok(())
}

pub fn resolve_with_content(repo: &Path, file: &str, content: &str) -> AppResult<()> {
    let normalized = validate_relative_path(file)?;
    let target = repo.join(&normalized);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }
    assert_under_repo(repo, &target)?;
    std::fs::write(&target, content)?;
    run_git(repo, &["add", "--", &normalized])?;
    Ok(())
}

pub fn mark_resolved(repo: &Path, files: &[String]) -> AppResult<()> {
    if files.is_empty() {
        return Ok(());
    }
    let normalized: Vec<String> = files
        .iter()
        .map(|f| validate_relative_path(f))
        .collect::<AppResult<_>>()?;
    let mut args: Vec<&str> = vec!["add", "--"];
    for f in &normalized {
        args.push(f);
    }
    run_git(repo, &args)?;
    Ok(())
}

pub fn unmark(repo: &Path, files: &[String]) -> AppResult<()> {
    if files.is_empty() {
        return Ok(());
    }
    let normalized: Vec<String> = files
        .iter()
        .map(|f| validate_relative_path(f))
        .collect::<AppResult<_>>()?;
    // Reset the index entry back to the conflicted state: `reset -- <file>`
    // restores all three stages from HEAD/MERGE_HEAD when the repo is mid-merge.
    let mut args: Vec<&str> = vec!["reset", "--"];
    for f in &normalized {
        args.push(f);
    }
    run_git(repo, &args)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn init_conflict_repo() -> tempfile::TempDir {
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
        let _ = std::process::Command::new("git")
            .arg("-C")
            .arg(p)
            .args(["merge", "--no-edit", "topic"])
            .output();
        tmp
    }

    #[test]
    fn lists_both_modified_conflict() {
        let tmp = init_conflict_repo();
        let entries = list_conflicts(tmp.path()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "a.txt");
        assert_eq!(entries[0].kind, ConflictKind::BothModified);
    }

    #[test]
    fn reads_all_three_sides() {
        let tmp = init_conflict_repo();
        let sides = read_conflict_sides(tmp.path(), "a.txt").unwrap();
        assert_eq!(sides.base.as_deref(), Some("base\n"));
        assert_eq!(sides.ours.as_deref(), Some("main\n"));
        assert_eq!(sides.theirs.as_deref(), Some("topic\n"));
        assert!(sides.working.is_some());
    }

    #[test]
    fn resolve_with_ours_clears_conflict() {
        let tmp = init_conflict_repo();
        resolve_with(tmp.path(), "a.txt", ResolveSide::Ours).unwrap();
        let remaining = list_conflicts(tmp.path()).unwrap();
        assert!(remaining.is_empty());
        let content = fs::read_to_string(tmp.path().join("a.txt")).unwrap();
        assert_eq!(content, "main\n");
    }

    #[test]
    fn resolve_with_theirs_clears_conflict() {
        let tmp = init_conflict_repo();
        resolve_with(tmp.path(), "a.txt", ResolveSide::Theirs).unwrap();
        let remaining = list_conflicts(tmp.path()).unwrap();
        assert!(remaining.is_empty());
        let content = fs::read_to_string(tmp.path().join("a.txt")).unwrap();
        assert_eq!(content, "topic\n");
    }

    #[test]
    fn resolve_with_content_stages_manual_edit() {
        let tmp = init_conflict_repo();
        resolve_with_content(tmp.path(), "a.txt", "merged-by-hand\n").unwrap();
        let remaining = list_conflicts(tmp.path()).unwrap();
        assert!(remaining.is_empty());
        let content = fs::read_to_string(tmp.path().join("a.txt")).unwrap();
        assert_eq!(content, "merged-by-hand\n");
    }

    #[test]
    fn resolve_with_content_rejects_parent_traversal() {
        let tmp = init_conflict_repo();
        let err = resolve_with_content(tmp.path(), "../escape.txt", "evil\n").unwrap_err();
        assert!(format!("{err}").contains("escapes repository root"));
        assert!(!tmp.path().parent().unwrap().join("escape.txt").exists());
    }

    #[test]
    fn resolve_with_content_rejects_absolute_path() {
        let tmp = init_conflict_repo();
        let abs = if cfg!(windows) {
            "C:\\evil.txt"
        } else {
            "/tmp/etch-traversal-evil"
        };
        let err = resolve_with_content(tmp.path(), abs, "evil\n").unwrap_err();
        let msg = format!("{err}");
        assert!(
            msg.contains("must be relative") || msg.contains("escapes repository root"),
            "unexpected error: {msg}"
        );
    }

    #[test]
    fn resolve_with_content_rejects_deep_traversal() {
        let tmp = init_conflict_repo();
        let err = resolve_with_content(tmp.path(), "sub/../../escape.txt", "evil\n").unwrap_err();
        assert!(format!("{err}").contains("escapes repository root"));
    }

    #[test]
    fn read_conflict_sides_rejects_traversal() {
        let tmp = init_conflict_repo();
        assert!(read_conflict_sides(tmp.path(), "../escape.txt").is_err());
    }

    #[test]
    fn read_conflict_sides_rejects_colon_revision_syntax() {
        let tmp = init_conflict_repo();
        // Without validation, `file=":HEAD:foo"` would let an attacker turn
        // the show_stage spec into `:N::HEAD:foo` and read arbitrary objects.
        assert!(read_conflict_sides(tmp.path(), "HEAD:.git/config").is_err());
        assert!(read_conflict_sides(tmp.path(), ":1:a.txt").is_err());
    }

    #[test]
    fn resolve_with_rejects_traversal_and_flag_paths() {
        let tmp = init_conflict_repo();
        assert!(resolve_with(tmp.path(), "../escape.txt", ResolveSide::Ours).is_err());
        assert!(resolve_with(tmp.path(), "-p", ResolveSide::Ours).is_err());
    }

    #[test]
    fn resolve_with_content_allows_nested_subdir() {
        let tmp = init_conflict_repo();
        // Create a file in a nested subdir to make it a real conflict path scenario.
        // We're not actually conflicting on it; we just verify the traversal guard
        // does not over-reject normal nested paths.
        resolve_with_content(tmp.path(), "sub/nested/ok.txt", "ok\n").unwrap();
        let content = fs::read_to_string(tmp.path().join("sub/nested/ok.txt")).unwrap();
        assert_eq!(content, "ok\n");
    }
}
