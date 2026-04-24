use std::path::Path;

use serde::Serialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchRef {
    pub name: String,
    pub full_name: String,
    pub target: Option<String>,
    pub is_head: bool,
    pub remote: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagRef {
    pub name: String,
    pub full_name: String,
    pub target: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefListing {
    pub local: Vec<BranchRef>,
    pub remote: Vec<BranchRef>,
    pub tags: Vec<TagRef>,
    pub head_ref: Option<String>,
}

fn short_name(full: &str, prefix: &str) -> String {
    full.strip_prefix(prefix).unwrap_or(full).to_string()
}

pub fn list_refs(path: &Path) -> AppResult<RefListing> {
    let repo = gix::open(path).map_err(|e| AppError::Git(e.to_string()))?;

    let head_ref = match repo.head().map_err(|e| AppError::Git(e.to_string()))?.kind {
        gix::head::Kind::Symbolic(r) => Some(r.name.as_bstr().to_string()),
        gix::head::Kind::Unborn(name) => Some(name.as_bstr().to_string()),
        gix::head::Kind::Detached { .. } => None,
    };

    let platform = repo.references().map_err(|e| AppError::Git(e.to_string()))?;

    let mut local = Vec::new();
    for r in platform
        .local_branches()
        .map_err(|e| AppError::Git(e.to_string()))?
    {
        let mut r = r.map_err(|e| AppError::Git(e.to_string()))?;
        let full = r.name().as_bstr().to_string();
        let target = r.peel_to_id_in_place().ok().map(|id| id.to_string());
        let is_head = head_ref.as_deref() == Some(full.as_str());
        local.push(BranchRef {
            name: short_name(&full, "refs/heads/"),
            full_name: full,
            target,
            is_head,
            remote: None,
        });
    }

    let mut remote = Vec::new();
    for r in platform
        .remote_branches()
        .map_err(|e| AppError::Git(e.to_string()))?
    {
        let mut r = r.map_err(|e| AppError::Git(e.to_string()))?;
        let full = r.name().as_bstr().to_string();
        let target = r.peel_to_id_in_place().ok().map(|id| id.to_string());
        let stripped = short_name(&full, "refs/remotes/");
        let (remote_name, branch_name) = match stripped.split_once('/') {
            Some((rn, bn)) => (Some(rn.to_string()), bn.to_string()),
            None => (None, stripped.clone()),
        };
        remote.push(BranchRef {
            name: branch_name,
            full_name: full,
            target,
            is_head: false,
            remote: remote_name,
        });
    }

    let mut tags = Vec::new();
    for r in platform.tags().map_err(|e| AppError::Git(e.to_string()))? {
        let mut r = r.map_err(|e| AppError::Git(e.to_string()))?;
        let full = r.name().as_bstr().to_string();
        let target = r.peel_to_id_in_place().ok().map(|id| id.to_string());
        tags.push(TagRef {
            name: short_name(&full, "refs/tags/"),
            full_name: full,
            target,
        });
    }

    local.sort_by(|a, b| a.name.cmp(&b.name));
    remote.sort_by(|a, b| a.full_name.cmp(&b.full_name));
    tags.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(RefListing {
        local,
        remote,
        tags,
        head_ref,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_this_repo_refs() {
        let here = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace dir");
        let refs = list_refs(here).expect("refs");
        assert!(
            !refs.local.is_empty() || refs.head_ref.is_some(),
            "expected at least HEAD or a local branch"
        );
    }
}
