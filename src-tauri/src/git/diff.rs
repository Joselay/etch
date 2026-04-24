use std::path::Path;

use gix::object::tree::diff::change::EventDetached;
use gix::objs::tree::EntryKind;
use serde::Serialize;
use similar::{ChangeTag, TextDiff};

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub status: ChangeStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ChangeStatus {
    Added,
    Deleted,
    Modified,
    Renamed,
    Copied,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub content: String,
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DiffLineKind {
    Context,
    Addition,
    Deletion,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub old_path: Option<String>,
    pub is_binary: bool,
    pub hunks: Vec<DiffHunk>,
}

fn resolve_trees<'r>(
    repo: &'r gix::Repository,
    commit_id: &str,
) -> AppResult<(gix::Tree<'r>, Option<gix::Tree<'r>>)> {
    let oid: gix::ObjectId = commit_id
        .parse()
        .map_err(|e: gix::hash::decode::Error| AppError::Git(e.to_string()))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| AppError::Git(e.to_string()))?;
    let new_tree = commit.tree().map_err(|e| AppError::Git(e.to_string()))?;
    let parent_tree = commit
        .parent_ids()
        .next()
        .and_then(|pid| repo.find_commit(pid.detach()).ok())
        .and_then(|p| p.tree().ok());
    Ok((new_tree, parent_tree))
}

pub fn commit_changes(path: &Path, commit_id: &str) -> AppResult<Vec<FileChange>> {
    let repo = gix::open(path).map_err(|e| AppError::Git(e.to_string()))?;
    let (new_tree, parent_tree) = resolve_trees(&repo, commit_id)?;

    let empty_tree;
    let old_tree = match parent_tree {
        Some(t) => t,
        None => {
            empty_tree = repo
                .empty_tree();
            empty_tree
        }
    };

    let mut out = Vec::new();
    let mut platform = old_tree
        .changes()
        .map_err(|e| AppError::Git(e.to_string()))?;
    platform.track_path();

    platform
        .for_each_to_obtain_tree(&new_tree, |change| -> Result<_, std::convert::Infallible> {
            let loc = change.location.to_string();
            let change = change.detach();
            match change.event {
                EventDetached::Addition { .. } => out.push(FileChange {
                    path: loc,
                    old_path: None,
                    status: ChangeStatus::Added,
                }),
                EventDetached::Deletion { .. } => out.push(FileChange {
                    path: loc,
                    old_path: None,
                    status: ChangeStatus::Deleted,
                }),
                EventDetached::Modification { .. } => out.push(FileChange {
                    path: loc,
                    old_path: None,
                    status: ChangeStatus::Modified,
                }),
                EventDetached::Rewrite {
                    source_location,
                    copy,
                    ..
                } => out.push(FileChange {
                    path: loc,
                    old_path: Some(source_location.to_string()),
                    status: if copy {
                        ChangeStatus::Copied
                    } else {
                        ChangeStatus::Renamed
                    },
                }),
            }
            Ok(gix::object::tree::diff::Action::Continue)
        })
        .map_err(|e| AppError::Git(e.to_string()))?;

    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

fn blob_bytes(repo: &gix::Repository, id: gix::ObjectId) -> AppResult<Vec<u8>> {
    let blob = repo
        .find_blob(id)
        .map_err(|e| AppError::Git(e.to_string()))?;
    Ok(blob.data.clone())
}

fn is_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(8000).any(|b| *b == 0)
}

fn build_hunks(old: &str, new: &str) -> Vec<DiffHunk> {
    let diff = TextDiff::from_lines(old, new);
    let mut hunks = Vec::new();
    for group in diff.grouped_ops(3) {
        if group.is_empty() {
            continue;
        }
        let first = group.first().unwrap();
        let last = group.last().unwrap();
        let old_start = first.old_range().start + 1;
        let old_len = last.old_range().end - first.old_range().start;
        let new_start = first.new_range().start + 1;
        let new_len = last.new_range().end - first.new_range().start;
        let header = format!("@@ -{old_start},{old_len} +{new_start},{new_len} @@");

        let mut lines = Vec::new();
        for op in group {
            for change in diff.iter_changes(&op) {
                let (kind, old_line, new_line) = match change.tag() {
                    ChangeTag::Equal => (
                        DiffLineKind::Context,
                        change.old_index().map(|i| (i + 1) as u32),
                        change.new_index().map(|i| (i + 1) as u32),
                    ),
                    ChangeTag::Delete => (
                        DiffLineKind::Deletion,
                        change.old_index().map(|i| (i + 1) as u32),
                        None,
                    ),
                    ChangeTag::Insert => (
                        DiffLineKind::Addition,
                        None,
                        change.new_index().map(|i| (i + 1) as u32),
                    ),
                };
                let mut content = change.value().to_string();
                if content.ends_with('\n') {
                    content.pop();
                    if content.ends_with('\r') {
                        content.pop();
                    }
                }
                lines.push(DiffLine {
                    kind,
                    content,
                    old_line,
                    new_line,
                });
            }
        }
        hunks.push(DiffHunk { header, lines });
    }
    hunks
}

pub fn file_diff(path: &Path, commit_id: &str, file_path: &str) -> AppResult<FileDiff> {
    let repo = gix::open(path).map_err(|e| AppError::Git(e.to_string()))?;
    let (new_tree, parent_tree) = resolve_trees(&repo, commit_id)?;

    let mut buf = Vec::new();
    let new_entry = new_tree
        .lookup_entry_by_path(file_path, &mut buf)
        .map_err(|e| AppError::Git(e.to_string()))?;
    let mut buf2 = Vec::new();
    let old_entry = match &parent_tree {
        Some(t) => t
            .lookup_entry_by_path(file_path, &mut buf2)
            .map_err(|e| AppError::Git(e.to_string()))?,
        None => None,
    };

    let new_bytes = match &new_entry {
        Some(e) if matches!(e.mode().kind(), EntryKind::Blob | EntryKind::BlobExecutable) => {
            blob_bytes(&repo, e.object_id())?
        }
        _ => Vec::new(),
    };
    let old_bytes = match &old_entry {
        Some(e) if matches!(e.mode().kind(), EntryKind::Blob | EntryKind::BlobExecutable) => {
            blob_bytes(&repo, e.object_id())?
        }
        _ => Vec::new(),
    };

    let is_bin = is_binary(&new_bytes) || is_binary(&old_bytes);
    let hunks = if is_bin {
        Vec::new()
    } else {
        let old_str = String::from_utf8_lossy(&old_bytes);
        let new_str = String::from_utf8_lossy(&new_bytes);
        build_hunks(&old_str, &new_str)
    };

    Ok(FileDiff {
        path: file_path.to_string(),
        old_path: None,
        is_binary: is_bin,
        hunks,
    })
}

pub fn working_diff(path: &Path, file_path: &str, staged: bool) -> AppResult<FileDiff> {
    let (old_spec, new_spec) = if staged {
        // staged: HEAD vs index
        ("HEAD", ":0")
    } else {
        // unstaged: index vs worktree
        (":0", "")
    };

    let old_bytes = read_spec(path, old_spec, file_path).unwrap_or_default();
    let new_bytes = if new_spec.is_empty() {
        std::fs::read(path.join(file_path)).unwrap_or_default()
    } else {
        read_spec(path, new_spec, file_path).unwrap_or_default()
    };

    let is_bin = is_binary(&old_bytes) || is_binary(&new_bytes);
    let hunks = if is_bin {
        Vec::new()
    } else {
        let old_str = String::from_utf8_lossy(&old_bytes);
        let new_str = String::from_utf8_lossy(&new_bytes);
        build_hunks(&old_str, &new_str)
    };

    Ok(FileDiff {
        path: file_path.to_string(),
        old_path: None,
        is_binary: is_bin,
        hunks,
    })
}

fn read_spec(repo: &Path, spec: &str, file_path: &str) -> AppResult<Vec<u8>> {
    let target = format!("{spec}:{file_path}");
    let out = run_git(repo, &["show", &target])?;
    Ok(out.stdout)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn head_commit_id() -> (std::path::PathBuf, String) {
        let here = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace")
            .to_path_buf();
        let repo = gix::open(&here).unwrap();
        let id = repo
            .head_id()
            .expect("head id")
            .to_string();
        (here, id)
    }

    #[test]
    fn lists_changes_for_head() {
        let (path, id) = head_commit_id();
        let changes = commit_changes(&path, &id).expect("changes");
        assert!(!changes.is_empty(), "expected some changes in HEAD");
    }

    #[test]
    fn builds_diff_for_first_change() {
        let (path, id) = head_commit_id();
        let changes = commit_changes(&path, &id).expect("changes");
        let first = changes.iter().find(|c| !matches!(c.status, ChangeStatus::Deleted));
        if let Some(c) = first {
            let d = file_diff(&path, &id, &c.path).expect("diff");
            assert_eq!(d.path, c.path);
        }
    }
}
