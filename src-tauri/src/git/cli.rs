use std::path::Path;
use std::process::Command;

use crate::error::{AppError, AppResult};

#[derive(Debug)]
pub struct GitOutput {
    pub stdout: Vec<u8>,
}

pub fn run_git(repo: &Path, args: &[&str]) -> AppResult<GitOutput> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(AppError::Git(if stderr.is_empty() {
            format!("git exited with status {}", output.status)
        } else {
            stderr
        }));
    }
    Ok(GitOutput {
        stdout: output.stdout,
    })
}
