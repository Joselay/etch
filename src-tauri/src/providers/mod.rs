pub mod github;

use serde::Serialize;

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Author {
    pub email: String,
    pub login: Option<String>,
    pub avatar_url: Option<String>,
    pub profile_url: Option<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct RepoRef {
    pub host: String,
    pub owner: String,
    pub repo: String,
}

#[allow(dead_code)]
pub trait Provider: Send + Sync {
    fn id(&self) -> &'static str;
    fn detect(&self, remote_url: &str) -> Option<RepoRef>;
    fn fetch_authors(&self, r: &RepoRef) -> AppResult<Vec<Author>>;
}

pub fn providers() -> Vec<Box<dyn Provider>> {
    vec![Box::new(github::Github)]
}

pub fn fetch_authors_for_remote(remote_url: &str) -> AppResult<Vec<Author>> {
    for p in providers() {
        if let Some(r) = p.detect(remote_url) {
            return p.fetch_authors(&r);
        }
    }
    Ok(Vec::new())
}

pub fn parse_remote_url(url: &str) -> Option<(String, String, String)> {
    let url = url.trim();

    // SSH: git@host:owner/repo(.git) — host may contain "-alias"
    if let Some(rest) = url.strip_prefix("git@") {
        if let Some((host_part, path)) = rest.split_once(':') {
            let host = canonical_host(host_part);
            let path = path.trim_end_matches('/').trim_end_matches(".git");
            if let Some((owner, repo)) = path.split_once('/') {
                return Some((host, owner.to_string(), repo.to_string()));
            }
        }
    }

    // ssh:// or https:// URLs
    if let Some(rest) = url
        .strip_prefix("ssh://")
        .or_else(|| url.strip_prefix("https://"))
        .or_else(|| url.strip_prefix("http://"))
    {
        let rest = rest.trim_start_matches("git@");
        let (authority, path) = rest.split_once('/')?;
        let host_part = authority.split('@').next_back().unwrap_or(authority);
        let host_part = host_part.split(':').next().unwrap_or(host_part);
        let host = canonical_host(host_part);
        let path = path.trim_end_matches('/').trim_end_matches(".git");
        if let Some((owner, repo)) = path.split_once('/') {
            return Some((host, owner.to_string(), repo.to_string()));
        }
    }

    None
}

/// SSH host aliases like `github.com-personal` canonicalize to `github.com`.
fn canonical_host(host: &str) -> String {
    let base = host.split('-').next().unwrap_or(host);
    if base.contains('.') {
        base.to_string()
    } else {
        host.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ssh_aliases() {
        let got = parse_remote_url("git@github.com-personal:Sea-Ventures/j-keydge-shopify.git");
        assert_eq!(
            got,
            Some((
                "github.com".into(),
                "Sea-Ventures".into(),
                "j-keydge-shopify".into(),
            ))
        );
    }

    #[test]
    fn parses_https() {
        let got = parse_remote_url("https://github.com/foo/bar.git");
        assert_eq!(
            got,
            Some(("github.com".into(), "foo".into(), "bar".into()))
        );
    }

    #[test]
    fn parses_ssh_plain() {
        let got = parse_remote_url("git@gitlab.com:org/sub/proj.git");
        // owner/sub-path split stays at first slash
        assert_eq!(got.as_ref().map(|(h, _, _)| h.as_str()), Some("gitlab.com"));
    }
}
