//! Desktop event queue. Events are buffered locally (offline-safe) and flushed in batches to a
//! backend URL YOU control, which forwards them to Racore /webhooks/desktop with the secret.
//! The WEBHOOK_SECRET never ships in this app — only your backend URL is stored here.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct EventStore {
  #[serde(default)]
  pub url: String,
  #[serde(default)]
  pub enabled: bool,
  #[serde(default)]
  pub pending: Vec<serde_json::Value>,
  #[serde(default)]
  pub sent: u64,
}

fn path() -> std::path::PathBuf {
  let base = std::env::var("APPDATA").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("events.json")
}
fn load() -> EventStore { std::fs::read_to_string(path()).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default() }
fn save(s: &EventStore) -> Result<(), String> {
  let p = path();
  if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
  std::fs::write(&p, serde_json::to_vec_pretty(s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
fn client() -> reqwest::blocking::Client {
  reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(15)).user_agent("orbit-growth-os/0.1").build().expect("http client")
}

/// Buffer one event. Adds device_id, license and a timestamp; merges any extra fields from `data`.
pub fn track(event_type: &str, data: serde_json::Value) {
  let mut s = load();
  let mut ev = serde_json::json!({
    "device_id": crate::racore::device_code(),
    "license": crate::racore::license_code(),
    "event_type": event_type,
    "at": crate::integrations::now_iso(),
    "app_version": env!("CARGO_PKG_VERSION"),
  });
  if let (Some(obj), Some(extra)) = (ev.as_object_mut(), data.as_object()) {
    for (k, v) in extra { obj.insert(k.clone(), v.clone()); }
  }
  s.pending.push(ev);
  if s.pending.len() > 5000 { let n = s.pending.len() - 5000; s.pending.drain(0..n); }
  let _ = save(&s);
}

/// Flush up to 1000 buffered events to the backend as { "events": [...] }.
pub fn flush() -> Result<serde_json::Value, String> {
  let mut s = load();
  if !s.enabled || !s.url.starts_with("http") || s.pending.is_empty() {
    return Ok(serde_json::json!({ "sent": 0, "pending": s.pending.len() }));
  }
  let batch: Vec<serde_json::Value> = s.pending.iter().take(1000).cloned().collect();
  let n = batch.len();
  let r = client().post(&s.url).json(&serde_json::json!({ "events": batch })).send().map_err(|e| format!("Network error: {e}"))?;
  let code = r.status().as_u16();
  if code >= 400 { return Err(format!("Backend rejected the events (HTTP {code}).")); }
  s.pending.drain(0..n);
  s.sent += n as u64;
  save(&s)?;
  Ok(serde_json::json!({ "sent": n, "pending": s.pending.len() }))
}

pub fn set_url(url: String, enabled: bool) -> Result<serde_json::Value, String> {
  let mut s = load();
  s.url = url.trim().to_string();
  s.enabled = enabled && s.url.starts_with("http");
  save(&s)?;
  Ok(serde_json::json!({ "url": s.url, "enabled": s.enabled, "pending": s.pending.len() }))
}

pub fn status() -> serde_json::Value {
  let s = load();
  serde_json::json!({ "url": s.url, "enabled": s.enabled, "pending": s.pending.len(), "sent": s.sent })
}
