use crate::error::{AppError, AppResult};

// Reject ref-like names that could be interpreted as git flags
// (e.g. `--upload-pack=evil`) or contain shell/path separators beyond
// what git's own refname rules allow.
pub fn validate_ref_arg(name: &str, kind: &str) -> AppResult<()> {
    if name.is_empty() {
        return Err(AppError::Other(format!("{kind} must not be empty")));
    }
    if name.starts_with('-') {
        return Err(AppError::Other(format!("invalid {kind}: {name}")));
    }
    let ok = name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '/'));
    if !ok {
        return Err(AppError::Other(format!("invalid {kind}: {name}")));
    }
    Ok(())
}

// Allow short & full hex SHAs, branch names, tag names — same character set
// as ref names, which covers all of the above.
pub fn validate_commit_ish(s: &str) -> AppResult<()> {
    validate_ref_arg(s, "commit-ish")
}
