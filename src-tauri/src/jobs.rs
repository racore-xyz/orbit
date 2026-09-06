//! Job-seeking mode: résumé ATS review, per-company tailoring, cover letters,
//! applications tracking with follow-ups, and hiring-demand aggregation for the map.
//! State in %APPDATA%\orbit\jobs.json. Job search runs through the Agent Reach bridge (Exa).

use crate::integrations;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct FollowUp { pub at: String, pub done: bool }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Application {
  pub id: String,
  pub company: String,
  pub role: String,
  pub location: String,
  pub country: String,
  pub url: String,
  pub source: String,
  pub status: String, // saved | tailored | applied | replied | closed
  pub job_desc: String,
  pub contact_email: Option<String>,
  pub tailored_resume: String,
  pub cover_letter: String,
  pub applied_at: Option<String>,
  pub follow_ups: Vec<FollowUp>,
  pub notes: String,
  pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Settings { pub follow_up_max: u32, pub follow_up_days: u32 }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct JobsState { pub applications: Vec<Application>, pub settings: Settings }

fn path() -> std::path::PathBuf {
  let base = std::env::var("APPDATA").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("jobs.json")
}

pub fn load() -> JobsState {
  let mut s: JobsState = std::fs::read_to_string(path()).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
  if s.settings.follow_up_max == 0 { s.settings.follow_up_max = 2; }
  if s.settings.follow_up_days == 0 { s.settings.follow_up_days = 4; }
  s
}

pub fn save(s: JobsState) -> Result<JobsState, String> {
  let p = path();
  if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
  std::fs::write(&p, serde_json::to_vec_pretty(&s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
  Ok(s)
}

pub fn state() -> JobsState { load() }

pub fn save_state(s: JobsState) -> Result<JobsState, String> { save(s) }

/// Add one job posting to the pipeline (from the Job Finder or manually).
#[allow(clippy::too_many_arguments)]
pub fn application_add(company: String, role: String, location: String, country: String, url: String, source: String, job_desc: String, contact_email: Option<String>) -> Result<JobsState, String> {
  let mut s = load();
  let id = format!("app-{}", integrations::now_iso().replace(['-', ':', 'T', 'Z'], ""));
  if s.applications.iter().any(|a| a.url == url && !url.is_empty()) { return Err("This job is already in your pipeline".into()); }
  s.applications.insert(0, Application {
    id, company, role, location, country, url, source, status: "saved".into(), job_desc, contact_email,
    tailored_resume: String::new(), cover_letter: String::new(), applied_at: None, follow_ups: Vec::new(), notes: String::new(), created_at: integrations::now_iso(),
  });
  save(s)
}

pub fn application_delete(id: String) -> Result<JobsState, String> {
  let mut s = load();
  s.applications.retain(|a| a.id != id);
  save(s)
}

/// Update editable fields / status of one application.
pub fn application_update(id: String, patch: serde_json::Value) -> Result<JobsState, String> {
  let mut s = load();
  if let Some(a) = s.applications.iter_mut().find(|a| a.id == id) {
    if let Some(v) = patch.get("status").and_then(|v| v.as_str()) { a.status = v.into(); }
    if let Some(v) = patch.get("notes").and_then(|v| v.as_str()) { a.notes = v.into(); }
    if let Some(v) = patch.get("tailored_resume").and_then(|v| v.as_str()) { a.tailored_resume = v.into(); }
    if let Some(v) = patch.get("cover_letter").and_then(|v| v.as_str()) { a.cover_letter = v.into(); }
    if let Some(v) = patch.get("job_desc").and_then(|v| v.as_str()) { a.job_desc = v.into(); }
    if let Some(v) = patch.get("contact_email").and_then(|v| v.as_str()) { a.contact_email = Some(v.into()); }
  }
  save(s)
}

/// Mark applied and schedule the user's follow-ups.
pub fn application_mark_applied(id: String) -> Result<JobsState, String> {
  let mut s = load();
  let (max, days) = (s.settings.follow_up_max, s.settings.follow_up_days);
  let now = integrations::now_iso();
  let base = integrations::iso_from_secs;
  let start = crate::outreach::parse_iso(&now).unwrap_or(0);
  if let Some(a) = s.applications.iter_mut().find(|a| a.id == id) {
    a.status = "applied".into();
    a.applied_at = Some(now.clone());
    a.follow_ups = (1..=max).map(|k| FollowUp { at: base(start + (k * days) as u64 * 86400), done: false }).collect();
  }
  save(s)
}

pub fn set_settings(follow_up_max: u32, follow_up_days: u32) -> Result<JobsState, String> {
  let mut s = load();
  s.settings = Settings { follow_up_max: follow_up_max.clamp(0, 5), follow_up_days: follow_up_days.max(1) };
  save(s)
}

// ---------------------------------------------------------------- LLM: résumé review, tailoring, cover letter
/// ATS + recruiter review of the résumé for a target role. Returns a Markdown report.
pub fn review_resume(resume: String, target_role: String) -> Result<String, String> {
  if resume.trim().len() < 80 { return Err("Paste your résumé text first (at least a few lines).".into()); }
  let ws = crate::workspace::load().profile;
  let lang = if ws.language == "ar" { "Arabic" } else { "English" };
  let system = format!("You are an expert technical recruiter and ATS (applicant tracking system) analyst. Review the résumé for the target role and produce a Markdown report in {lang} with: 1) ATS compatibility score out of 100 with the specific reasons, 2) Missing keywords the ATS and recruiters expect for this role, 3) Formatting/parse risks (tables, columns, headers, graphics, dates), 4) Section-by-section fixes with concrete rewrites of weak bullet points into achievement + metric form, 5) A prioritized checklist. Be specific and reference the résumé's own wording.");
  let user = format!("TARGET ROLE: {target_role}\n\nRÉSUMÉ:\n{resume}");
  crate::llm::complete(None, None, system, user, 1600)
}

/// Tailor the résumé + write a cover letter for one application, using the base résumé and portfolio.
pub fn tailor(id: String) -> Result<JobsState, String> {
  let s = load();
  let app = s.applications.iter().find(|a| a.id == id).ok_or("application not found")?.clone();
  let ws = crate::workspace::load().profile;
  let resume = ws.offer.clone();       // base résumé stored in profile.offer
  let portfolio = ws.persona.clone();  // portfolio stored in profile.persona
  if resume.trim().len() < 40 { return Err("Add your base résumé under Resume first.".into()); }
  let lang = if ws.language == "ar" { "Arabic" } else { "English" };
  let system = format!("You tailor a candidate's résumé and write a cover letter for a specific job, in {lang}. Use ONLY facts present in their base résumé and portfolio; never invent employers, titles, or metrics. Mirror the job's language and keywords for ATS. Output EXACTLY two sections:\n=== RESUME ===\n<a tailored résumé: a 2-3 line summary aligned to this role, then 5-7 achievement bullets reordered/rephrased to match the job, each with a metric where the base résumé has one>\n=== COVER ===\n<a concise 150-200 word cover letter addressed to {company}, connecting the candidate's real experience to this role, ending with a clear call to interview>", company = app.company);
  let user = format!("CANDIDATE: {name}\nTARGET ROLE: {role} at {company} ({loc})\n\nJOB DESCRIPTION:\n{jd}\n\nBASE RÉSUMÉ:\n{resume}\n\nPORTFOLIO / PROJECTS:\n{portfolio}",
    name = ws.name, role = app.role, company = app.company, loc = app.location, jd = if app.job_desc.trim().is_empty() { "(not provided; infer from the role title)".into() } else { app.job_desc.clone() });
  let text = crate::llm::complete(None, None, system, user, 1800)?;
  let (resume_out, cover_out) = split_sections(&text);
  let mut s = load();
  if let Some(a) = s.applications.iter_mut().find(|a| a.id == id) {
    a.tailored_resume = resume_out;
    a.cover_letter = cover_out;
    if a.status == "saved" { a.status = "tailored".into(); }
  }
  save(s)
}

fn split_sections(text: &str) -> (String, String) {
  let up = text.to_uppercase();
  let (rp, cp) = (up.find("=== RESUME"), up.find("=== COVER"));
  match (rp, cp) {
    (Some(r), Some(c)) if c > r => {
      let resume = text[r..c].splitn(2, '\n').nth(1).unwrap_or("").trim().to_string();
      let cover = text[c..].splitn(2, '\n').nth(1).unwrap_or("").trim().to_string();
      (resume, cover)
    }
    _ => (text.trim().to_string(), String::new()),
  }
}

/// Hiring demand per country, aggregated from the current pipeline, for the world map.
pub fn demand() -> serde_json::Value {
  let s = load();
  let mut by_country: std::collections::BTreeMap<String, usize> = Default::default();
  for a in &s.applications {
    let c = if a.country.is_empty() { "Unknown".to_string() } else { a.country.clone() };
    *by_country.entry(c).or_default() += 1;
  }
  serde_json::json!(by_country.into_iter().map(|(country, n)| serde_json::json!({ "country": country, "count": n })).collect::<Vec<_>>())
}
