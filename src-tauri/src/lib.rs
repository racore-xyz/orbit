mod integrations;

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use tauri::Emitter;

/// Running streaming jobs, by job id, so the UI can cancel them.
fn jobs() -> &'static Mutex<HashMap<String, Child>> {
  static JOBS: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();
  JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// The research bridge ships inside the binary, so the app never depends on a
/// file path at runtime. Source of truth: desktop/bridge/search.py
const BRIDGE_SEARCH: &str = include_str!("../../desktop/bridge/search.py");
const BRIDGE_LEADS: &str = include_str!("../../desktop/bridge/leads.py");

fn bridge_source() -> String {
  // search.py defines helpers + main(); leads.py adds find_leads/enrich/export; _entry() dispatches.
  format!("{BRIDGE_SEARCH}\n{BRIDGE_LEADS}\n_entry()\n")
}

/// Materialize the concatenated bridge to a temp `.py` file and return its path.
/// We run `python <file>` instead of `python -c <source>` because the source is
/// ~32 KB and Windows caps a process command line at 32,767 chars — passing it
/// inline overflows and fails with os error 206 ("filename or extension is too
/// long"). The filename is content-addressed so it is stable across runs, shared
/// by concurrent jobs, and regenerated whenever the bundled bridge changes.
fn bridge_script() -> Result<PathBuf, String> {
  let src = bridge_source();
  let mut h: u64 = 0xcbf2_9ce4_8422_2325; // FNV-1a over the source bytes
  for b in src.as_bytes() { h ^= *b as u64; h = h.wrapping_mul(0x0000_0100_0000_01b3); }
  let dir = std::env::temp_dir().join("orbit-bridge");
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = dir.join(format!("bridge-{h:016x}.py"));
  if !path.exists() {
    // Write to a pid-unique temp then rename, so a concurrent job never executes
    // a half-written file. A losing race just overwrites identical content.
    let tmp = dir.join(format!("bridge-{h:016x}.{}.tmp", std::process::id()));
    std::fs::write(&tmp, &src).map_err(|e| e.to_string())?;
    if std::fs::rename(&tmp, &path).is_err() { let _ = std::fs::remove_file(&tmp); }
  }
  Ok(path)
}

/// Resolve the Python interpreter once. Honors ORBIT_PYTHON, otherwise tries the
/// Windows `py -3` launcher, `python`/`python3` on PATH, and common per-user
/// install locations — picking the first that actually runs. Returns the program
/// plus any leading args (e.g. `("py", ["-3"])`), so end-user machines that have
/// Python but haven't added it to PATH still work without manual setup.
fn python_cmd() -> &'static (String, Vec<String>) {
  static RESOLVED: OnceLock<(String, Vec<String>)> = OnceLock::new();
  RESOLVED.get_or_init(|| {
    if let Ok(e) = std::env::var("ORBIT_PYTHON") {
      if !e.trim().is_empty() { return (e, vec![]); }
    }
    let mut candidates: Vec<(String, Vec<String>)> = vec![
      ("py".into(), vec!["-3".into()]),
      ("python".into(), vec![]),
      ("python3".into(), vec![]),
    ];
    #[cfg(windows)]
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
      for v in ["Python314", "Python313", "Python312"] {
        candidates.push((format!("{local}\\Programs\\Python\\{v}\\python.exe"), vec![]));
      }
    }
    for (prog, args) in &candidates {
      let mut c = Command::new(prog);
      c.args(args).arg("--version").stdout(Stdio::null()).stderr(Stdio::null());
      #[cfg(windows)]
      { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); }
      if c.status().map(|s| s.success()).unwrap_or(false) { return (prog.clone(), args.clone()); }
    }
    ("python".into(), vec![]) // last resort; the spawn error will name the problem
  })
}

fn python() -> Command {
  let (exe, pre) = python_cmd();
  let mut cmd = Command::new(exe);
  cmd.args(pre);
  // Make user-site scripts (pip --user) and common tool locations visible.
  let mut path = std::env::var("PATH").unwrap_or_default();
  if let Ok(appdata) = std::env::var("APPDATA") {
    for v in ["Python314", "Python313", "Python312"] {
      path = format!("{path};{appdata}\\Python\\{v}\\Scripts");
    }
    path = format!("{path};{appdata}\\npm");
  }
  cmd.env("PATH", path);
  cmd.env("PYTHONIOENCODING", "utf-8");
  cmd.env("PYTHONUTF8", "1");
  cmd.env("AGENT_REACH_LANG", "en");
  cmd.env("ORBIT_BRIDGE_CONCAT", "1");
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: no console flash behind the app
  }
  cmd
}

/// Streams NDJSON lines from the bridge as Tauri events named `bridge://<job_id>`.
/// Each event payload is the parsed line; a final `{"type":"done"|"error"|"cancelled"}` closes the job.
fn stream_bridge(app: tauri::AppHandle, job_id: String, args: Vec<String>) -> Result<(), String> {
  let script = bridge_script()?;
  let mut child = python().arg(&script).args(&args).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()
    .map_err(|e| format!("Python is not available on this machine: {e}. Install Python 3.12+ and make sure `python` is on PATH."))?;
  let stdout = child.stdout.take().ok_or("no stdout")?;
  let stderr = child.stderr.take();
  jobs().lock().map_err(|e| e.to_string())?.insert(job_id.clone(), child);
  let topic = format!("bridge://{job_id}");
  let app2 = app.clone();
  let job2 = job_id.clone();
  std::thread::spawn(move || {
    let mut saw_done = false;
    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
      if line.trim().is_empty() { continue; }
      match serde_json::from_str::<serde_json::Value>(&line) {
        Ok(v) => { if v.get("type").and_then(|t| t.as_str()) == Some("done") { saw_done = true; } let _ = app2.emit(&topic, v); }
        Err(_) => { let _ = app2.emit(&topic, serde_json::json!({ "type": "log", "line": line })); }
      }
    }
    let err_text = stderr.map(|e| BufReader::new(e).lines().map_while(Result::ok).collect::<Vec<_>>().join("
")).unwrap_or_default();
    let cancelled = jobs().lock().ok().map(|mut m| m.remove(&job2).is_none()).unwrap_or(false);
    if !saw_done {
      let payload = if cancelled { serde_json::json!({ "type": "cancelled" }) } else { serde_json::json!({ "type": "error", "fatal": true, "error": err_text.lines().last().unwrap_or("bridge exited without a result").to_string() }) };
      let _ = app2.emit(&topic, payload);
    }
  });
  Ok(())
}

/// Live Lead Finder / Market Research. Listen to `bridge://<job_id>` for progress, batches and the final export.
#[tauri::command]
fn agent_reach_stream(app: tauri::AppHandle, job_id: String, mode: String, query: String, target: Option<u32>) -> Result<(), String> {
  if query.trim().is_empty() { return Err("Enter a search query first".into()); }
  let cmd = if mode == "research" { "research-stream" } else { "leads-stream" };
  let t = target.unwrap_or(1000).clamp(10, 5000).to_string();
  stream_bridge(app, job_id, vec![cmd.into(), query.trim().into(), t])
}

/// Live enrichment (photos + published emails), one event per lead.
#[tauri::command]
fn bridge_enrich_stream(app: tauri::AppHandle, job_id: String, leads_json: String, limit: Option<u32>) -> Result<(), String> {
  let dir = std::env::temp_dir().join("orbit-bridge");
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let file = dir.join(format!("enrich-{job_id}.json"));
  std::fs::write(&file, leads_json).map_err(|e| e.to_string())?;
  stream_bridge(app, job_id, vec!["enrich-stream".into(), file.to_string_lossy().into_owned(), limit.unwrap_or(50).to_string()])
}

#[tauri::command]
fn bridge_cancel(job_id: String) -> Result<bool, String> {
  let mut m = jobs().lock().map_err(|e| e.to_string())?;
  if let Some(mut child) = m.remove(&job_id) { let _ = child.kill(); Ok(true) } else { Ok(false) }
}

fn run_bridge(args: &[&str]) -> Result<String, String> {
  let script = bridge_script()?;
  let out = python().arg(&script).args(args).output().map_err(|e| format!("Python is not available on this machine: {e}. Install Python 3.12+ and make sure `python` is on PATH."))?;
  let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
  if out.status.success() && !stdout.is_empty() {
    return Ok(stdout);
  }
  let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
  Err(if stderr.is_empty() { stdout } else { stderr.lines().last().unwrap_or(&stderr).to_string() })
}

#[tauri::command]
fn app_status() -> &'static str { "orbit-online" }

/// Structured, English health report for the research stack.
#[tauri::command]
fn bridge_doctor() -> Result<String, String> { run_bridge(&["doctor"]) }

/// Installs the Python packages the bridge needs (ddgs). Explicit user action only.
#[tauri::command]
fn bridge_setup() -> Result<String, String> { run_bridge(&["setup"]) }

/// Multi-channel web search. Returns JSON with per-channel status and normalized results.
#[tauri::command]
fn agent_reach_search(query: String, limit: Option<u32>) -> Result<String, String> {
  if query.trim().is_empty() { return Err("Enter a search query first".into()); }
  let n = limit.unwrap_or(10).to_string();
  run_bridge(&["search", query.trim(), &n])
}

/// Structured lead list (up to `target`, default 1000) from Agent Reach / Exa. Also writes an xlsx + json export.
#[tauri::command]
fn agent_reach_leads(query: String, target: Option<u32>) -> Result<String, String> {
  if query.trim().is_empty() { return Err("Enter a search query first".into()); }
  let t = target.unwrap_or(1000).clamp(10, 5000).to_string();
  run_bridge(&["leads", query.trim(), &t])
}

/// Market research: same pipeline as leads, fanned out over market-intelligence angles.
#[tauri::command]
fn agent_reach_research(query: String, target: Option<u32>) -> Result<String, String> {
  if query.trim().is_empty() { return Err("Enter a search query first".into()); }
  let t = target.unwrap_or(1000).clamp(10, 5000).to_string();
  run_bridge(&["research", query.trim(), &t])
}

/// Enrich leads with emails the company publishes on its own website (Agent Reach web channel / Jina Reader).
#[tauri::command]
fn bridge_enrich(leads_json: String, limit: Option<u32>) -> Result<String, String> {
  let dir = std::env::temp_dir().join("orbit-bridge");
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let file = dir.join(format!("enrich-{}.json", std::process::id()));
  std::fs::write(&file, leads_json).map_err(|e| e.to_string())?;
  let l = limit.unwrap_or(50).to_string();
  let res = run_bridge(&["enrich", &file.to_string_lossy(), &l]);
  let _ = std::fs::remove_file(&file);
  res
}

/// Raw Agent Reach doctor output (its messages are Chinese-only upstream; kept for debugging).
#[tauri::command]
fn agent_reach_doctor() -> Result<String, String> {
  python()
    .args(["-c", "from agent_reach.cli import main; main()", "doctor"])
    .output()
    .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
    .map_err(|e| format!("Agent Reach is not installed or unavailable: {e}"))
}

// ---------------------------------------------------------------- integrations (async: never block the UI thread)
macro_rules! blocking {
  ($e:expr) => { tauri::async_runtime::spawn_blocking(move || $e).await.map_err(|e| e.to_string())? };
}

#[tauri::command]
async fn integrations_status() -> Result<serde_json::Value, String> { Ok(blocking!(integrations::status())) }

#[tauri::command]
async fn gmail_connect(client_id: String, client_secret: String) -> Result<serde_json::Value, String> { blocking!(integrations::gmail_connect(client_id, client_secret)) }
#[tauri::command]
async fn gmail_send(to: String, subject: String, body: String) -> Result<serde_json::Value, String> { blocking!(integrations::gmail_send(to, subject, body)) }
#[tauri::command]
async fn gmail_disconnect() -> Result<(), String> { blocking!(integrations::gmail_disconnect()) }

#[tauri::command]
async fn smtp_save(host: String, port: u16, username: String, password: String, from: String, security: String) -> Result<serde_json::Value, String> { blocking!(integrations::smtp_save(host, port, username, password, from, security)) }
#[tauri::command]
async fn smtp_send(to: String, subject: String, body: String) -> Result<serde_json::Value, String> { blocking!(integrations::smtp_send(to, subject, body)) }
#[tauri::command]
async fn smtp_disconnect() -> Result<(), String> { blocking!(integrations::smtp_disconnect()) }

#[tauri::command]
async fn webhook_save(url: String, secret: String) -> Result<serde_json::Value, String> { blocking!(integrations::webhook_save(url, secret)) }
#[tauri::command]
async fn webhook_send(event: String, payload: serde_json::Value) -> Result<serde_json::Value, String> { blocking!(integrations::webhook_send(event, payload)) }
#[tauri::command]
async fn webhook_disconnect() -> Result<(), String> { blocking!(integrations::webhook_disconnect()) }

#[tauri::command]
fn provider_env_status() -> serde_json::Value {
  let keys = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "MISTRAL_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"];
  serde_json::json!(keys.iter().map(|key| (key.to_lowercase(), std::env::var(key).map(|v| !v.trim().is_empty()).unwrap_or(false))).collect::<std::collections::HashMap<_, _>>())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![app_status, bridge_doctor, bridge_setup, agent_reach_search, agent_reach_leads, agent_reach_research, bridge_enrich, agent_reach_stream, bridge_enrich_stream, bridge_cancel, agent_reach_doctor, provider_env_status, integrations_status, gmail_connect, gmail_send, gmail_disconnect, smtp_save, smtp_send, smtp_disconnect, webhook_save, webhook_send, webhook_disconnect])
    .run(tauri::generate_context!())
    .expect("error while running orbit growth os");
}
