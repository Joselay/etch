use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub struct CancelRegistry {
    next_id: AtomicU64,
    inner: Mutex<HashMap<u64, Arc<AtomicBool>>>,
}

impl CancelRegistry {
    pub fn new_token(&self) -> (u64, Arc<AtomicBool>) {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut g) = self.inner.lock() {
            g.insert(id, flag.clone());
        }
        (id, flag)
    }

    pub fn cancel(&self, id: u64) {
        if let Ok(mut g) = self.inner.lock() {
            if let Some(flag) = g.remove(&id) {
                flag.store(true, Ordering::Relaxed);
            }
        }
    }

    /// Drop the token without flipping the cancel flag. Cancellable commands
    /// must call this once their op completes (success or error) so the
    /// registry doesn't accumulate stale entries over a long session.
    pub fn remove(&self, id: u64) {
        if let Ok(mut g) = self.inner.lock() {
            g.remove(&id);
        }
    }

    pub fn flag_for(&self, id: u64) -> Option<Arc<AtomicBool>> {
        self.inner.lock().ok().and_then(|g| g.get(&id).cloned())
    }

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.inner.lock().map(|g| g.len()).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remove_drops_token_without_setting_flag() {
        let reg = CancelRegistry::default();
        let (id, flag) = reg.new_token();
        assert_eq!(reg.len(), 1);
        reg.remove(id);
        assert_eq!(reg.len(), 0);
        assert!(!flag.load(Ordering::Relaxed));
        assert!(reg.flag_for(id).is_none());
    }

    #[test]
    fn cancel_removes_and_sets_flag() {
        let reg = CancelRegistry::default();
        let (id, flag) = reg.new_token();
        reg.cancel(id);
        assert_eq!(reg.len(), 0);
        assert!(flag.load(Ordering::Relaxed));
    }

    #[test]
    fn registry_does_not_grow_when_ops_clean_up() {
        let reg = CancelRegistry::default();
        for _ in 0..1000 {
            let (id, _flag) = reg.new_token();
            reg.remove(id);
        }
        assert_eq!(reg.len(), 0);
    }
}
