use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitSummary {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub committer_name: String,
    pub committer_email: String,
    pub committer_timestamp: i64,
    pub parent_ids: Vec<String>,
}

pub fn commit_log(path: &Path, limit: usize, skip: usize) -> AppResult<Vec<CommitSummary>> {
    let repo = gix::open(path).map_err(|e| AppError::Git(e.to_string()))?;

    let head_id = match repo.head().map_err(|e| AppError::Git(e.to_string()))?.kind {
        gix::head::Kind::Unborn(_) => return Ok(Vec::new()),
        gix::head::Kind::Detached { target, .. } => target,
        gix::head::Kind::Symbolic(r) => match r.target.try_id() {
            Some(id) => id.to_owned(),
            None => return Ok(Vec::new()),
        },
    };

    let walk = repo
        .rev_walk([head_id])
        .all()
        .map_err(|e| AppError::Git(e.to_string()))?;

    let mut out = Vec::with_capacity(limit.min(256));
    for (i, info) in walk.enumerate() {
        if i < skip {
            continue;
        }
        if out.len() >= limit {
            break;
        }
        let info = info.map_err(|e| AppError::Git(e.to_string()))?;
        let commit = repo
            .find_commit(info.id)
            .map_err(|e| AppError::Git(e.to_string()))?;
        let msg = commit.message().map_err(|e| AppError::Git(e.to_string()))?;
        let author = commit.author().map_err(|e| AppError::Git(e.to_string()))?;
        let committer = commit.committer().map_err(|e| AppError::Git(e.to_string()))?;

        out.push(CommitSummary {
            id: info.id.to_string(),
            short_id: info.id.to_hex_with_len(7).to_string(),
            summary: msg.summary().to_string(),
            author_name: author.name.to_string(),
            author_email: author.email.to_string(),
            timestamp: author.time.seconds,
            committer_name: committer.name.to_string(),
            committer_email: committer.email.to_string(),
            committer_timestamp: committer.time.seconds,
            parent_ids: info.parent_ids.iter().map(|p| p.to_string()).collect(),
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn walks_this_repo() {
        let here = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace dir");
        let commits = commit_log(here, 5, 0).expect("log");
        assert!(!commits.is_empty());
        assert_eq!(commits[0].short_id.len(), 7);
    }
}
