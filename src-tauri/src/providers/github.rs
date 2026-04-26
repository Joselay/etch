use serde::Deserialize;

use crate::error::{AppError, AppResult};
use crate::providers::{parse_remote_url, Author, Provider, RepoRef};

pub struct Github;

#[derive(Debug, Deserialize)]
struct GhCommitResponse {
    commit: GhCommit,
    author: Option<GhUser>,
    committer: Option<GhUser>,
}

#[derive(Debug, Deserialize)]
struct GhCommit {
    author: Option<GhSignature>,
    committer: Option<GhSignature>,
}

#[derive(Debug, Deserialize)]
struct GhSignature {
    email: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GhUser {
    login: Option<String>,
    avatar_url: Option<String>,
    html_url: Option<String>,
}

impl Provider for Github {
    fn id(&self) -> &'static str {
        "github"
    }

    fn detect(&self, remote_url: &str) -> Option<RepoRef> {
        let (host, owner, repo) = parse_remote_url(remote_url)?;
        if host != "github.com" {
            return None;
        }
        Some(RepoRef { host, owner, repo })
    }

    fn fetch_authors(&self, r: &RepoRef) -> AppResult<Vec<Author>> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/commits?per_page=100",
            r.owner, r.repo
        );
        let mut req = github_request(&url)?;

        let token = crate::settings::get_token("github.com")
            .ok()
            .flatten()
            .or_else(|| std::env::var("GITHUB_TOKEN").ok().filter(|s| !s.is_empty()));
        let authed = token.is_some();
        if let Some(token) = token {
            req = req.header("Authorization", format!("Bearer {token}"));
        }

        let resp = req
            .send()
            .map_err(|e| AppError::Other(format!("github: {e}")))?;

        let status = resp.status();
        if !status.is_success() {
            let code = status.as_u16();
            // 404 on this endpoint for a valid-looking repo path almost always means
            // "private, not authed". Treat 401/403/404 as auth-actionable.
            let msg = match (code, authed) {
                (401 | 403, true) => "github: token rejected (check scopes and expiry)".into(),
                (401 | 403, false) => "github: authentication required".into(),
                (404, true) => {
                    "github: repo not found or token lacks access".into()
                }
                (404, false) => "github: private repo or not found — add a token".into(),
                _ => format!("github: api returned {code}"),
            };
            return if matches!(code, 401 | 403 | 404) {
                Err(AppError::Auth(msg))
            } else {
                Err(AppError::Other(msg))
            };
        }

        let commits: Vec<GhCommitResponse> = resp
            .json()
            .map_err(|e| AppError::Other(format!("github json: {e}")))?;

        let mut seen_emails: std::collections::HashMap<String, Author> =
            std::collections::HashMap::new();

        for c in commits {
            collect(&mut seen_emails, c.commit.author.as_ref(), c.author.as_ref());
            collect(
                &mut seen_emails,
                c.commit.committer.as_ref(),
                c.committer.as_ref(),
            );
        }

        Ok(seen_emails.into_values().collect())
    }
}

fn collect(
    acc: &mut std::collections::HashMap<String, Author>,
    sig: Option<&GhSignature>,
    user: Option<&GhUser>,
) {
    let Some(sig) = sig else { return };
    let Some(email) = sig.email.as_ref() else {
        return;
    };
    let email_key = email.to_lowercase();
    if acc.contains_key(&email_key) {
        return;
    }
    let (login, avatar_url, profile_url) = match user {
        Some(u) => (u.login.clone(), u.avatar_url.clone(), u.html_url.clone()),
        None => (None, None, None),
    };
    acc.insert(
        email_key,
        Author {
            email: email.clone(),
            login,
            avatar_url,
            profile_url,
        },
    );
}

/// GET builder preconfigured with GitHub API headers. Isolated so swapping the
/// underlying HTTP client stays local to this helper.
fn github_request(url: &str) -> AppResult<reqwest::blocking::RequestBuilder> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("etch-git-client")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Other(format!("http: {e}")))?;
    Ok(client
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_github_and_skips_others() {
        let gh = Github;
        assert!(gh
            .detect("git@github.com:a/b.git")
            .is_some());
        assert!(gh
            .detect("git@github.com-personal:a/b.git")
            .is_some());
        assert!(gh
            .detect("https://gitlab.com/a/b.git")
            .is_none());
    }
}
