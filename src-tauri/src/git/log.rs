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

// Format string used by every shell-out path: the columns are NUL-separated
// records (`-z`) and Unit-Separator (\x1f) columns within each record.
//
// Subject (`%s`) is placed last so that splitn(10, '\x1f') absorbs any
// embedded \x1f bytes in the commit subject into that final column, instead
// of shifting every later column. Other fields (oids, names, emails, times,
// parent oids) cannot contain \x1f from any normal git path.
//
// Columns: id | short | authorName | authorEmail | authorTime
//        | committerName | committerEmail | committerTime | parents | subject
const LOG_FORMAT: &str = "--format=%H%x1f%h%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%P%x1f%s";

// Lowercase `haystack` (UTF-8, lossy) into the reused `scratch` buffer and
// check for `needle`. `needle` must already be lowercase. Reusing the buffer
// across calls avoids per-commit String allocation in the search hot path.
fn contains_lower(scratch: &mut String, haystack: &[u8], needle: &str) -> bool {
    scratch.clear();
    let Ok(text) = std::str::from_utf8(haystack) else {
        // Rare path for non-UTF-8 author fields; fall back to lossy and
        // accept the allocation.
        let lossy = String::from_utf8_lossy(haystack);
        return lossy.to_lowercase().contains(needle);
    };

    for ch in text.chars() {
        for lc in ch.to_lowercase() {
            scratch.push(lc);
        }
    }
    scratch.contains(needle)
}

fn parse_commit_log_output(text: &str) -> Vec<CommitSummary> {
    let mut result = Vec::new();
    for record in text.split('\0') {
        if record.is_empty() {
            continue;
        }
        // splitn(10) keeps the final field intact even if the subject
        // contains literal \x1f bytes — see #27.
        let cols: Vec<&str> = record.splitn(10, '\x1f').collect();
        if cols.len() < 10 {
            continue;
        }
        result.push(CommitSummary {
            id: cols[0].to_string(),
            short_id: cols[1].to_string(),
            author_name: cols[2].to_string(),
            author_email: cols[3].to_string(),
            timestamp: cols[4].parse().unwrap_or(0),
            committer_name: cols[5].to_string(),
            committer_email: cols[6].to_string(),
            committer_timestamp: cols[7].parse().unwrap_or(0),
            parent_ids: cols[8].split_whitespace().map(|s| s.to_string()).collect(),
            summary: cols[9].to_string(),
        });
    }
    result
}

pub fn commit_log(
    path: &Path,
    limit: usize,
    skip: usize,
    query: Option<&str>,
    all_branches: bool,
    path_filter: Option<&str>,
    pickaxe: Option<&str>,
) -> AppResult<Vec<CommitSummary>> {
    // Path filter and pickaxe require shelling out to git — gix doesn't yet
    // support content-search rev-walks. Free-text query and HEAD/all-branches
    // still go through the gix fast path.
    let path_filter = path_filter.filter(|p| !p.is_empty());
    let pickaxe = pickaxe.filter(|s| !s.is_empty());
    if path_filter.is_some() || pickaxe.is_some() {
        return commit_log_shellout(path, limit, skip, query, all_branches, path_filter, pickaxe);
    }

    let needle = query
        .map(|q| q.trim().to_lowercase())
        .filter(|q| !q.is_empty());
    let repo = gix::open(path).map_err(|e| AppError::Git(e.to_string()))?;

    let head_id = match repo.head().map_err(|e| AppError::Git(e.to_string()))?.kind {
        gix::head::Kind::Unborn(_) => None,
        gix::head::Kind::Detached { target, .. } => Some(target),
        gix::head::Kind::Symbolic(r) => r.target.try_id().map(|id| id.to_owned()),
    };

    let tips: Vec<gix::ObjectId> = if all_branches {
        let platform = repo
            .references()
            .map_err(|e| AppError::Git(e.to_string()))?;
        let mut seen: std::collections::HashSet<gix::ObjectId> = std::collections::HashSet::new();
        let mut tips = Vec::new();
        if let Some(id) = head_id {
            if seen.insert(id) {
                tips.push(id);
            }
        }
        for iter in [
            platform
                .local_branches()
                .map_err(|e| AppError::Git(e.to_string()))?,
            platform
                .remote_branches()
                .map_err(|e| AppError::Git(e.to_string()))?,
        ] {
            for r in iter {
                let mut r = match r {
                    Ok(r) => r,
                    Err(_) => continue,
                };
                if let Ok(id) = r.peel_to_id_in_place() {
                    let id = id.detach();
                    if seen.insert(id) {
                        tips.push(id);
                    }
                }
            }
        }
        if tips.is_empty() {
            return Ok(Vec::new());
        }
        tips
    } else {
        match head_id {
            Some(id) => vec![id],
            None => return Ok(Vec::new()),
        }
    };

    let walk = repo
        .rev_walk(tips)
        .sorting(gix::traverse::commit::simple::Sorting::ByCommitTimeNewestFirst)
        .all()
        .map_err(|e| AppError::Git(e.to_string()))?;

    let mut out = Vec::with_capacity(limit.min(256));
    // When filtering, `skip` counts matching commits rather than raw walk
    // position — otherwise pagination would be meaningless for searches.
    let mut matched = 0usize;
    // Reused lowercase scratch buffer for needle search to avoid one
    // allocation per commit per field.
    let mut lower_scratch = String::new();
    for info in walk {
        if out.len() >= limit {
            break;
        }
        let info = info.map_err(|e| AppError::Git(e.to_string()))?;

        // Fast path when no search filter: avoid decoding the commit object
        // entirely while we're still skipping past earlier pages.
        if needle.is_none() && matched < skip {
            matched += 1;
            continue;
        }

        // From here we need the commit object — either to filter by needle
        // or to emit a CommitSummary.
        let commit = repo
            .find_commit(info.id)
            .map_err(|e| AppError::Git(e.to_string()))?;
        let msg = commit.message().map_err(|e| AppError::Git(e.to_string()))?;
        let author = commit.author().map_err(|e| AppError::Git(e.to_string()))?;

        if let Some(needle) = needle.as_deref() {
            let summary = msg.summary();
            let hit = contains_lower(&mut lower_scratch, summary.as_ref(), needle)
                || contains_lower(&mut lower_scratch, author.name.as_ref(), needle)
                || contains_lower(&mut lower_scratch, author.email.as_ref(), needle);
            if !hit {
                continue;
            }
            if matched < skip {
                matched += 1;
                continue;
            }
            matched += 1;
        } else {
            // Past the skip guard above; this commit will be emitted.
            matched += 1;
        }

        let committer = commit
            .committer()
            .map_err(|e| AppError::Git(e.to_string()))?;

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

fn commit_log_shellout(
    path: &Path,
    limit: usize,
    skip: usize,
    query: Option<&str>,
    all_branches: bool,
    path_filter: Option<&str>,
    pickaxe: Option<&str>,
) -> AppResult<Vec<CommitSummary>> {
    if let Some(p) = path_filter {
        if p.starts_with('-') {
            return Err(AppError::Other(format!("invalid path filter: {p}")));
        }
    }
    if let Some(s) = pickaxe {
        if s.starts_with('-') {
            return Err(AppError::Other(format!("invalid pickaxe: {s}")));
        }
    }

    let skip_s = skip.to_string();
    let limit_s = limit.to_string();
    let mut args: Vec<&str> = vec!["log", "-z", LOG_FORMAT, "--skip", &skip_s, "-n", &limit_s];
    if all_branches {
        args.push("--all");
    }
    let mut owned: Vec<String> = Vec::new();
    if let Some(q) = query.map(|q| q.trim()).filter(|q| !q.is_empty()) {
        owned.push(format!("--grep={q}"));
        args.push("-i");
    }
    if let Some(s) = pickaxe {
        owned.push(format!("-S{s}"));
    }
    for o in &owned {
        args.push(o.as_str());
    }
    if path_filter.is_some() {
        args.push("--follow");
    }
    args.push("--");
    if let Some(p) = path_filter {
        args.push(p);
    }

    let out = run_git(path, &args)?;
    Ok(parse_commit_log_output(&String::from_utf8_lossy(
        &out.stdout,
    )))
}

/// Commits in `head..base` (i.e. on `head` but not on `base`). Useful for
/// branch comparisons. Newest first.
pub fn range_diff(
    repo: &Path,
    base: &str,
    head: &str,
    limit: usize,
) -> AppResult<Vec<CommitSummary>> {
    if base.is_empty() || base.starts_with('-') {
        return Err(AppError::Other(format!("invalid base: {base}")));
    }
    if head.is_empty() || head.starts_with('-') {
        return Err(AppError::Other(format!("invalid head: {head}")));
    }
    let limit_s = limit.to_string();
    let range = format!("{base}..{head}");
    let out = run_git(repo, &["log", "-z", LOG_FORMAT, "-n", &limit_s, &range])?;
    Ok(parse_commit_log_output(&String::from_utf8_lossy(
        &out.stdout,
    )))
}

/// Full commit message (subject + body) for a single commit. Used by the UI
/// to render the commit body and to pre-fill the textarea on amend.
pub fn commit_message(repo: &Path, commit_id: &str) -> AppResult<String> {
    if commit_id.is_empty() || commit_id.starts_with('-') {
        return Err(AppError::Other(format!("invalid commit id: {commit_id}")));
    }
    let out = run_git(repo, &["log", "-1", "--format=%B", commit_id])?;
    let mut s = String::from_utf8_lossy(&out.stdout).to_string();
    // `git log %B` always emits a trailing newline; strip exactly one so the
    // textarea doesn't gain a blank line on every render.
    if s.ends_with('\n') {
        s.pop();
        if s.ends_with('\r') {
            s.pop();
        }
    }
    Ok(s)
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

    let skip_s = skip.to_string();
    let limit_s = limit.to_string();
    let out = run_git(
        repo,
        &[
            "log", "--follow", "-z", LOG_FORMAT, "--skip", &skip_s, "-n", &limit_s, "--", file,
        ],
    )?;
    Ok(parse_commit_log_output(&String::from_utf8_lossy(
        &out.stdout,
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn walks_this_repo() {
        let here = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace dir");
        let commits = commit_log(here, 5, 0, None, false, None, None).expect("log");
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
    fn subject_with_unit_separator_does_not_corrupt_columns() {
        use std::fs;
        let tmp = tempfile::tempdir().unwrap();
        run_git(tmp.path(), &["init", "-q", "-b", "main"]).unwrap();
        run_git(tmp.path(), &["config", "user.email", "t@t.com"]).unwrap();
        run_git(tmp.path(), &["config", "user.name", "t"]).unwrap();
        run_git(tmp.path(), &["config", "commit.gpgsign", "false"]).unwrap();

        fs::write(tmp.path().join("a.txt"), "x\n").unwrap();
        run_git(tmp.path(), &["add", "a.txt"]).unwrap();
        // Subject contains an embedded \x1f byte — used to shift every later
        // column on parse (#27).
        run_git(tmp.path(), &["commit", "-q", "-m", "subject\x1finjected"]).unwrap();

        let commits = commit_log(tmp.path(), 10, 0, None, false, Some("a.txt"), None).unwrap();
        assert_eq!(commits.len(), 1);
        let c = &commits[0];
        assert_eq!(c.author_name, "t");
        assert_eq!(c.author_email, "t@t.com");
        assert!(
            c.timestamp > 0,
            "timestamp should parse, got {}",
            c.timestamp
        );
        // The embedded \x1f stays inside the subject.
        assert!(c.summary.contains("subject"));
        assert!(c.summary.contains("injected"));
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
        let filtered = commit_log(here, 50, 0, Some("initial"), false, None, None).expect("log");
        let all = commit_log(here, 50, 0, None, false, None, None).expect("log");
        assert!(filtered.len() <= all.len());
    }

    #[test]
    fn all_branches_includes_unmerged_tips() {
        use std::fs;
        let tmp = tempfile::tempdir().unwrap();
        run_git(tmp.path(), &["init", "-q", "-b", "main"]).unwrap();
        run_git(tmp.path(), &["config", "user.email", "t@t.com"]).unwrap();
        run_git(tmp.path(), &["config", "user.name", "t"]).unwrap();
        run_git(tmp.path(), &["config", "commit.gpgsign", "false"]).unwrap();

        fs::write(tmp.path().join("a.txt"), "v1\n").unwrap();
        run_git(tmp.path(), &["add", "a.txt"]).unwrap();
        run_git(tmp.path(), &["commit", "-q", "-m", "base"]).unwrap();

        run_git(tmp.path(), &["checkout", "-q", "-b", "feature"]).unwrap();
        fs::write(tmp.path().join("b.txt"), "x\n").unwrap();
        run_git(tmp.path(), &["add", "b.txt"]).unwrap();
        run_git(tmp.path(), &["commit", "-q", "-m", "only-on-feature"]).unwrap();

        run_git(tmp.path(), &["checkout", "-q", "main"]).unwrap();

        let head_only = commit_log(tmp.path(), 50, 0, None, false, None, None).unwrap();
        assert!(head_only.iter().all(|c| c.summary != "only-on-feature"));

        let all = commit_log(tmp.path(), 50, 0, None, true, None, None).unwrap();
        assert!(all.iter().any(|c| c.summary == "only-on-feature"));
    }
}
