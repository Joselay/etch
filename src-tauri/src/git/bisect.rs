use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::AppResult;
use crate::git::cli::run_git;
use crate::git::validate::validate_commit_ish;

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BisectStatus {
    pub current_oid: Option<String>,
    pub remaining_steps: Option<u32>,
    pub found_commit: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum BisectVerdict {
    Good,
    Bad,
    Skip,
}

impl BisectVerdict {
    fn arg(self) -> &'static str {
        match self {
            BisectVerdict::Good => "good",
            BisectVerdict::Bad => "bad",
            BisectVerdict::Skip => "skip",
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BisectLogEntry {
    pub oid: String,
    pub verdict: String,
    pub subject: String,
}

fn parse_status(repo: &Path, raw_message: &str) -> BisectStatus {
    let mut status = BisectStatus {
        message: raw_message.trim().to_string(),
        ..BisectStatus::default()
    };
    // Look for "Bisecting: N revisions left to test after this (roughly M steps)"
    for line in raw_message.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("Bisecting: ") {
            // "Bisecting: 5 revisions left to test after this (roughly 3 steps)"
            if let Some(roughly) = rest.split_once("roughly ") {
                let after = roughly.1;
                if let Some(num_part) = after.split_whitespace().next() {
                    if let Ok(n) = num_part.parse::<u32>() {
                        status.remaining_steps = Some(n);
                    }
                }
            }
        }
        // "<sha> is the first bad commit"
        if let Some(first_word) = line.split_whitespace().next() {
            if line.contains("is the first bad commit") && first_word.len() >= 7 {
                status.found_commit = Some(first_word.to_string());
            }
        }
    }

    // Current HEAD is what bisect just checked out.
    if let Ok(out) = run_git(repo, &["rev-parse", "HEAD"]) {
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !s.is_empty() {
            status.current_oid = Some(s);
        }
    }
    status
}

pub fn bisect_start(repo: &Path, bad: &str, good: &str) -> AppResult<BisectStatus> {
    validate_commit_ish(bad)?;
    validate_commit_ish(good)?;
    // `git bisect start [<bad> [<good>...]] [--] [<paths>...]` — `--` is the
    // pathspec separator. Putting refs after `--` made git treat them as paths
    // to limit the bisect to (matching nothing), so bisect never started.
    // validate_commit_ish blocks flag injection on bad/good.
    let out = run_git(repo, &["bisect", "start", bad, good])?;
    let msg = String::from_utf8_lossy(&out.stdout).to_string();
    Ok(parse_status(repo, &msg))
}

pub fn bisect_mark(repo: &Path, verdict: BisectVerdict) -> AppResult<BisectStatus> {
    let out = run_git(repo, &["bisect", verdict.arg()])?;
    let msg = String::from_utf8_lossy(&out.stdout).to_string();
    Ok(parse_status(repo, &msg))
}

pub fn bisect_log(repo: &Path) -> AppResult<Vec<BisectLogEntry>> {
    let out = match run_git(repo, &["bisect", "log"]) {
        Ok(o) => o,
        Err(_) => return Ok(Vec::new()),
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let mut entries = Vec::new();
    for line in text.lines() {
        // git bisect log emits "# <verdict>: [<oid>] <subject>" for marks,
        // and "git bisect <verdict> <oid>" for replay-ready entries.
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("# ") {
            if let Some((verdict_part, after)) = rest.split_once(": [") {
                if let Some((oid, subject)) = after.split_once("] ") {
                    entries.push(BisectLogEntry {
                        verdict: verdict_part.trim().to_string(),
                        oid: oid.to_string(),
                        subject: subject.to_string(),
                    });
                }
            }
        }
    }
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn init_history_repo() -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        run_git(p, &["init", "-q", "-b", "main"]).unwrap();
        run_git(p, &["config", "user.email", "t@t.com"]).unwrap();
        run_git(p, &["config", "user.name", "t"]).unwrap();
        run_git(p, &["config", "commit.gpgsign", "false"]).unwrap();
        for i in 0..5 {
            fs::write(p.join("a.txt"), format!("v{i}\n")).unwrap();
            run_git(p, &["add", "a.txt"]).unwrap();
            run_git(p, &["commit", "-q", "-m", &format!("c{i}")]).unwrap();
        }
        tmp
    }

    /// With the previous `--` placement, git treated bad/good as pathspecs
    /// and the bisect either errored or started without refs; either way
    /// the bisect log was empty. With the fix, the log records both refs.
    #[test]
    fn bisect_start_records_bad_and_good_refs() {
        let tmp = init_history_repo();
        let p = tmp.path();
        let head = String::from_utf8_lossy(&run_git(p, &["rev-parse", "HEAD"]).unwrap().stdout)
            .trim()
            .to_string();
        let first = String::from_utf8_lossy(
            &run_git(p, &["rev-list", "--max-parents=0", "HEAD"])
                .unwrap()
                .stdout,
        )
        .trim()
        .to_string();

        bisect_start(p, &head, &first).unwrap();
        let log = bisect_log(p).unwrap();
        assert!(
            log.iter().any(|e| e.verdict == "bad"),
            "bisect log should record a 'bad' entry"
        );
        assert!(
            log.iter().any(|e| e.verdict == "good"),
            "bisect log should record a 'good' entry"
        );
        // Cleanup so the repo isn't left in a bisecting state.
        let _ = run_git(p, &["bisect", "reset"]);
    }
}
