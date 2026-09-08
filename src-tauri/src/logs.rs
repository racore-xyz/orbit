//! Log Center: a single persistent stream of everything the app does (activity, sends, jobs,
//! errors, notifications). Optionally forwards each entry to a user-configured HTTP endpoint so
//! the data can be collected on any website. State in %APPDATA%\orbit\log_center.json.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct LogEntry {
  pub id: String,
  pub at: String,
  pub level: String, // info | success | warn | error
  pub kind: String,
  pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct LogStore {
  pub entries: Vec<LogEntry>,
  #[serde(default)]
  pub forward_url: String,
  #[serde(default)]
  pub forward_enabled: bool,
}

fn path() -> std::path::PathBuf {
  let base = std::env::var("APPDATA").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("log_center.json")
}

pub fn load() -> LogStore {
  std::fs::read_to_string(path()).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

fn save(s: &LogStore) -> Result<(), String> {
  let p = path();
  if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
  std::fs::write(&p, serde_json::to_vec_pretty(s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

/// Infer a level from a log/notification kind so the UI can color it.
pub fn level_for(kind: &str) -> &'static str {
  match kind {
    "error" | "bounce" | "failure" => "error",
    "warn" | "quota" => "warn",
    "reply" | "email" | "autodraft" | "followup" | "campaign" | "research" | "workspace" | "integration" => "success",
    _ => "info",
  }
}

/// Record one entry and, if forwarding is on, POST it to the configured endpoint (best-effort).
pub fn add(level: &str, kind: &str, message: &str) {
  let mut s = load();
  let e = LogEntry {
    id: format!("lg-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0)),
    at: crate::integrations::now_iso(), level: level.into(), kind: kind.into(),
    message: message.chars().take(1200).collect(),
  };
  s.entries.push(e.clone());
  if s.entries.len() > 2000 { let n = s.entries.len() - 2000; s.entries.drain(0..n); }
  let (url, en) = (s.forward_url.clone(), s.forward_enabled);
  let _ = save(&s);
  if en && url.starts_with("http") {
    let e2 = e.clone();
    std::thread::spawn(move || {
      if let Ok(c) = reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(8)).build() {
        let _ = c.post(&url).json(&e2).send();
      }
    });
  }
  // Also stream logs to the Racore webhook / your backend event queue when enabled.
  if crate::events::log_forwarding_on() {
    crate::events::track("log", serde_json::json!({ "level": e.level, "kind": e.kind, "message": e.message }));
  }
}

pub fn list(limit: Option<usize>) -> Vec<LogEntry> {
  let mut e = load().entries;
  e.reverse();
  if let Some(l) = limit { e.truncate(l); }
  e
}

pub fn clear() -> Result<(), String> {
  let mut s = load();
  s.entries.clear();
  save(&s)
}

pub fn set_forward(url: String, enabled: bool) -> Result<serde_json::Value, String> {
  let mut s = load();
  s.forward_url = url.trim().to_string();
  s.forward_enabled = enabled && s.forward_url.starts_with("http");
  save(&s)?;
  add("info", "logcenter", &format!("Forwarding {} to {}", if s.forward_enabled { "enabled" } else { "disabled" }, if s.forward_url.is_empty() { "(none)" } else { &s.forward_url }));
  Ok(serde_json::json!({ "forward_url": s.forward_url, "forward_enabled": s.forward_enabled }))
}

pub fn status() -> serde_json::Value {
  let s = load();
  serde_json::json!({ "forward_url": s.forward_url, "forward_enabled": s.forward_enabled, "count": s.entries.len() })
}

/// Send a test entry to the configured endpoint and report the HTTP result.
pub fn test_forward() -> Result<serde_json::Value, String> {
  let s = load();
  if !s.forward_url.starts_with("http") { return Err("Set a valid https:// URL first".into()); }
  let e = LogEntry { id: "lg-test".into(), at: crate::integrations::now_iso(), level: "info".into(), kind: "logcenter".into(), message: "orbit. Log Center test event".into() };
  let c = reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(10)).build().map_err(|e| e.to_string())?;
  let r = c.post(&s.forward_url).json(&e).send().map_err(|e| format!("POST failed: {e}"))?;
  let code = r.status().as_u16();
  add("info", "logcenter", &format!("Test event forwarded → HTTP {code}"));
  Ok(serde_json::json!({ "ok": code < 400, "status": code }))
}
