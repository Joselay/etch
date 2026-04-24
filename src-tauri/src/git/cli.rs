use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

use crate::error::{AppError, AppResult};

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

pub fn run_git_stdin(repo: &Path, args: &[&str], stdin_bytes: &[u8]) -> AppResult<GitOutput> {
    let mut child = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| AppError::Git("failed to open git stdin".into()))?;
        stdin
            .write_all(stdin_bytes)
            .map_err(|e| AppError::Git(format!("failed to write git stdin: {e}")))?;
    }
    let output = child
        .wait_with_output()
        .map_err(|e| AppError::Git(format!("failed to wait for git: {e}")))?;
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
