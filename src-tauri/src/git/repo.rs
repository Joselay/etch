use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub path: String,
    pub head_ref: Option<String>,
    pub head_commit_id: Option<String>,
    pub is_detached: bool,
}

pub fn open_repo(path: &Path) -> AppResult<RepoInfo> {
    let repo = gix::open(path).map_err(|e| match e {
        gix::open::Error::NotARepository { .. } => {
            AppError::RepoNotFound(path.display().to_string())
        }
        other => AppError::Git(other.to_string()),
    })?;

    let work_dir = repo
        .work_dir()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| repo.git_dir().to_path_buf());

    let head = repo.head().map_err(|e| AppError::Git(e.to_string()))?;
    let is_detached = matches!(head.kind, gix::head::Kind::Detached { .. });

    let head_ref = match &head.kind {
        gix::head::Kind::Symbolic(r) => Some(r.name.as_bstr().to_string()),
        gix::head::Kind::Unborn(name) => Some(name.as_bstr().to_string()),
        gix::head::Kind::Detached { .. } => None,
    };

    let head_commit_id = match &head.kind {
        gix::head::Kind::Detached { target, .. } => Some(target.to_string()),
        gix::head::Kind::Symbolic(r) => r.target.try_id().map(|id| id.to_string()),
        gix::head::Kind::Unborn(_) => None,
    };

    Ok(RepoInfo {
        path: work_dir.display().to_string(),
        head_ref,
        head_commit_id,
        is_detached,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_this_repo() {
        let here = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace dir");
        let info = open_repo(here).expect("open");
        assert!(info.head_commit_id.is_some() || info.head_ref.is_some());
    }

    #[test]
    fn rejects_non_repo() {
        let tmp = tempfile::tempdir().unwrap();
        let err = open_repo(tmp.path()).unwrap_err();
        assert!(matches!(err, AppError::RepoNotFound(_)));
    }
}
