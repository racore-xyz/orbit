mod integrations;
mod llm;
mod outreach;
mod workspace;
mod quota;

use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use tauri::Emitter;

/// Running streaming jobs, by job id, so the UI can cancel them.
fn jobs() -> &'static Mutex<HashMap<String, Child>> {
  static JOBS: OnceLock<Mutex<HashMap<String, Child>>> = OnceLock::new();
  JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Where the app's bundled tools live. In a packaged install everything sits next to the
/// executable (`orbit-bridge.exe` sidecar, `resources/` folder). In development we fall back
/// to the repo checkout via CARGO_MANIFEST_DIR.
fn exe_dir() -> std::path::PathBuf {
  std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf())).unwrap_or_else(|| ".".into())
}
fn dev_root() -> std::path::PathBuf { std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")) }
fn resource(rel: &str) -> Option<std::path::PathBuf> {
  let candidates = [exe_dir().join("resources").join(rel), exe_dir().join(rel), dev_root().join("resources").join(rel)];
  candidates.into_iter().find(|p| p.exists())
}

/// Build the bridge command: bundled sidecar first, system Python + source second.
fn bridge_cmd() -> Result<Command, String> {
  let sidecar = exe_dir().join("orbit-bridge.exe");
  let mut cmd = if sidecar.exists() {
    Command::new(sidecar)
  } else {
    let main_py = dev_root().parent().map(|r| r.join("desktop").join("bridge").join("main.py")).filter(|p| p.exists())
      .ok_or("Bridge not found: neither orbit-bridge.exe next to the app nor desktop/bridge/main.py in the repo.")?;
    let exe = std::env::var("ORBIT_PYTHON").unwrap_or_else(|_| "python".into());
    let mut c = Command::new(exe);
    c.arg(main_py);
    c
  };
  // Bundled Node + mcporter (+ Exa config) so Agent Reach web search works out of the box.
  if let (Some(node), Some(cli)) = (resource("node/node_modules/node/bin/node.exe"), resource("mcporter/node_modules/mcporter/dist/cli.js")) {
    cmd.env("ORBIT_NODE", node);
    cmd.env("ORBIT_MCPORTER_CLI", cli);
  }
  // Personal Exa key (Integrations → Agent Reach) beats the bundled free-tier config.
  let user_cfg = integrations::exa_config_path();
  if user_cfg.exists() { cmd.env("MCPORTER_CONFIG", &user_cfg); cmd.env("ORBIT_EXA_KEYED", "1"); }
  else if let Some(cfg) = resource("mcporter.json") { cmd.env("MCPORTER_CONFIG", cfg); }
  // Bundled extension CLIs (yt-dlp, twitter, rdt, xhs, ffmpeg, opencli, node, mcporter) come first on
  // PATH so Agent Reach's doctor and channels find them with nothing installed on the machine.
  let mut path = std::env::var("PATH").unwrap_or_default();
  if let Some(bin) = resource("tools/bin") { path = format!("{};{path}", bin.to_string_lossy()); }
  if let Some(node) = resource("node/node_modules/node/bin") { path = format!("{};{path}", node.to_string_lossy()); }
  if let Ok(appdata) = std::env::var("APPDATA") {
    for v in ["Python314", "Python313", "Python312"] { path = format!("{path};{appdata}\\Python\\{v}\\Scripts"); }
    path = format!("{path};{appdata}\\npm");
  }
  cmd.env("PATH", path);
  cmd.env("PYTHONIOENCODING", "utf-8");
  cmd.env("PYTHONUTF8", "1");
  cmd.env("AGENT_REACH_LANG", "en");
  // Rate-limit protection for the bridge's outbound channels (Settings → Rate limits).
  let lim = quota::limits();
  cmd.env("ORBIT_EXA_GAP_SHARED", lim.exa_gap_shared_s.to_string());
  cmd.env("ORBIT_EXA_GAP_KEYED", lim.exa_gap_keyed_s.to_string());
  cmd.env("ORBIT_JINA_GAP", lim.jina_gap_s.to_string());
  cmd.env("ORBIT_REDDIT_GAP", lim.reddit_gap_s.to_string());
  cmd.env("ORBIT_EXA_CALLS_PER_RUN", lim.exa_calls_per_run.to_string());
  cmd.env("ORBIT_ENRICH_PER_RUN", lim.enrich_per_run.to_string());
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
  }
  Ok(cmd)
}

fn run_bridge(args: &[&str]) -> Result<String, String> {
  let out = bridge_cmd()?.args(args).output().map_err(|e| format!("Could not start the research bridge: {e}"))?;
  let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
  if out.status.success() && !stdout.is_empty() {
    return Ok(stdout);
  }
  let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
  Err(if stderr.is_empty() { stdout } else { stderr.lines().last().unwrap_or(&stderr).to_string() })
}

/// Streams NDJSON lines from the bridge as Tauri events named `bridge://<job_id>`.
/// Each event payload is the parsed line; a final `{"type":"done"|"error"|"cancelled"}` closes the job.
fn stream_bridge(app: tauri::AppHandle, job_id: String, args: Vec<String>) -> Result<(), String> {
  let mut child = bridge_cmd()?.args(&args).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()
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

/// Social Media → Reddit research through Arctic Shift, streamed like the other research jobs.
#[tauri::command]
fn social_reddit_stream(app: tauri::AppHandle, job_id: String, params_json: String) -> Result<(), String> {
  let dir = std::env::temp_dir().join("orbit-bridge");
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let file = dir.join(format!("reddit-{job_id}.json"));
  std::fs::write(&file, params_json).map_err(|e| e.to_string())?;
  stream_bridge(app, job_id, vec!["reddit-stream".into(), file.to_string_lossy().into_owned()])
}

#[tauri::command]
fn bridge_cancel(job_id: String) -> Result<bool, String> {
  let mut m = jobs().lock().map_err(|e| e.to_string())?;
  if let Some(mut child) = m.remove(&job_id) { let _ = child.kill(); Ok(true) } else { Ok(false) }
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
  let mut c = Command::new(std::env::var("ORBIT_PYTHON").unwrap_or_else(|_| "python".into()));
  c.args(["-c", "from agent_reach.cli import main; main()", "doctor"])
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

// ---------------------------------------------------------------- research history (local JSON files)
fn runs_dir() -> std::path::PathBuf {
  let base = std::env::var("APPDATA").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("runs")
}

/// Save (or overwrite) a research run. `run.id` is required; the file is `<id>.json`.
#[tauri::command]
fn run_save(run: serde_json::Value) -> Result<String, String> {
  let id = run.get("id").and_then(|v| v.as_str()).filter(|s| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')).ok_or("run.id missing or invalid")?.to_string();
  let dir = runs_dir();
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  std::fs::write(dir.join(format!("{id}.json")), serde_json::to_vec(&run).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
  Ok(id)
}

pub fn run_list_values() -> Vec<serde_json::Value> {
  run_list().ok().and_then(|v| v.as_array().cloned()).unwrap_or_default()
}
pub fn run_get_value(id: &str) -> Option<serde_json::Value> { run_get(id.to_string()).ok() }

/// List saved runs (metadata only, newest first).
#[tauri::command]
fn run_list() -> Result<serde_json::Value, String> {
  let dir = runs_dir();
  let mut items = Vec::new();
  if let Ok(rd) = std::fs::read_dir(&dir) {
    for e in rd.flatten() {
      let p = e.path();
      if p.extension().and_then(|x| x.to_str()) != Some("json") { continue; }
      let Ok(text) = std::fs::read_to_string(&p) else { continue };
      let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else { continue };
      let count = v.get("leads").and_then(|l| l.as_array()).map(|a| a.len()).unwrap_or(0);
      items.push(serde_json::json!({
        "id": v.get("id"), "mode": v.get("mode"), "query": v.get("query"), "target": v.get("target"),
        "count": count, "fetched_at": v.get("fetched_at"), "saved_at": v.get("saved_at"), "enriched": v.get("enriched"),
        "export": v.get("export"), "size": text.len(),
      }));
    }
  }
  items.sort_by(|a, b| b.get("saved_at").and_then(|x| x.as_str()).unwrap_or("").cmp(a.get("saved_at").and_then(|x| x.as_str()).unwrap_or("")));
  Ok(serde_json::Value::Array(items))
}

#[tauri::command]
fn run_get(id: String) -> Result<serde_json::Value, String> {
  let p = runs_dir().join(format!("{}.json", id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').collect::<String>()));
  let text = std::fs::read_to_string(&p).map_err(|e| format!("run not found: {e}"))?;
  serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
fn run_delete(id: String) -> Result<(), String> {
  let p = runs_dir().join(format!("{}.json", id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').collect::<String>()));
  std::fs::remove_file(&p).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------- LLM providers
#[tauri::command]
async fn llm_status() -> Result<serde_json::Value, String> { Ok(blocking!(llm::status())) }
#[tauri::command]
async fn llm_set_key(provider: String, key: String) -> Result<(), String> { blocking!(llm::set_key(&provider, &key)) }
#[tauri::command]
async fn llm_set_default(provider: String, model: String) -> Result<(), String> { blocking!(llm::set_default(&provider, &model)) }
#[tauri::command]
async fn llm_test(provider: String) -> Result<String, String> { blocking!(llm::test(provider)) }
#[tauri::command]
async fn llm_complete(provider: Option<String>, model: Option<String>, system: String, prompt: String, max_tokens: Option<u32>) -> Result<String, String> { blocking!(llm::complete(provider, model, system, prompt, max_tokens.unwrap_or(800))) }

// ---------------------------------------------------------------- Outreach
#[tauri::command]
async fn outreach_state() -> Result<outreach::State, String> { Ok(blocking!(outreach::load())) }
#[tauri::command]
async fn outreach_create_campaign(name: String, thread_ids: Vec<String>, template_id: Option<String>, variant_mode: String, sequence_id: Option<String>, scheduled_at: String) -> Result<outreach::State, String> { blocking!(outreach::create_campaign(name, thread_ids, template_id, variant_mode, sequence_id, scheduled_at)) }
#[tauri::command]
async fn outreach_save(state: outreach::State) -> Result<outreach::State, String> { blocking!(outreach::save(state)) }
#[tauri::command]
async fn outreach_send(thread_id: String, subject: String, body: String, step: u32, template_id: Option<String>, variant_id: Option<String>) -> Result<outreach::Thread, String> { blocking!(outreach::send(thread_id, subject, body, step, template_id, variant_id)) }
#[tauri::command]
async fn outreach_fill(thread_id: String, template_id: Option<String>, variant_id: Option<String>) -> Result<serde_json::Value, String> { blocking!(outreach::fill_for_thread(thread_id, template_id, variant_id)) }
#[tauri::command]
async fn outreach_generate_variants(template_id: String, count: u32) -> Result<outreach::State, String> { blocking!(outreach::generate_variants(template_id, count)) }
#[tauri::command]
async fn outreach_fill_step(thread_id: String, step: u32) -> Result<serde_json::Value, String> { blocking!(outreach::fill_step(thread_id, step)) }
#[tauri::command]
async fn outreach_followup_action(thread_id: String, action: String, days: Option<u32>) -> Result<outreach::Thread, String> { blocking!(outreach::followup_action(thread_id, action, days.unwrap_or(2))) }
#[tauri::command]
fn outreach_placeholders() -> Vec<(String, String)> { outreach::PLACEHOLDERS.iter().map(|(k, d)| (k.to_string(), d.to_string())).collect() }
#[tauri::command]
async fn outreach_sync(app: tauri::AppHandle) -> Result<serde_json::Value, String> { blocking!(outreach::sync_replies(Some(app))) }
#[tauri::command]
async fn outreach_draft_reply(thread_id: String) -> Result<serde_json::Value, String> { blocking!(outreach::draft_reply(thread_id)) }
#[tauri::command]
async fn outreach_send_reply(thread_id: String, subject: String, body: String) -> Result<outreach::Thread, String> { blocking!(outreach::send_reply(thread_id, subject, body)) }
#[tauri::command]
async fn outreach_draft(thread_id: String, step: u32, instructions: Option<String>) -> Result<serde_json::Value, String> { blocking!(outreach::draft(thread_id, step, instructions)) }
#[tauri::command]
async fn outreach_learn_style(samples: Vec<String>, signature: String, language: String) -> Result<outreach::State, String> { blocking!(outreach::learn_style(samples, signature, language)) }
#[tauri::command]
async fn outreach_record_edit(draft: String, final_text: String) -> Result<(), String> { blocking!(outreach::record_edit(draft, final_text)) }
#[tauri::command]
async fn imap_save(host: String, port: u16, username: String, password: String) -> Result<serde_json::Value, String> { blocking!(integrations::imap_save(host, port, username, password)) }
#[tauri::command]
async fn imap_disconnect() -> Result<(), String> { blocking!(integrations::imap_disconnect()) }

// ---------------------------------------------------------------- Workspace
#[tauri::command]
async fn workspace_get() -> Result<serde_json::Value, String> { Ok(blocking!(workspace::summary())) }
#[tauri::command]
async fn workspace_save(workspace: workspace::Workspace) -> Result<workspace::Workspace, String> { blocking!(workspace::save(workspace)) }
#[tauri::command]
async fn workspace_log(kind: String, text: String) -> Result<(), String> { blocking!(workspace::log(kind, text)) }
#[tauri::command]
async fn workspace_delete(what: String) -> Result<String, String> { blocking!(workspace::delete(what)) }
#[tauri::command]
async fn workspace_demo_seed() -> Result<(), String> { blocking!(workspace::demo_seed()) }
#[tauri::command]
async fn workspace_demo_clear() -> Result<(), String> { blocking!(workspace::demo_clear()) }
#[tauri::command]
async fn workspace_export() -> Result<String, String> { blocking!(workspace::export()) }

// ---------------------------------------------------------------- background jobs, notifications, dashboard
fn job_flags() -> &'static Mutex<HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>> {
  static F: OnceLock<Mutex<HashMap<String, std::sync::Arc<std::sync::atomic::AtomicBool>>>> = OnceLock::new();
  F.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Start background auto-drafting for contacts without a message. Progress on `jobs://<job_id>`.
#[tauri::command]
fn outreach_autodraft_start(app: tauri::AppHandle, job_id: String, limit: Option<u32>) -> Result<(), String> {
  let flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
  job_flags().lock().map_err(|e| e.to_string())?.insert(job_id.clone(), flag.clone());
  let lim = limit.unwrap_or(50) as usize;
  std::thread::spawn(move || { outreach::autodraft_job(app, job_id.clone(), lim, flag); let _ = job_flags().lock().map(|mut m| m.remove(&job_id)); });
  Ok(())
}
#[tauri::command]
fn outreach_campaign_run(app: tauri::AppHandle, job_id: String, campaign_id: String) -> Result<(), String> {
  let flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
  job_flags().lock().map_err(|e| e.to_string())?.insert(job_id.clone(), flag.clone());
  std::thread::spawn(move || { outreach::campaign_run_job(app, job_id.clone(), campaign_id, flag); let _ = job_flags().lock().map(|mut m| m.remove(&job_id)); });
  Ok(())
}
#[tauri::command]
async fn outreach_campaign_delete(id: String) -> Result<outreach::State, String> { blocking!(outreach::campaign_delete(id)) }
#[tauri::command]
fn job_cancel(job_id: String) -> Result<bool, String> {
  Ok(job_flags().lock().map_err(|e| e.to_string())?.get(&job_id).map(|f| { f.store(true, std::sync::atomic::Ordering::Relaxed); true }).unwrap_or(false))
}
#[tauri::command]
async fn notify(app: tauri::AppHandle, kind: String, title: String, text: String, link: Option<String>) -> Result<workspace::Notification, String> { blocking!(workspace::notify(Some(&app), &kind, &title, &text, link.as_deref())) }
#[tauri::command]
async fn notifications_mark(ids: Vec<String>, read: bool, clear: Option<bool>) -> Result<usize, String> { blocking!(workspace::notifications_mark(ids, read, clear.unwrap_or(false))) }
#[tauri::command]
async fn dashboard_data() -> Result<serde_json::Value, String> { Ok(blocking!(outreach::dashboard())) }
#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn mailbox_add(id: Option<String>, label: String, kind: String, smtp_host: String, smtp_port: u16, security: String, username: String, from: String, imap_host: Option<String>, imap_port: Option<u16>, password: String, daily_cap: u32) -> Result<serde_json::Value, String> { blocking!(integrations::mailbox_add(id, label, kind, smtp_host, smtp_port, security, username, from, imap_host, imap_port, password, daily_cap)) }
#[tauri::command]
async fn mailbox_add_gmail(address: String, app_password: String, daily_cap: u32) -> Result<serde_json::Value, String> { blocking!(integrations::mailbox_add_gmail(address, app_password, daily_cap)) }
#[tauri::command]
async fn mailbox_remove(id: String) -> Result<(), String> { blocking!(integrations::mailbox_remove(id)) }
#[tauri::command]
async fn mailbox_toggle(id: String, enabled: bool) -> Result<(), String> { blocking!(integrations::mailbox_toggle(id, enabled)) }
#[tauri::command]
async fn mailbox_set_cap(id: String, cap: u32) -> Result<(), String> { blocking!(integrations::mailbox_set_cap(id, cap)) }
#[tauri::command]
async fn mailbox_test(id: String) -> Result<serde_json::Value, String> { blocking!(integrations::mailbox_test(id)) }

#[tauri::command]
async fn exa_set_key(key: String) -> Result<serde_json::Value, String> { blocking!(integrations::exa_set_key(key)) }
#[tauri::command]
async fn exa_status() -> Result<serde_json::Value, String> { Ok(blocking!(integrations::exa_status())) }
#[tauri::command]
async fn quota_status() -> Result<serde_json::Value, String> { Ok(blocking!(quota::status())) }
#[tauri::command]
async fn quota_set(limits: quota::Limits) -> Result<quota::Limits, String> { blocking!(quota::set_limits(limits)) }
#[tauri::command]
async fn llm_set_rate_limit(provider: String, rpm: u32) -> Result<(), String> { blocking!(llm::set_rate_limit(&provider, rpm)) }

#[tauri::command]
fn provider_env_status() -> serde_json::Value {
  let keys = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "MISTRAL_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY"];
  serde_json::json!(keys.iter().map(|key| (key.to_lowercase(), std::env::var(key).map(|v| !v.trim().is_empty()).unwrap_or(false))).collect::<std::collections::HashMap<_, _>>())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![app_status, bridge_doctor, bridge_setup, agent_reach_search, agent_reach_leads, agent_reach_research, bridge_enrich, agent_reach_stream, bridge_enrich_stream, social_reddit_stream, bridge_cancel, run_save, run_list, run_get, run_delete, agent_reach_doctor, provider_env_status, integrations_status, smtp_save, smtp_send, smtp_disconnect, webhook_save, webhook_send, webhook_disconnect, llm_status, llm_set_key, llm_set_default, llm_test, llm_complete, outreach_state, outreach_create_campaign, outreach_save, outreach_send, outreach_fill, outreach_generate_variants, outreach_placeholders, outreach_fill_step, outreach_followup_action, outreach_sync, outreach_draft_reply, outreach_send_reply, outreach_draft, outreach_learn_style, outreach_record_edit, imap_save, imap_disconnect, workspace_get, workspace_save, workspace_log, workspace_delete, workspace_export, workspace_demo_seed, workspace_demo_clear, outreach_autodraft_start, outreach_campaign_run, outreach_campaign_delete, job_cancel, notify, notifications_mark, dashboard_data, llm_set_rate_limit, exa_set_key, exa_status, quota_status, quota_set, mailbox_add, mailbox_add_gmail, mailbox_remove, mailbox_toggle, mailbox_set_cap, mailbox_test])
    .run(tauri::generate_context!())
    .expect("error while running orbit growth os");
}
