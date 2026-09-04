//! Workspace: the user's profile, onboarding state, progress and activity log.
//! Stored in %APPDATA%\orbit\workspace.json. `summary()` derives live progress from the
//! other stores (research runs, outreach, integrations, LLM keys) so the dashboard is real.

use crate::{integrations, llm, outreach};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Profile {
  pub name: String,
  pub company: String,
  pub role: String,
  pub website: String,
  pub email: String,
  pub industry: String,
  pub target_market: String,
  pub persona: String,
  pub offer: String,
  pub goals: String,
  pub language: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Onboarding { pub completed: bool, pub step: u32, pub completed_at: Option<String>, pub skipped_connect: bool }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Activity { pub at: String, pub kind: String, pub text: String }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Workspace {
  pub id: String,
  pub created_at: String,
  pub updated_at: String,
  pub profile: Profile,
  pub onboarding: Onboarding,
  pub activity: Vec<Activity>,
  #[serde(default)]
  pub notes: String,
}

fn dir() -> std::path::PathBuf {
  let base = std::env::var("APPDATA").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit")
}
fn path() -> std::path::PathBuf { dir().join("workspace.json") }

pub fn load() -> Workspace {
  let mut w: Workspace = std::fs::read_to_string(path()).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
  if w.id.is_empty() {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    w.id = format!("WS-{:X}", secs);
    w.created_at = integrations::now_iso();
  }
  if w.profile.language.is_empty() { w.profile.language = "en".into(); }
  w
}

pub fn save(mut w: Workspace) -> Result<Workspace, String> {
  w.updated_at = integrations::now_iso();
  if w.activity.len() > 300 { let n = w.activity.len() - 300; w.activity.drain(0..n); }
  std::fs::create_dir_all(dir()).map_err(|e| e.to_string())?;
  std::fs::write(path(), serde_json::to_vec_pretty(&w).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
  Ok(w)
}

pub fn log(kind: String, text: String) -> Result<(), String> {
  let mut w = load();
  w.activity.push(Activity { at: integrations::now_iso(), kind, text });
  save(w).map(|_| ())
}

/// Live progress across every store, for the dashboard and the workspace page.
pub fn summary() -> serde_json::Value {
  let w = load();
  let runs = crate::run_list_values();
  let leads_total: usize = runs.iter().filter_map(|r| r.get("count").and_then(|c| c.as_u64())).sum::<u64>() as usize;
  let research_runs = runs.iter().filter(|r| r.get("mode").and_then(|m| m.as_str()) == Some("research")).count();
  let lead_runs = runs.len() - research_runs;
  let o = outreach::load();
  let sent = o.threads.iter().filter(|t| t.messages.iter().any(|m| m.direction == "out")).count();
  let replied = o.threads.iter().filter(|t| t.status == "replied").count();
  let followups: u32 = o.threads.iter().map(|t| t.followup_count).sum();
  let integ = integrations::status();
  let llm_st = llm::status();
  let llm_ok = llm_st.get("providers").and_then(|p| p.as_array()).map(|a| a.iter().any(|p| p.get("configured").and_then(|c| c.as_bool()).unwrap_or(false))).unwrap_or(false);
  let smtp_ok = integ.pointer("/smtp/connected").and_then(|v| v.as_bool()).unwrap_or(false);
  let imap_ok = integ.pointer("/imap/connected").and_then(|v| v.as_bool()).unwrap_or(false);
  let checklist = vec![
    ("profile", "Complete your profile", w.onboarding.completed),
    ("email", "Connect email (Gmail app password or SMTP)", smtp_ok),
    ("inbox", "Connect inbox for replies (IMAP)", imap_ok),
    ("llm", "Add an LLM API key", llm_ok),
    ("style", "Teach the model your writing style", !o.style.guide.is_empty()),
    ("leads", "Run your first Lead Finder search", lead_runs > 0),
    ("research", "Run your first Market Research", research_runs > 0),
    ("outreach", "Send your first outreach email", sent > 0),
    ("reply", "Get your first reply", replied > 0),
  ];
  let done = checklist.iter().filter(|c| c.2).count();
  let files: Vec<serde_json::Value> = ["workspace.json", "integrations.json", "llm.json", "outreach.json", "runs"].iter().map(|f| { let p = dir().join(f); serde_json::json!({ "name": f, "exists": p.exists(), "size": std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0) }) }).collect();
  let storage_dir = dir().to_string_lossy().into_owned();
  let percent = done * 100 / checklist.len();
  let checklist_json: Vec<serde_json::Value> = checklist.iter().map(|c| serde_json::json!({ "id": c.0, "label": c.1, "done": c.2 })).collect();
  let drafts = o.threads.iter().filter(|t| t.status == "draft").count();
  let webhook = integ.pointer("/webhook/connected").and_then(|v| v.as_bool()).unwrap_or(false);
  let style_learned = !o.style.guide.is_empty();
  let style_edits = o.style.learned.len();
  let contacts = o.threads.len();
  let runs_n = runs.len();
  serde_json::json!({
    "workspace": w,
    "progress": {
      "percent": percent,
      "checklist": checklist_json,
      "runs": runs_n, "lead_runs": lead_runs, "research_runs": research_runs, "leads_total": leads_total,
      "contacts": contacts, "sent": sent, "followups": followups, "replied": replied, "drafts": drafts,
      "style_learned": style_learned, "style_edits": style_edits,
      "smtp": smtp_ok, "imap": imap_ok, "llm": llm_ok, "webhook": webhook,
    },
    "storage": { "dir": storage_dir, "files": files }
  })
}

/// Delete one category of data. `what`: runs | outreach | style | llm | integrations | activity | all
pub fn delete(what: String) -> Result<String, String> {
  let d = dir();
  match what.as_str() {
    "runs" => { let _ = std::fs::remove_dir_all(d.join("runs")); Ok("Research history deleted".into()) }
    "outreach" => { let mut o = outreach::load(); o.threads.clear(); outreach::save(o)?; Ok("Outreach conversations deleted".into()) }
    "style" => { let mut o = outreach::load(); o.style = Default::default(); o.style.language = "en".into(); outreach::save(o)?; Ok("Writing style reset".into()) }
    "sequences" => { let mut o = outreach::load(); o.sequences.clear(); outreach::save(o)?; Ok("Sequences reset to default".into()) }
    "llm" => { for p in llm::PROVIDERS { let _ = llm::set_key(p.id, ""); } let _ = std::fs::remove_file(d.join("llm.json")); Ok("LLM keys removed".into()) }
    "integrations" => { let _ = integrations::smtp_disconnect(); let _ = integrations::imap_disconnect(); let _ = integrations::webhook_disconnect(); Ok("Integrations disconnected".into()) }
    "activity" => { let mut w = load(); w.activity.clear(); save(w)?; Ok("Activity log cleared".into()) }
    "all" => {
      let _ = delete("runs".into()); let _ = delete("llm".into()); let _ = delete("integrations".into());
      let _ = std::fs::remove_file(d.join("outreach.json"));
      let _ = std::fs::remove_file(d.join("workspace.json"));
      Ok("Workspace reset. All local data and stored secrets were removed.".into())
    }
    _ => Err(format!("unknown data set {what}")),
  }
}

/// Bundle everything (no secrets) into one JSON file in Documents/orbit for backup or migration.
pub fn export() -> Result<String, String> {
  let folder = std::path::PathBuf::from(std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into())).join("Documents").join("orbit");
  std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
  let stamp = integrations::now_iso().replace([':', '-'], "").replace('T', "-").trim_end_matches('Z').to_string();
  let p = folder.join(format!("orbit-workspace-{stamp}.json"));
  let bundle = serde_json::json!({ "workspace": load(), "outreach": outreach::load(), "runs": crate::run_list_values().iter().filter_map(|r| r.get("id").and_then(|i| i.as_str()).and_then(|id| crate::run_get_value(id))).collect::<Vec<_>>(), "exported_at": integrations::now_iso() });
  std::fs::write(&p, serde_json::to_vec_pretty(&bundle).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
  Ok(p.to_string_lossy().into_owned())
}
