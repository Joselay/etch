use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

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
    check(output)
}

/// Run `git` with no implicit `-C <repo>`. Use for operations that create a
/// repo (clone, init) or that must succeed outside a working tree.
pub fn run_git_bare(args: &[&str]) -> AppResult<GitOutput> {
    let output = Command::new("git")
        .args(args)
        .output()
        .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
    check(output)
}

fn check(output: std::process::Output) -> AppResult<GitOutput> {
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

pub fn run_git_bare_cancellable(args: &[&str], cancel: Arc<AtomicBool>) -> AppResult<GitOutput> {
    let child = Command::new("git")
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
    wait_with_cancel(child, cancel)
}

pub fn run_git_cancellable(
    repo: &Path,
    args: &[&str],
    cancel: Arc<AtomicBool>,
) -> AppResult<GitOutput> {
    let child = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::Git(format!("failed to spawn git: {e}")))?;
    wait_with_cancel(child, cancel)
}

fn wait_with_cancel(
    mut child: std::process::Child,
    cancel: Arc<AtomicBool>,
) -> AppResult<GitOutput> {
    loop {
        if cancel.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(AppError::Other("cancelled".into()));
        }
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => thread::sleep(Duration::from_millis(150)),
            Err(e) => return Err(AppError::Git(format!("failed to wait for git: {e}"))),
        }
    }
    let output = child
        .wait_with_output()
        .map_err(|e| AppError::Git(format!("failed to wait for git: {e}")))?;
    check(output)
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
