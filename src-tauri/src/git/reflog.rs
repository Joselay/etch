use std::path::Path;

use serde::Serialize;

use crate::error::AppResult;
use crate::git::cli::run_git;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReflogEntry {
    pub oid: String,
    pub ref_selector: String,
    pub action: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub subject: String,
}

pub fn list_reflog(
    repo: &Path,
    limit: Option<usize>,
    skip: Option<usize>,
) -> AppResult<Vec<ReflogEntry>> {
    // Tab-separated fields, NUL-terminated records via -z so embedded
    // newlines in the reflog message don't break parsing. Format covers:
    //   %H  full oid
    //   %gd reflog selector (e.g. HEAD@{2})
    //   %gn / %ge reflog committer name / email
    //   %at author timestamp (unix seconds)
    //   %gs reflog subject (e.g. "rebase (start): checkout main")
    let limit_arg;
    let skip_arg;
    let mut args: Vec<&str> = vec![
        "log",
        "-g",
        "--format=%H%x09%gd%x09%gn%x09%ge%x09%at%x09%gs",
        "-z",
    ];
    if let Some(n) = limit {
        limit_arg = format!("--max-count={n}");
        args.push(&limit_arg);
    }
    if let Some(n) = skip {
        skip_arg = format!("--skip={n}");
        args.push(&skip_arg);
    }
    let out = run_git(repo, &args)?;
    let text = String::from_utf8_lossy(&out.stdout);

    let mut entries = Vec::new();
    for record in text.split('\0') {
        // `git log -z` puts a leading newline before subsequent records.
        let record = record.trim_start_matches('\n');
        if record.is_empty() {
            continue;
        }
        let parts: Vec<&str> = record.splitn(6, '\t').collect();
        if parts.len() < 6 {
            continue;
        }
        let oid = parts[0].to_string();
        let ref_selector = parts[1].to_string();
        let author_name = parts[2].to_string();
        let author_email = parts[3].to_string();
        let timestamp = parts[4].parse::<i64>().unwrap_or_default();
        let subject = parts[5].to_string();
        let action = parse_action(&subject);
        entries.push(ReflogEntry {
            oid,
            ref_selector,
            action,
            author_name,
            author_email,
            timestamp,
            subject,
        });
    }
    Ok(entries)
}

fn parse_action(subject: &str) -> String {
    // Reflog subjects start with the action verb, sometimes followed by a
    // parenthetical phase ("rebase (start)") and a colon. We only need the
    // bare verb for grouping/iconography.
    let head = subject.split(':').next().unwrap_or("");
    let verb = head.split_whitespace().next().unwrap_or("");
    verb.to_string()
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
    fn lists_reflog_after_commit_and_reset() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        fs::write(p.join("a.txt"), "second\n").unwrap();
        run_git(p, &["commit", "-q", "-am", "second"]).unwrap();
        run_git(p, &["reset", "--hard", "HEAD~1"]).unwrap();

        let entries = list_reflog(p, None, None).unwrap();
        assert!(entries.len() >= 3, "got {entries:?}");
        // Most recent reflog entry first.
        assert_eq!(entries[0].action, "reset");
        assert!(entries[0].ref_selector.starts_with("HEAD@{"));
        assert!(!entries[0].oid.is_empty());
    }

    #[test]
    fn limit_and_skip_paginate() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        fs::write(p.join("a.txt"), "two\n").unwrap();
        run_git(p, &["commit", "-q", "-am", "two"]).unwrap();
        fs::write(p.join("a.txt"), "three\n").unwrap();
        run_git(p, &["commit", "-q", "-am", "three"]).unwrap();

        let first = list_reflog(p, Some(1), None).unwrap();
        assert_eq!(first.len(), 1);
        let next = list_reflog(p, Some(1), Some(1)).unwrap();
        assert_eq!(next.len(), 1);
        assert_ne!(first[0].ref_selector, next[0].ref_selector);
    }

    #[test]
    fn parses_action_verbs() {
        assert_eq!(parse_action("commit: hello"), "commit");
        assert_eq!(parse_action("rebase (start): checkout main"), "rebase");
        assert_eq!(
            parse_action("checkout: moving from main to feature"),
            "checkout"
        );
        assert_eq!(parse_action(""), "");
    }
}
