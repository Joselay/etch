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

    pub fn flag_for(&self, id: u64) -> Option<Arc<AtomicBool>> {
        self.inner.lock().ok().and_then(|g| g.get(&id).cloned())
    }
}
