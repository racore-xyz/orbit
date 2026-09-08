//! Desktop event queue. Events are buffered locally (offline-safe) and flushed in batches
//! straight to Racore /webhooks/desktop with the embedded webhook secret (or, if configured,
//! to a backend URL you control). Each event carries the registered device_id + license_code;
//! the server resolves them to their uuids internally.

use serde::{Deserialize, Serialize};

const API: &str = "https://api.racore.xyz";
const SERVICE: &str = "orbit-growth-os";

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct EventStore {
  #[serde(default)]
  pub url: String,
  #[serde(default)]
  pub enabled: bool,
  /// "url" = POST to your own backend; "racore" = POST straight to the Racore webhook with the secret.
  #[serde(default)]
  pub target: String,
  #[serde(default)]
  pub forward_logs: bool,
  #[serde(default)]
  pub pending: Vec<serde_json::Value>,
  #[serde(default)]
  pub sent: u64,
}

fn secret_entry() -> Option<keyring::Entry> { keyring::Entry::new(SERVICE, "racore-webhook-secret").ok() }
fn get_secret() -> String { secret_entry().and_then(|e| e.get_password().ok()).unwrap_or_default() }

/// Built-in Racore webhook secret (embedded at the app owner's request so log/event forwarding is
/// fully automatic with zero user input). Copied into the OS credential store on first run.
const DEFAULT_WEBHOOK_SECRET: &str = "racore20266";

/// One-shot probe: build a real app_started event with the system device_id, POST it to the
/// Racore webhook, and return a printable report (device_id, payload, HTTP status + body).
pub fn webhook_probe() -> String {
  bootstrap();
  let dc = crate::racore::device_code();
  let code = crate::racore::license_code();
  let mut ev = serde_json::json!({ "device_id": dc, "license": code, "license_code": code, "event_type": "app_started", "at": crate::integrations::now_iso(), "app_version": env!("CARGO_PKG_VERSION"), "source": "webhook-test" });
  let lid = crate::racore::license_id();
  if let Some(o) = ev.as_object_mut() { if !lid.is_empty() { o.insert("license_id".into(), serde_json::json!(lid)); } }
  let payload = serde_json::json!({ "events": [ev] });
  let mut out = format!("device_id: {dc}\npayload: {}\n", serde_json::to_string(&payload).unwrap_or_default());
  match client().post(format!("{API}/webhooks/desktop")).header("X-Webhook-Secret", get_secret()).json(&payload).send() {
    Ok(r) => { let c = r.status().as_u16(); let b = r.text().unwrap_or_default(); out.push_str(&format!("HTTP {c}: {b}")); }
    Err(e) => out.push_str(&format!("send error: {e}")),
  }
  out
}

/// Turn on Racore webhook forwarding automatically — no Log Center inputs, everything internal.
pub fn bootstrap() {
  if get_secret().is_empty() { if let Some(e) = secret_entry() { let _ = e.set_password(DEFAULT_WEBHOOK_SECRET); } }
  let mut s = load();
  if s.target != "racore" || !s.enabled || !s.forward_logs {
    s.target = "racore".into();
    s.enabled = true;
    s.forward_logs = true;
    let _ = save(&s);
  }
}

/// True while events are being forwarded (so logs::add knows whether to enqueue).
pub fn forwarding_on() -> bool { let s = load(); s.enabled && (s.target == "racore" || s.url.starts_with("http")) }
/// True when log entries should be enqueued for forwarding to the webhook/backend.
pub fn log_forwarding_on() -> bool {
  let s = load();
  s.enabled && s.forward_logs && ((s.target == "racore" && !get_secret().is_empty()) || s.url.starts_with("http"))
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

/// Buffer one event. `device_id` is the registered device id and `license_code` is the plain
/// license code (`orbit_…`) — the server resolves both to their uuids internally. `license_id`
/// is included only if the gateway ever returns one. Merges extra fields from `data`.
pub fn track(event_type: &str, data: serde_json::Value) {
  let mut s = load();
  let code = crate::racore::license_code();
  let mut ev = serde_json::json!({
    "device_id": crate::racore::device_code(),
    "license": code,
    "license_code": code,
    "event_type": event_type,
    "at": crate::integrations::now_iso(),
    "app_version": env!("CARGO_PKG_VERSION"),
  });
  if let Some(obj) = ev.as_object_mut() {
    let lid = crate::racore::license_id();
    if !lid.is_empty() { obj.insert("license_id".into(), serde_json::json!(lid)); }
    if let Some(extra) = data.as_object() { for (k, v) in extra { obj.insert(k.clone(), v.clone()); } }
  }
  s.pending.push(ev);
  if s.pending.len() > 5000 { let n = s.pending.len() - 5000; s.pending.drain(0..n); }
  let _ = save(&s);
}

/// Flush up to 1000 buffered events. Target "racore" POSTs to /webhooks/desktop with the secret
/// header; otherwise POSTs { events: [...] } to your own backend URL.
pub fn flush() -> Result<serde_json::Value, String> {
  let mut s = load();
  let racore = s.target == "racore";
  let ready = s.enabled && s.pending.len() > 0 && (racore || s.url.starts_with("http"));
  if !ready { return Ok(serde_json::json!({ "sent": 0, "pending": s.pending.len() })); }
  let batch: Vec<serde_json::Value> = s.pending.iter().take(1000).cloned().collect();
  let n = batch.len();
  let mut req = if racore {
    let secret = get_secret();
    if secret.is_empty() { return Err("Set the Racore webhook secret first.".into()); }
    client().post(format!("{API}/webhooks/desktop")).header("X-Webhook-Secret", secret)
  } else {
    client().post(&s.url)
  };
  req = req.json(&serde_json::json!({ "events": batch }));
  let r = req.send().map_err(|e| format!("Network error: {e}"))?;
  let code = r.status().as_u16();
  if code >= 400 { return Err(format!("Endpoint rejected the events (HTTP {code}).")); }
  s.pending.drain(0..n);
  s.sent += n as u64;
  save(&s)?;
  Ok(serde_json::json!({ "sent": n, "pending": s.pending.len() }))
}

pub fn set_url(url: String, enabled: bool) -> Result<serde_json::Value, String> {
  let mut s = load();
  s.url = url.trim().to_string();
  s.target = "url".into();
  s.enabled = enabled && s.url.starts_with("http");
  save(&s)?;
  Ok(status())
}

/// Send logs/events straight to the Racore webhook. Secret goes to the credential store, never a file.
pub fn set_racore(secret: String, enabled: bool, forward_logs: bool) -> Result<serde_json::Value, String> {
  if !secret.trim().is_empty() { if let Some(e) = secret_entry() { e.set_password(secret.trim()).map_err(|err| format!("credential store: {err}"))?; } }
  let mut s = load();
  s.target = "racore".into();
  s.enabled = enabled;
  s.forward_logs = forward_logs;
  save(&s)?;
  crate::logs::add("info", "logcenter", &format!("Racore webhook forwarding {}", if enabled { "enabled" } else { "disabled" }));
  Ok(status())
}

pub fn status() -> serde_json::Value {
  let s = load();
  serde_json::json!({ "url": s.url, "enabled": s.enabled, "target": if s.target.is_empty() { "url" } else { &s.target }, "forward_logs": s.forward_logs, "has_secret": !get_secret().is_empty(), "pending": s.pending.len(), "sent": s.sent })
}
