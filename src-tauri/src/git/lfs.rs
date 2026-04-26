use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LfsPointer {
    pub oid: String,
    pub size: u64,
}

const POINTER_PREFIX: &[u8] = b"version https://git-lfs.github.com/spec/v1";

pub fn is_lfs_pointer(bytes: &[u8]) -> bool {
    if bytes.len() > 1024 {
        return false;
    }
    bytes.starts_with(POINTER_PREFIX)
}

pub fn parse_lfs_pointer(bytes: &[u8]) -> Option<LfsPointer> {
    if !is_lfs_pointer(bytes) {
        return None;
    }
    let text = std::str::from_utf8(bytes).ok()?;
    let mut oid = None;
    let mut size = None;
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("oid sha256:") {
            oid = Some(rest.trim().to_string());
        } else if let Some(rest) = line.strip_prefix("size ") {
            size = rest.trim().parse().ok();
        }
    }
    Some(LfsPointer {
        oid: oid?,
        size: size?,
    })
}
