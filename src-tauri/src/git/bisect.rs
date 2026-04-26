use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

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

fn validate_rev(s: &str, kind: &str) -> AppResult<()> {
    if s.is_empty() {
        return Err(AppError::Other(format!("{kind} must not be empty")));
    }
    if s.starts_with('-') {
        return Err(AppError::Other(format!("invalid {kind}: {s}")));
    }
    Ok(())
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
    validate_rev(bad, "bad")?;
    validate_rev(good, "good")?;
    let out = run_git(repo, &["bisect", "start", "--", bad, good])?;
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
