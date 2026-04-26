use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

/// Read the repo's top-level `.gitignore`. Returns empty string if missing.
pub fn read_gitignore(repo: &Path) -> AppResult<String> {
    let p = repo.join(".gitignore");
    if !p.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(&p).map_err(AppError::Io)
}

pub fn write_gitignore(repo: &Path, content: &str) -> AppResult<()> {
    let p = repo.join(".gitignore");
    let normalized = if content.is_empty() || content.ends_with('\n') {
        content.to_string()
    } else {
        format!("{content}\n")
    };
    std::fs::write(&p, normalized).map_err(AppError::Io)
}

pub fn append_gitignore(repo: &Path, pattern: &str) -> AppResult<()> {
    let trimmed = pattern.trim();
    if trimmed.is_empty() {
        return Err(AppError::Other("ignore pattern must not be empty".into()));
    }
    if trimmed.starts_with('-') {
        return Err(AppError::Other(format!("invalid ignore pattern: {trimmed}")));
    }
    let mut current = read_gitignore(repo)?;
    if current.lines().any(|l| l.trim() == trimmed) {
        return Ok(());
    }
    if !current.is_empty() && !current.ends_with('\n') {
        current.push('\n');
    }
    current.push_str(trimmed);
    current.push('\n');
    write_gitignore(repo, &current)
}

/// Stop tracking `file` in the index but keep it on disk.
/// Equivalent to `git rm --cached -- <file>`.
pub fn untrack_file(repo: &Path, file: &str) -> AppResult<()> {
    if file.is_empty() || file.starts_with('-') {
        return Err(AppError::Other(format!("invalid path: {file}")));
    }
    run_git(repo, &["rm", "--cached", "--", file])?;
    Ok(())
}
