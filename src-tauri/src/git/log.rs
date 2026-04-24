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

pub fn commit_log(
    path: &Path,
    limit: usize,
    skip: usize,
    query: Option<&str>,
) -> AppResult<Vec<CommitSummary>> {
    let needle = query
        .map(|q| q.trim().to_lowercase())
        .filter(|q| !q.is_empty());
    let repo = gix::open(path).map_err(|e| AppError::Git(e.to_string()))?;

    let head_id = match repo.head().map_err(|e| AppError::Git(e.to_string()))?.kind {
        gix::head::Kind::Unborn(_) => return Ok(Vec::new()),
        gix::head::Kind::Detached { target, .. } => target,
        gix::head::Kind::Symbolic(r) => match r.target.try_id() {
            Some(id) => id.to_owned(),
            None => return Ok(Vec::new()),
        },
    };

    let walk = repo
        .rev_walk([head_id])
        .all()
        .map_err(|e| AppError::Git(e.to_string()))?;

    let mut out = Vec::with_capacity(limit.min(256));
    // When filtering, `skip` counts matching commits rather than raw walk
    // position — otherwise pagination would be meaningless for searches.
    let mut matched = 0usize;
    for info in walk {
        if out.len() >= limit {
            break;
        }
        let info = info.map_err(|e| AppError::Git(e.to_string()))?;
        let commit = repo
            .find_commit(info.id)
            .map_err(|e| AppError::Git(e.to_string()))?;
        let msg = commit.message().map_err(|e| AppError::Git(e.to_string()))?;
        let author = commit.author().map_err(|e| AppError::Git(e.to_string()))?;
        let committer = commit.committer().map_err(|e| AppError::Git(e.to_string()))?;

        if let Some(needle) = needle.as_deref() {
            let hit = msg
                .summary()
                .to_string()
                .to_lowercase()
                .contains(needle)
                || author.name.to_string().to_lowercase().contains(needle)
                || author.email.to_string().to_lowercase().contains(needle);
            if !hit {
                continue;
            }
        }

        if matched < skip {
            matched += 1;
            continue;
        }
        matched += 1;

        out.push(CommitSummary {
            id: info.id.to_string(),
            short_id: info.id.to_hex_with_len(7).to_string(),
            summary: msg.summary().to_string(),
            author_name: author.name.to_string(),
            author_email: author.email.to_string(),
            timestamp: author.time.seconds,
            committer_name: committer.name.to_string(),
            committer_email: committer.email.to_string(),
            committer_timestamp: committer.time.seconds,
            parent_ids: info.parent_ids.iter().map(|p| p.to_string()).collect(),
        });
    }
    Ok(out)
}

/// Commits touching `file`, newest first. Follows renames. Shells out to
/// `git log` because `gix`'s path-filtered rev-walk is limited.
pub fn commit_log_for_file(
    repo: &Path,
    file: &str,
    limit: usize,
    skip: usize,
) -> AppResult<Vec<CommitSummary>> {
    if file.is_empty() {
        return Err(AppError::Other("file path must not be empty".into()));
    }
    if file.starts_with('-') {
        return Err(AppError::Other(format!("invalid file path: {file}")));
    }

    // %x00 is NUL; %x1f is Unit Separator — neither appears in normal git
    // metadata, so we can split reliably. Parent IDs are space-separated
    // within the last column.
    //
    // Columns: id | short | subject | authorName | authorEmail | authorTime
    //        | committerName | committerEmail | committerTime | parents
    let format = "--format=%H%x1f%h%x1f%s%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%P";
    let skip_s = skip.to_string();
    let limit_s = limit.to_string();
    let out = run_git(
        repo,
        &[
            "log",
            "--follow",
            "-z",
            format,
            "--skip",
            &skip_s,
            "-n",
            &limit_s,
            "--",
            file,
        ],
    )?;

    let text = String::from_utf8_lossy(&out.stdout);
    let mut result = Vec::new();
    // `-z` separates records with NUL instead of LF.
    for record in text.split('\0') {
        if record.is_empty() {
            continue;
        }
        let cols: Vec<&str> = record.split('\x1f').collect();
        if cols.len() < 10 {
            continue;
        }
        result.push(CommitSummary {
            id: cols[0].to_string(),
            short_id: cols[1].to_string(),
            summary: cols[2].to_string(),
            author_name: cols[3].to_string(),
            author_email: cols[4].to_string(),
            timestamp: cols[5].parse().unwrap_or(0),
            committer_name: cols[6].to_string(),
            committer_email: cols[7].to_string(),
            committer_timestamp: cols[8].parse().unwrap_or(0),
            parent_ids: cols[9]
                .split_whitespace()
                .map(|s| s.to_string())
                .collect(),
        });
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn walks_this_repo() {
        let here = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace dir");
        let commits = commit_log(here, 5, 0, None).expect("log");
        assert!(!commits.is_empty());
        assert_eq!(commits[0].short_id.len(), 7);
    }

    #[test]
    fn file_history_returns_commits() {
        use std::fs;
        let tmp = tempfile::tempdir().unwrap();
        run_git(tmp.path(), &["init", "-q", "-b", "main"]).unwrap();
        run_git(tmp.path(), &["config", "user.email", "t@t.com"]).unwrap();
        run_git(tmp.path(), &["config", "user.name", "t"]).unwrap();
        run_git(tmp.path(), &["config", "commit.gpgsign", "false"]).unwrap();

        fs::write(tmp.path().join("a.txt"), "v1\n").unwrap();
        run_git(tmp.path(), &["add", "a.txt"]).unwrap();
        run_git(tmp.path(), &["commit", "-q", "-m", "first"]).unwrap();
        fs::write(tmp.path().join("a.txt"), "v2\n").unwrap();
        run_git(tmp.path(), &["commit", "-q", "-am", "second"]).unwrap();
        // Noise commit that doesn't touch a.txt
        fs::write(tmp.path().join("b.txt"), "x\n").unwrap();
        run_git(tmp.path(), &["add", "b.txt"]).unwrap();
        run_git(tmp.path(), &["commit", "-q", "-m", "other"]).unwrap();

        let commits = commit_log_for_file(tmp.path(), "a.txt", 10, 0).unwrap();
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].summary, "second");
        assert_eq!(commits[1].summary, "first");
    }

    #[test]
    fn file_history_rejects_flag_like_path() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(commit_log_for_file(tmp.path(), "--exec=evil", 10, 0).is_err());
    }

    #[test]
    fn query_filters_by_message() {
        let here = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace dir");
        // Query the word "Initial" — real repos may or may not have such a
        // commit, so the assertion is just that filtering never panics and
        // respects the limit.
        let filtered = commit_log(here, 50, 0, Some("initial")).expect("log");
        let all = commit_log(here, 50, 0, None).expect("log");
        assert!(filtered.len() <= all.len());
    }
}
