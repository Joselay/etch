use std::collections::HashMap;
use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git::cli::run_git;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlameLine {
    pub commit_id: String,
    pub short_id: String,
    pub author_name: String,
    pub author_email: String,
    pub author_time: i64,
    pub summary: String,
    pub line_no: u32,
    pub content: String,
}

/// `git blame --porcelain` output is:
///   <sha> <origLine> <finalLine> [<group-size>]
///   author Name
///   author-mail <email>
///   author-time 1234567890
///   summary first line of commit message
///   ...
///   \t<file contents line>
///
/// The metadata block for a given commit only appears once (the first time
/// the commit is referenced); later references skip straight to the `\t…`
/// content line. We cache metadata per-SHA.
pub fn blame(repo: &Path, file: &str, rev: Option<&str>) -> AppResult<Vec<BlameLine>> {
    if file.is_empty() {
        return Err(AppError::Other("file must not be empty".into()));
    }
    if file.starts_with('-') {
        return Err(AppError::Other(format!("invalid file: {file}")));
    }
    if let Some(r) = rev {
        if r.starts_with('-') || r.is_empty() {
            return Err(AppError::Other(format!("invalid rev: {r}")));
        }
    }

    let mut args: Vec<&str> = vec!["blame", "--porcelain"];
    if let Some(r) = rev {
        args.push(r);
    }
    args.push("--");
    args.push(file);
    let out = run_git(repo, &args)?;

    #[derive(Default, Clone)]
    struct Meta {
        author_name: String,
        author_email: String,
        author_time: i64,
        summary: String,
    }
    let mut meta_by_sha: HashMap<String, Meta> = HashMap::new();
    let mut result: Vec<BlameLine> = Vec::new();
    let mut current_sha: String = String::new();
    let mut current_final_line: u32 = 0;
    let mut current_meta: Meta = Meta::default();
    let mut filling_meta = false;

    let text = String::from_utf8_lossy(&out.stdout);
    for raw in text.split('\n') {
        if let Some(content) = raw.strip_prefix('\t') {
            // The actual source line for the current record.
            // If we were filling meta for a new sha, persist it.
            if filling_meta {
                meta_by_sha.insert(current_sha.clone(), current_meta.clone());
                filling_meta = false;
            }
            let meta = meta_by_sha
                .get(&current_sha)
                .cloned()
                .unwrap_or_default();
            result.push(BlameLine {
                commit_id: current_sha.clone(),
                short_id: current_sha.chars().take(7).collect(),
                author_name: meta.author_name,
                author_email: meta.author_email,
                author_time: meta.author_time,
                summary: meta.summary,
                line_no: current_final_line,
                content: content.to_string(),
            });
            continue;
        }

        // Header line: `<sha> <origLine> <finalLine> [<group>]`
        // Heuristic: SHA is 40 hex chars and appears as first token.
        let mut parts = raw.splitn(4, ' ');
        let first = parts.next().unwrap_or("");
        if first.len() == 40 && first.chars().all(|c| c.is_ascii_hexdigit()) {
            current_sha = first.to_string();
            let _orig = parts.next(); // original line number
            if let Some(final_s) = parts.next() {
                current_final_line = final_s.parse().unwrap_or(0);
            }
            // Meta comes on the following lines only the first time we see
            // this sha. We can't tell "first time" from the header alone,
            // so assume so and overwrite if a `\t` line arrives with no
            // meta lines between.
            filling_meta = !meta_by_sha.contains_key(&current_sha);
            current_meta = Meta::default();
            continue;
        }

        if !filling_meta {
            continue;
        }

        // Metadata key/value lines.
        if let Some(rest) = raw.strip_prefix("author ") {
            current_meta.author_name = rest.to_string();
        } else if let Some(rest) = raw.strip_prefix("author-mail ") {
            current_meta.author_email = rest.trim_matches(|c| c == '<' || c == '>').to_string();
        } else if let Some(rest) = raw.strip_prefix("author-time ") {
            current_meta.author_time = rest.parse().unwrap_or(0);
        } else if let Some(rest) = raw.strip_prefix("summary ") {
            current_meta.summary = rest.to_string();
        }
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn blames_a_file() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path();
        run_git(p, &["init", "-q", "-b", "main"]).unwrap();
        run_git(p, &["config", "user.email", "alice@example.com"]).unwrap();
        run_git(p, &["config", "user.name", "Alice"]).unwrap();
        run_git(p, &["config", "commit.gpgsign", "false"]).unwrap();

        fs::write(p.join("a.txt"), "line one\nline two\n").unwrap();
        run_git(p, &["add", "a.txt"]).unwrap();
        run_git(p, &["commit", "-q", "-m", "add a"]).unwrap();

        // Second author rewrites line two.
        run_git(p, &["config", "user.email", "bob@example.com"]).unwrap();
        run_git(p, &["config", "user.name", "Bob"]).unwrap();
        fs::write(p.join("a.txt"), "line one\nline two edited\n").unwrap();
        run_git(p, &["commit", "-q", "-am", "edit"]).unwrap();

        let lines = blame(p, "a.txt", None).unwrap();
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].line_no, 1);
        assert_eq!(lines[0].content, "line one");
        assert_eq!(lines[0].author_name, "Alice");
        assert_eq!(lines[1].author_name, "Bob");
        assert_eq!(lines[1].content, "line two edited");
    }

    #[test]
    fn rejects_flag_like_args() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(blame(tmp.path(), "--exec=evil", None).is_err());
        assert!(blame(tmp.path(), "a.txt", Some("--upload-pack=x")).is_err());
    }
}
