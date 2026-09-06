//! Rate-limit protection for every outbound channel, in one place.
//! Config in %APPDATA%\orbit\quota.json (editable in Settings → Rate limits), usage counters per day.
//! LLM providers keep their own per-provider req/min in llm.rs; the bridge reads the gaps via env vars.

use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

#[derive(Serialize, Deserialize, Clone)]
pub struct Limits {
  /// Max outbound emails per calendar day (Gmail app-password accounts: Google allows ~500/day, 100 is a safe outreach default).
  pub smtp_per_day: u32,
  /// Minimum seconds between two outbound emails (protects sender reputation and provider burst limits).
  pub smtp_min_gap_s: u32,
  /// Seconds between Exa web-search calls on the shared endpoint / with your own key.
  pub exa_gap_shared_s: f32,
  pub exa_gap_keyed_s: f32,
  /// Seconds between Jina Reader page reads (enrichment, photos).
  pub jina_gap_s: f32,
  /// Seconds between Arctic Shift (Reddit) requests.
  pub reddit_gap_s: f32,
  /// Max Exa calls in one research run.
  pub exa_calls_per_run: u32,
  /// Max company/profile reads per enrichment run.
  pub enrich_per_run: u32,
}

impl Default for Limits {
  fn default() -> Self { Self { smtp_per_day: 100, smtp_min_gap_s: 20, exa_gap_shared_s: 2.5, exa_gap_keyed_s: 1.0, jina_gap_s: 1.0, reddit_gap_s: 1.2, exa_calls_per_run: 25, enrich_per_run: 50 } }
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Usage { pub day: String, pub smtp_sent: u32, pub llm_calls: u32, pub last_send_at: Option<String> }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Quota { #[serde(default)] pub limits: Option<Limits>, #[serde(default)] pub usage: Usage }

fn path() -> std::path::PathBuf {
  let base = std::env::var("APPDATA").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("quota.json")
}
fn today() -> String { crate::integrations::now_iso()[..10].to_string() }

pub fn load() -> Quota {
  let mut q: Quota = std::fs::read_to_string(path()).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
  if q.usage.day != today() { q.usage = Usage { day: today(), ..Default::default() }; }
  q
}
pub fn limits() -> Limits { load().limits.unwrap_or_default() }
fn save(q: &Quota) -> Result<(), String> {
  if let Some(d) = path().parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
  std::fs::write(path(), serde_json::to_vec_pretty(q).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
pub fn set_limits(l: Limits) -> Result<Limits, String> { let mut q = load(); q.limits = Some(l.clone()); save(&q)?; Ok(l) }

fn send_gate() -> &'static Mutex<Option<Instant>> { static G: OnceLock<Mutex<Option<Instant>>> = OnceLock::new(); G.get_or_init(|| Mutex::new(None)) }

/// Call before every outbound email. Blocks for the minimum gap, refuses past the daily cap, then records the send.
pub fn gate_send() -> Result<(), String> {
  let lim = limits();
  let q = load();
  if q.usage.smtp_sent >= lim.smtp_per_day {
    return Err(format!("Daily send limit reached ({}/{}). Raise it under Settings → Rate limits, or continue tomorrow. This protects your Gmail/SMTP account from being throttled or flagged.", q.usage.smtp_sent, lim.smtp_per_day));
  }
  let gap = Duration::from_secs(lim.smtp_min_gap_s as u64);
  loop {
    let wait = { let g = send_gate().lock().unwrap(); g.map(|t| gap.saturating_sub(t.elapsed())).unwrap_or(Duration::ZERO) };
    if wait.is_zero() { break; }
    std::thread::sleep(wait.min(Duration::from_millis(500)));
  }
  *send_gate().lock().unwrap() = Some(Instant::now());
  Ok(())
}
pub fn record_send() { let mut q = load(); q.usage.smtp_sent += 1; q.usage.last_send_at = Some(crate::integrations::now_iso()); let _ = save(&q); }
pub fn record_llm() { let mut q = load(); q.usage.llm_calls += 1; let _ = save(&q); }

pub fn status() -> serde_json::Value {
  let q = load();
  let l = q.limits.clone().unwrap_or_default();
  serde_json::json!({ "limits": l, "usage": q.usage, "defaults": Limits::default(), "path": path().to_string_lossy() })
}
