//! Job-seeking mode: résumé ATS review, per-company tailoring, cover letters,
//! applications tracking with follow-ups, and hiring-demand aggregation for the map.
//! State in %APPDATA%\orbit\jobs.json. Job search runs through the Agent Reach bridge (Exa).

use crate::integrations;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Emitter;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct FollowUp { pub at: String, pub done: bool }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct AppMsg { pub id: String, pub direction: String, pub subject: String, pub body: String, pub at: String, pub attachments: Vec<String> }

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
  #[serde(default)]
  pub messages: Vec<AppMsg>,
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
    tailored_resume: String::new(), cover_letter: String::new(), applied_at: None, follow_ups: Vec::new(), notes: String::new(), created_at: integrations::now_iso(), messages: Vec::new(),
  });
  save(s)
}

/// Add many postings at once (Select all → pipeline). Skips URLs already in the pipeline.
pub fn applications_add_bulk(items: serde_json::Value) -> Result<JobsState, String> {
  let mut s = load();
  let mut n = 0usize;
  for it in items.as_array().cloned().unwrap_or_default() {
    let url = it.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string();
    if !url.is_empty() && s.applications.iter().any(|a| a.url == url) { continue; }
    let g = |k: &str| it.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
    s.applications.insert(0, Application {
      id: format!("app-{}-{n}", integrations::now_iso().replace(['-', ':', 'T', 'Z'], "")),
      company: g("company"), role: g("role"), location: g("location"), country: g("country"), url, source: g("source"),
      status: "saved".into(), job_desc: g("snippet"), contact_email: it.get("contact_email").and_then(|v| v.as_str()).filter(|x| !x.is_empty()).map(|x| x.to_string()),
      tailored_resume: String::new(), cover_letter: String::new(), applied_at: None, follow_ups: Vec::new(), notes: String::new(), created_at: integrations::now_iso(), messages: Vec::new(),
    });
    n += 1;
  }
  save(s)
}

/// Draft a concise application email (subject + body) for one posting, from the cover letter / base résumé.
pub fn outreach_draft(id: String) -> Result<serde_json::Value, String> {
  let s = load();
  let app = s.applications.iter().find(|a| a.id == id).ok_or("application not found")?.clone();
  let ws = crate::workspace::load().profile;
  let lang = if ws.language == "ar" { "Arabic" } else { "English" };
  let base = if !app.cover_letter.trim().is_empty() { app.cover_letter.clone() } else if !ws.offer.trim().is_empty() { ws.offer.clone() } else { app.job_desc.clone() };
  let system = format!("You write a concise, warm job-application email in {lang} from the candidate to the hiring team. 4-6 short sentences: greet, name the role you're applying for, 2-3 lines on why you fit (from the material), note that your résumé and cover letter are attached, and end with a clear ask for a conversation. Plain text only. Output exactly:\nSubject: <subject>\n\n<body>");
  let user = format!("CANDIDATE: {name}\nROLE: {role} at {company} ({loc})\n\nMATERIAL:\n{base}", name = ws.name, role = app.role, company = app.company, loc = app.location);
  let text = crate::llm::complete(None, None, system, user, 550)?;
  let (subject, body) = crate::outreach::split_subject(&text);
  let subject = if subject.trim().is_empty() { format!("Application: {} — {}", app.role, ws.name) } else { subject };
  Ok(serde_json::json!({ "subject": subject, "body": body }))
}

/// Send the application email with résumé + cover-letter attachments, record it and mark applied.
#[allow(clippy::too_many_arguments)]
pub fn outreach_send(id: String, subject: String, body: String, resume_docx: Vec<u8>, resume_name: String, cover_docx: Vec<u8>, cover_name: String) -> Result<JobsState, String> {
  let s = load();
  let app = s.applications.iter().find(|a| a.id == id).ok_or("application not found")?.clone();
  let to = app.contact_email.clone().filter(|e| e.contains('@')).ok_or("Add a contact email for this application first (the hiring/careers address).")?;
  crate::quota::gate_send()?;
  let mb = integrations::next_mailbox()?;
  let mut atts: Vec<(String, Vec<u8>)> = Vec::new();
  if !resume_docx.is_empty() { atts.push((if resume_name.trim().is_empty() { "resume.docx".into() } else { resume_name }, resume_docx)); }
  if !cover_docx.is_empty() { atts.push((if cover_name.trim().is_empty() { "cover_letter.docx".into() } else { cover_name }, cover_docx)); }
  let names: Vec<String> = atts.iter().map(|(n, _)| n.clone()).collect();
  integrations::send_via_mailbox_attach(&mb.id, to.clone(), subject.clone(), body.clone(), None, atts)?;
  crate::quota::record_send();
  let now = integrations::now_iso();
  let mut s = load();
  let (max, days) = (s.settings.follow_up_max, s.settings.follow_up_days);
  let start = crate::outreach::parse_iso(&now).unwrap_or(0);
  if let Some(a) = s.applications.iter_mut().find(|a| a.id == id) {
    a.messages.push(AppMsg { id: format!("m-{}", a.messages.len() + 1), direction: "out".into(), subject, body, at: now.clone(), attachments: names });
    a.status = "applied".into();
    a.applied_at = Some(now.clone());
    if a.follow_ups.is_empty() { a.follow_ups = (1..=max).map(|k| FollowUp { at: integrations::iso_from_secs(start + (k * days) as u64 * 86400), done: false }).collect(); }
  }
  let _ = crate::workspace::log("outreach".into(), format!("Application email sent to {to}"));
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

/// Live ATS rewrite of the résumé, streaming deltas on `resume://<job_id>` so the UI can show
/// the new version being written in real time. Emits {type:"delta"|"done"|"error"|"cancelled"}.
pub fn improve_job(app: tauri::AppHandle, job_id: String, resume: String, target_role: String, flag: Arc<AtomicBool>) {
  let topic = format!("resume://{job_id}");
  let ws = crate::workspace::load().profile;
  let lang = if ws.language == "ar" { "Arabic" } else { "English" };
  let role = if target_role.trim().is_empty() { ws.target_roles.clone() } else { target_role };
  let system = format!("You are an expert résumé writer and ATS (applicant tracking system) specialist. Rewrite the candidate's résumé so it parses cleanly through ATS and reads strongly for the target role, in {lang}.\nRules: keep every real fact — employers, titles, dates, tools, and metrics — and NEVER invent anything; turn duty statements into achievement bullets with a metric wherever the source has one; mirror the target role's keywords naturally.\nOUTPUT FORMAT — Markdown that mirrors the original's structure:\n- Section titles as '## HEADING' (e.g. ## SUMMARY, ## EXPERIENCE, ## SKILLS, ## EDUCATION, ## PROJECTS).\n- Put a line with only '---' between major sections, matching the original's separators.\n- Bullet points as '- ' lines. Use '**bold**' for job titles / company names / key terms as the source does.\n- PRESERVE every hyperlink, email and URL from the source EXACTLY, as Markdown links '[label](url)' (emails as '[email](mailto:email)'). Never drop or alter a link.\nNo tables, columns, or graphics. Output ONLY the finished résumé in Markdown, with no preamble or commentary.");
  let user = format!("TARGET ROLE: {role}\n\nCURRENT RÉSUMÉ:\n{resume}");
  let app_ref = app.clone();
  let topic_ref = topic.clone();
  let flag_ref = flag.clone();
  let result = crate::llm::complete_stream(None, None, system, user, 2400, move |piece| {
    if flag_ref.load(Ordering::Relaxed) { return; }
    let _ = app_ref.emit(&topic_ref, serde_json::json!({ "type": "delta", "text": piece }));
  });
  if flag.load(Ordering::Relaxed) { let _ = app.emit(&topic, serde_json::json!({ "type": "cancelled" })); return; }
  match result {
    Ok(text) => { let _ = app.emit(&topic, serde_json::json!({ "type": "done", "text": text })); let _ = crate::workspace::log("workspace".into(), "Résumé rewritten (ATS)".into()); }
    Err(e) => { let _ = app.emit(&topic, serde_json::json!({ "type": "error", "fatal": true, "error": e })); }
  }
}

/// Extract a clean, structured breakdown of one job posting (overview, responsibilities,
/// requirements, benefits, details) as Markdown, from its title/company/snippet.
pub fn analyze(title: String, company: String, snippet: String) -> Result<String, String> {
  if snippet.trim().len() < 20 && title.trim().is_empty() { return Err("Not enough text to analyze this posting.".into()); }
  let ws = crate::workspace::load().profile;
  let lang = if ws.language == "ar" { "Arabic" } else { "English" };
  let system = format!("You extract a clean, structured summary of a job posting into Markdown, in {lang}. From the title and posting text, output these sections using '## ' headings, and OMIT any section you genuinely cannot infer from the text: Overview (1-2 lines), Responsibilities (bullets), Requirements (bullets), Nice to have (bullets), Benefits (bullets), Details (a bullet list covering Employment type, Work mode, Seniority, Salary, and Location when present). Stay faithful to the text — never invent a salary or benefits that are not stated or clearly implied. Be concise.");
  let user = format!("TITLE: {title}\nCOMPANY: {company}\n\nPOSTING TEXT:\n{snippet}");
  crate::llm::complete(None, None, system, user, 900)
}

/// Write bytes (e.g. a generated .docx) to the user's Downloads folder and open them, returning the path.
pub fn save_download(app: &tauri::AppHandle, name: String, bytes: Vec<u8>) -> Result<String, String> {
  let base = std::env::var("USERPROFILE").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  let dir = base.join("Downloads");
  std::fs::create_dir_all(&dir).ok();
  let safe: String = name.chars().map(|c| if c.is_alphanumeric() || matches!(c, '.' | '-' | '_') { c } else { '_' }).collect();
  let file = if safe.trim_matches('_').is_empty() { "orbit-resume.docx".to_string() } else { safe };
  let path = dir.join(&file);
  std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
  let p = path.to_string_lossy().to_string();
  use tauri_plugin_opener::OpenerExt;
  let _ = app.opener().open_path(p.clone(), None::<&str>);
  Ok(p)
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
