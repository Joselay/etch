use std::collections::HashSet;
use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitSummary {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub committer_name: String,
    pub committer_email: String,
    pub committer_timestamp: i64,
    pub parent_ids: Vec<String>,
}

fn contains_lower(scratch: &mut String, haystack: &[u8], needle: &str) -> bool {
    scratch.clear();
    let Ok(text) = std::str::from_utf8(haystack) else {
        return String::from_utf8_lossy(haystack)
            .to_lowercase()
            .contains(needle);
    };
    for character in text.chars() {
        scratch.extend(character.to_lowercase());
    }
    scratch.contains(needle)
}

pub fn commit_log(
    path: &Path,
    limit: usize,
    skip: usize,
    query: Option<&str>,
    all_branches: bool,
) -> AppResult<Vec<CommitSummary>> {
    let query = query
        .map(str::trim)
        .filter(|query| !query.is_empty())
        .map(str::to_lowercase);
    let repo = gix::open(path).map_err(|e| AppError::Git(e.to_string()))?;
    let head_id = match repo.head().map_err(|e| AppError::Git(e.to_string()))?.kind {
        gix::head::Kind::Unborn(_) => None,
        gix::head::Kind::Detached { target, .. } => Some(target),
        gix::head::Kind::Symbolic(reference) => reference.target.try_id().map(|id| id.to_owned()),
    };

    let tips = if all_branches {
        let references = repo
            .references()
            .map_err(|e| AppError::Git(e.to_string()))?;
        let mut seen = HashSet::new();
        let mut tips = Vec::new();
        if let Some(id) = head_id {
            if seen.insert(id) {
                tips.push(id);
            }
        }
        for branches in [
            references
                .local_branches()
                .map_err(|e| AppError::Git(e.to_string()))?,
            references
                .remote_branches()
                .map_err(|e| AppError::Git(e.to_string()))?,
        ] {
            for reference in branches.flatten() {
                let mut reference = reference;
                if let Ok(id) = reference.peel_to_id_in_place() {
                    let id = id.detach();
                    if seen.insert(id) {
                        tips.push(id);
                    }
                }
            }
        }
        tips
    } else {
        head_id.into_iter().collect()
    };

    if tips.is_empty() || limit == 0 {
        return Ok(Vec::new());
    }

    let walk = repo
        .rev_walk(tips)
        .sorting(gix::traverse::commit::simple::Sorting::ByCommitTimeNewestFirst)
        .all()
        .map_err(|e| AppError::Git(e.to_string()))?;
    let mut commits = Vec::with_capacity(limit.min(256));
    let mut matched = 0;
    let mut scratch = String::new();

    for info in walk {
        if commits.len() == limit {
            break;
        }
        let info = info.map_err(|e| AppError::Git(e.to_string()))?;
        if query.is_none() && matched < skip {
            matched += 1;
            continue;
        }

        let commit = repo
            .find_commit(info.id)
            .map_err(|e| AppError::Git(e.to_string()))?;
        let message = commit.message().map_err(|e| AppError::Git(e.to_string()))?;
        let author = commit.author().map_err(|e| AppError::Git(e.to_string()))?;
        if let Some(query) = query.as_deref() {
            let matches = contains_lower(&mut scratch, message.summary().as_ref(), query)
                || contains_lower(&mut scratch, author.name.as_ref(), query)
                || contains_lower(&mut scratch, author.email.as_ref(), query);
            if !matches {
                continue;
            }
            if matched < skip {
                matched += 1;
                continue;
            }
        }
        matched += 1;

        let committer = commit
            .committer()
            .map_err(|e| AppError::Git(e.to_string()))?;
        commits.push(CommitSummary {
            id: info.id.to_string(),
            short_id: info.id.to_hex_with_len(7).to_string(),
            summary: message.summary().to_string(),
            author_name: author.name.to_string(),
            author_email: author.email.to_string(),
            timestamp: author.time.seconds,
            committer_name: committer.name.to_string(),
            committer_email: committer.email.to_string(),
            committer_timestamp: committer.time.seconds,
            parent_ids: info.parent_ids.iter().map(ToString::to_string).collect(),
        });
    }
    Ok(commits)
}

pub fn commit_message(repo: &Path, commit_id: &str) -> AppResult<String> {
    if commit_id.is_empty() || commit_id.starts_with('-') {
        return Err(AppError::Other(format!("invalid commit id: {commit_id}")));
    }
    let out = run_git(repo, &["log", "-1", "--format=%B", commit_id])?;
    let mut message = String::from_utf8_lossy(&out.stdout).to_string();
    if message.ends_with('\n') {
        message.pop();
        if message.ends_with('\r') {
            message.pop();
        }
    }
    Ok(message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn walks_this_repo() {
        let here = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace dir");
        let commits = commit_log(here, 5, 0, None, false).expect("log");
        assert!(!commits.is_empty());
        assert_eq!(commits[0].short_id.len(), 7);
    }

    #[test]
    fn all_branches_includes_unmerged_tips() {
        let tmp = tempfile::tempdir().unwrap();
        run_git(tmp.path(), &["init", "-q", "-b", "main"]).unwrap();
        run_git(tmp.path(), &["config", "user.email", "t@t.com"]).unwrap();
        run_git(tmp.path(), &["config", "user.name", "t"]).unwrap();
        run_git(tmp.path(), &["config", "commit.gpgsign", "false"]).unwrap();
        std::fs::write(tmp.path().join("a.txt"), "base\n").unwrap();
        run_git(tmp.path(), &["add", "a.txt"]).unwrap();
        run_git(tmp.path(), &["commit", "-q", "-m", "base"]).unwrap();
        run_git(tmp.path(), &["checkout", "-q", "-b", "feature"]).unwrap();
        std::fs::write(tmp.path().join("b.txt"), "feature\n").unwrap();
        run_git(tmp.path(), &["add", "b.txt"]).unwrap();
        run_git(tmp.path(), &["commit", "-q", "-m", "only-on-feature"]).unwrap();
        run_git(tmp.path(), &["checkout", "-q", "main"]).unwrap();

        let head = commit_log(tmp.path(), 50, 0, None, false).unwrap();
        assert!(head
            .iter()
            .all(|commit| commit.summary != "only-on-feature"));
        let all = commit_log(tmp.path(), 50, 0, None, true).unwrap();
        assert!(all.iter().any(|commit| commit.summary == "only-on-feature"));
    }
}
