use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

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
    use std::io::Read;
    // Drain stdout/stderr on dedicated threads so the child never blocks on
    // a full pipe (~64 KB on macOS/Linux). Without this, verbose git ops
    // (clone, fetch with progress, log of large repos) hang forever because
    // try_wait keeps returning None.
    let mut stdout_pipe = child
        .stdout
        .take()
        .ok_or_else(|| AppError::Git("git stdout missing".into()))?;
    let mut stderr_pipe = child
        .stderr
        .take()
        .ok_or_else(|| AppError::Git("git stderr missing".into()))?;
    let stdout_thread = thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stdout_pipe.read_to_end(&mut buf);
        buf
    });
    let stderr_thread = thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stderr_pipe.read_to_end(&mut buf);
        buf
    });

    let status = loop {
        if cancel.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            // Pipes close on kill, so the reader threads will hit EOF and exit.
            let _ = stdout_thread.join();
            let _ = stderr_thread.join();
            return Err(AppError::Other("cancelled".into()));
        }
        match child.try_wait() {
            Ok(Some(s)) => break s,
            Ok(None) => thread::sleep(Duration::from_millis(150)),
            Err(e) => return Err(AppError::Git(format!("failed to wait for git: {e}"))),
        }
    };

    let stdout = stdout_thread.join().unwrap_or_default();
    let stderr = stderr_thread.join().unwrap_or_default();
    if !status.success() {
        let msg = String::from_utf8_lossy(&stderr).trim().to_string();
        return Err(AppError::Git(if msg.is_empty() {
            format!("git exited with status {status}")
        } else {
            msg
        }));
    }
    Ok(GitOutput { stdout })
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

#[cfg(test)]
mod tests {
    use super::*;

    fn init_tmp_repo() -> tempfile::TempDir {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        run_git(p, &["init", "-q", "-b", "main"]).unwrap();
        run_git(p, &["config", "user.email", "t@t.com"]).unwrap();
        run_git(p, &["config", "user.name", "t"]).unwrap();
        run_git(p, &["config", "commit.gpgsign", "false"]).unwrap();
        tmp
    }

    /// With the original try_wait + sleep loop this hangs once the pipe
    /// buffer (~64 KB on macOS/Linux) fills. The fix drains stdout on a
    /// dedicated thread, so the 256 KB blob streams through.
    #[test]
    fn cancellable_does_not_deadlock_on_large_output() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        let big: Vec<u8> = (0..256 * 1024).map(|i| (i % 251) as u8).collect();
        std::fs::write(p.join("big.bin"), &big).unwrap();
        run_git(p, &["add", "big.bin"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "big"]).unwrap();

        let cancel = Arc::new(AtomicBool::new(false));
        let out = run_git_cancellable(p, &["show", "HEAD:big.bin"], cancel).unwrap();
        assert_eq!(out.stdout.len(), big.len());
        assert_eq!(out.stdout, big);
    }

    #[test]
    fn cancellable_returns_cancelled_when_flag_set() {
        let tmp = init_tmp_repo();
        let p = tmp.path();
        std::fs::write(p.join("a.txt"), "x\n").unwrap();
        run_git(p, &["add", "a.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "a"]).unwrap();

        let cancel = Arc::new(AtomicBool::new(true));
        let err = run_git_cancellable(p, &["log", "--all"], cancel).unwrap_err();
        assert!(matches!(err, AppError::Other(ref s) if s == "cancelled"));
    }
}
