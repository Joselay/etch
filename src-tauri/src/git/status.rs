use std::path::Path;

use serde::Serialize;

use crate::error::AppResult;
use crate::git::cli::run_git;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusEntry {
    pub path: String,
    pub old_path: Option<String>,
    pub code: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatus {
    pub staged: Vec<StatusEntry>,
    pub unstaged: Vec<StatusEntry>,
    pub untracked: Vec<StatusEntry>,
    pub conflicted: Vec<StatusEntry>,
}

pub fn status(path: &Path) -> AppResult<RepoStatus> {
    let out = run_git(
        path,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?;
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    let mut conflicted = Vec::new();

    let mut parts = out.stdout.split(|b| *b == 0).peekable();
    while let Some(chunk) = parts.next() {
        if chunk.is_empty() {
            continue;
        }
        if chunk.len() < 3 {
            continue;
        }
        let index_code = chunk[0] as char;
        let worktree_code = chunk[1] as char;
        let rest = String::from_utf8_lossy(&chunk[3..]).to_string();

        if index_code == '?' && worktree_code == '?' {
            untracked.push(StatusEntry {
                path: rest,
                old_path: None,
                code: "??".to_string(),
            });
            continue;
        }
        if index_code == 'U'
            || worktree_code == 'U'
            || (index_code == 'A' && worktree_code == 'A')
            || (index_code == 'D' && worktree_code == 'D')
        {
            conflicted.push(StatusEntry {
                path: rest,
                old_path: None,
                code: format!("{index_code}{worktree_code}"),
            });
            continue;
        }

        let (new_path, old_path) = if index_code == 'R' || index_code == 'C' {
            let original = parts.next().map(|b| String::from_utf8_lossy(b).to_string());
            (rest, original)
        } else {
            (rest, None)
        };

        if index_code != ' ' && index_code != '?' {
            staged.push(StatusEntry {
                path: new_path.clone(),
                old_path: old_path.clone(),
                code: format!("{index_code} "),
            });
        }
        if worktree_code != ' ' && worktree_code != '?' {
            unstaged.push(StatusEntry {
                path: new_path,
                old_path,
                code: format!(" {worktree_code}"),
            });
        }
    }

    Ok(RepoStatus {
        staged,
        unstaged,
        untracked,
        conflicted,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runs_status_on_this_repo() {
        let here = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace");
        let _ = status(here).expect("status runs");
    }
}
