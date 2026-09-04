//! Outreach: threads, sequences, writing style, sending, follow-ups and reply sync.
//! State lives in %APPDATA%\orbit\outreach.json (no secrets). Sending goes through SMTP
//! (Gmail works through smtp.gmail.com with an app password), replies come from IMAP; every send is triggered by the UI (a click or the user's
//! opted-in auto follow-up loop).

use crate::integrations;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Msg {
  pub id: String,
  pub direction: String, // out | in
  pub subject: String,
  pub body: String,
  pub at: String,
  pub provider: Option<String>,
  pub step: u32,
  pub external_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Thread {
  pub id: String,
  pub lead_id: Option<String>,
  pub name: String,
  pub company: Option<String>,
  pub email: String,
  pub status: String, // draft | sent | followup_due | replied | closed | bounced
  pub messages: Vec<Msg>,
  pub followup_count: u32,
  pub max_followups: u32,
  pub interval_days: u32,
  pub next_followup_at: Option<String>,
  pub last_activity: String,
  pub sequence_id: Option<String>,
  pub lead: Option<serde_json::Value>,
  pub notes: Option<String>,
  pub unread: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Step { pub delay_days: u32, pub subject: String, pub body: String }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Sequence { pub id: String, pub name: String, pub steps: Vec<Step> }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Learned { pub draft: String, pub final_text: String, pub at: String }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Style { pub samples: Vec<String>, pub guide: String, pub signature: String, pub learned: Vec<Learned>, pub language: String }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Settings { pub send_via: String, pub auto_followup: bool, pub default_max_followups: u32, pub default_interval_days: u32 }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct State { pub threads: Vec<Thread>, pub sequences: Vec<Sequence>, pub style: Style, pub settings: Settings, pub updated_at: String }

fn path() -> std::path::PathBuf {
  let base = std::env::var("APPDATA").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("outreach.json")
}

pub fn load() -> State {
  let mut s: State = std::fs::read_to_string(path()).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
  s.settings.send_via = "smtp".into();
  if s.settings.default_max_followups == 0 { s.settings.default_max_followups = 3; }
  if s.settings.default_interval_days == 0 { s.settings.default_interval_days = 3; }
  if s.sequences.is_empty() {
    s.sequences.push(Sequence { id: "default".into(), name: "Default sequence".into(), steps: vec![
      Step { delay_days: 0, subject: "Quick question about {{company}}".into(), body: "Hi {{first_name}},\n\n{{opener}}\n\n{{value}}\n\n{{cta}}\n\n{{signature}}".into() },
      Step { delay_days: 3, subject: "Re: Quick question about {{company}}".into(), body: "Hi {{first_name}},\n\nFollowing up on my note below in case it got buried. {{value_short}}\n\n{{cta}}\n\n{{signature}}".into() },
      Step { delay_days: 4, subject: "Re: Quick question about {{company}}".into(), body: "Hi {{first_name}},\n\nOne more try. If this isn't a priority right now, no problem at all, just let me know and I'll close the loop.\n\n{{signature}}".into() },
      Step { delay_days: 7, subject: "Re: Quick question about {{company}}".into(), body: "Hi {{first_name}},\n\nClosing the loop on this. If it becomes relevant later, I'm one reply away.\n\n{{signature}}".into() },
    ] });
  }
  if s.style.language.is_empty() { s.style.language = "en".into(); }
  s
}

pub fn save(mut s: State) -> Result<State, String> {
  s.updated_at = integrations::now_iso();
  let p = path();
  if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
  std::fs::write(&p, serde_json::to_vec_pretty(&s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
  Ok(s)
}

fn add_days(iso: &str, days: u32) -> String {
  // ISO "YYYY-MM-DDTHH:MM:SSZ" -> +days (UTC), enough for scheduling.
  let secs = parse_iso(iso).unwrap_or(0) + days as u64 * 86400;
  integrations::iso_from_secs(secs)
}
pub fn parse_iso(iso: &str) -> Option<u64> {
  let b = iso.as_bytes();
  if b.len() < 19 { return None; }
  let n = |a: usize, l: usize| iso.get(a..a + l)?.parse::<u64>().ok();
  let (y, m, d, hh, mm, ss) = (n(0, 4)?, n(5, 2)?, n(8, 2)?, n(11, 2)?, n(14, 2)?, n(17, 2)?);
  Some(integrations::days_from_civil(y as i64, m as u32, d as u32) as u64 * 86400 + hh * 3600 + mm * 60 + ss)
}

/// Send one message on a thread through the configured provider and record it.
pub fn send(thread_id: String, subject: String, body: String, step: u32) -> Result<Thread, String> {
  let mut st = load();
  let via = st.settings.send_via.clone();
  let idx = st.threads.iter().position(|t| t.id == thread_id).ok_or("thread not found")?;
  let to = st.threads[idx].email.clone();
  if to.trim().is_empty() { return Err("This contact has no email address. Enrich the lead first.".into()); }
  let res = integrations::smtp_send(to.clone(), subject.clone(), body.clone())?;
  let now = integrations::now_iso();
  let t = &mut st.threads[idx];
  t.messages.push(Msg { id: format!("m-{}", t.messages.len() + 1), direction: "out".into(), subject, body, at: now.clone(), provider: Some(via), step, external_id: res.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()) });
  if step > 1 { t.followup_count = step - 1; }
  t.last_activity = now.clone();
  t.unread = false;
  let seq = st.sequences.iter().find(|s| Some(&s.id) == t.sequence_id.as_ref()).cloned();
  let next_delay = seq.as_ref().and_then(|s| s.steps.get(step as usize)).map(|s| s.delay_days).unwrap_or(t.interval_days.max(1));
  if t.followup_count < t.max_followups { t.next_followup_at = Some(add_days(&now, next_delay)); t.status = "sent".into(); } else { t.next_followup_at = None; t.status = "sent".into(); }
  let out = t.clone();
  save(st)?;
  Ok(out)
}

/// Pull replies from the mailbox (Gmail API when connected, IMAP for SMTP accounts) and mark threads replied.
pub fn sync_replies() -> Result<serde_json::Value, String> {
  let mut st = load();
  let mut found = 0;
  let mut log = Vec::new();
  let cfg = integrations::load();
  if cfg.imap.host.is_none() { return Err("No inbox to check: configure IMAP under Integrations (Gmail preset or SMTP → Inbox).".into()); }
  for t in st.threads.iter_mut() {
    if t.status == "closed" || t.messages.iter().all(|m| m.direction != "out") { continue; }
    let since = t.messages.iter().filter(|m| m.direction == "out").map(|m| m.at.clone()).min().unwrap_or_default();
    let known: Vec<String> = t.messages.iter().filter_map(|m| m.external_id.clone()).collect();
    let replies = integrations::imap_replies_from(&t.email, &since);
    match replies {
      Ok(list) => {
        for r in list {
          let ext = r.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
          if !ext.is_empty() && known.contains(&ext) { continue; }
          t.messages.push(Msg { id: format!("m-{}", t.messages.len() + 1), direction: "in".into(), subject: r.get("subject").and_then(|v| v.as_str()).unwrap_or("").into(), body: r.get("body").and_then(|v| v.as_str()).unwrap_or("").into(), at: r.get("at").and_then(|v| v.as_str()).unwrap_or("").into(), provider: None, step: 0, external_id: Some(ext) });
          t.status = "replied".into();
          t.next_followup_at = None;
          t.unread = true;
          t.last_activity = integrations::now_iso();
          found += 1;
        }
      }
      Err(e) => log.push(format!("{}: {e}", t.email)),
    }
  }
  save(st)?;
  Ok(serde_json::json!({ "found": found, "errors": log }))
}

/// Threads whose next follow-up is due (status sent, not replied, under the cap).
#[allow(dead_code)]
pub fn due(st: &State) -> Vec<String> {
  let now = integrations::now_iso();
  st.threads.iter().filter(|t| t.status == "sent" && t.followup_count < t.max_followups && t.next_followup_at.as_deref().map(|n| n <= now.as_str()).unwrap_or(false)).map(|t| t.id.clone()).collect()
}

// ---------------------------------------------------------------- drafting with the user's style
pub fn style_prompt(st: &State) -> String {
  let mut p = String::from("You write cold outreach emails on behalf of the user. Match the user's personal writing style exactly.\n");
  if !st.style.guide.is_empty() { p.push_str("\nSTYLE GUIDE (learned from the user):\n"); p.push_str(&st.style.guide); p.push('\n'); }
  if !st.style.samples.is_empty() {
    p.push_str("\nEMAILS THE USER WROTE (imitate tone, length, structure, greeting and sign-off):\n");
    for (i, s) in st.style.samples.iter().take(5).enumerate() { p.push_str(&format!("--- sample {} ---\n{}\n", i + 1, s)); }
  }
  if !st.style.learned.is_empty() {
    p.push_str("\nHOW THE USER EDITS DRAFTS (before -> after; learn the corrections):\n");
    for l in st.style.learned.iter().rev().take(6) { p.push_str(&format!("BEFORE:\n{}\nAFTER:\n{}\n---\n", l.draft, l.final_text)); }
  }
  if !st.style.signature.is_empty() { p.push_str(&format!("\nAlways end with this signature exactly:\n{}\n", st.style.signature)); }
  p.push_str(&format!("\nLanguage: {}. Rules: no placeholders left in the output, no markdown, plain text email body. Output format:\nSubject: <subject>\n\n<body>", if st.style.language == "ar" { "Arabic" } else { "English" }));
  p
}

pub fn draft(thread_id: String, step: u32, instructions: Option<String>) -> Result<serde_json::Value, String> {
  let st = load();
  let t = st.threads.iter().find(|t| t.id == thread_id).ok_or("thread not found")?;
  let seq = st.sequences.iter().find(|s| Some(&s.id) == t.sequence_id.as_ref()).or(st.sequences.first()).ok_or("no sequence")?;
  let template = seq.steps.get((step.max(1) - 1) as usize).cloned().unwrap_or_default();
  let lead = t.lead.clone().unwrap_or(serde_json::json!({}));
  let pick = |k: &str| lead.get(k).and_then(|v| v.as_str()).unwrap_or("").to_string();
  let history: Vec<String> = t.messages.iter().map(|m| format!("[{} {}] {}\n{}", m.direction.to_uppercase(), m.at, m.subject, m.body)).collect();
  let user = format!(
    "Write step {step} of a {}-step sequence.\n\nRECIPIENT\nName: {}\nCompany: {}\nHeadline: {}\nIndustry: {}\nEmployees: {}\nLocation: {}\nNotes: {}\n\nTEMPLATE FOR THIS STEP (structure to follow; adapt wording to the style):\nSubject: {}\n{}\n\nPREVIOUS MESSAGES IN THIS THREAD:\n{}\n\nEXTRA INSTRUCTIONS: {}",
    seq.steps.len(), t.name, t.company.clone().unwrap_or_default(), pick("headline"), pick("industry"), pick("employees"), pick("location"), pick("notes").chars().take(600).collect::<String>(),
    template.subject, template.body, if history.is_empty() { "(none)".into() } else { history.join("\n\n") }, instructions.unwrap_or_default()
  );
  let text = crate::llm::complete(None, None, style_prompt(&st), user, 900)?;
  let (subject, body) = split_subject(&text);
  Ok(serde_json::json!({ "subject": subject, "body": body, "step": step }))
}

pub fn learn_style(samples: Vec<String>, signature: String, language: String) -> Result<State, String> {
  let mut st = load();
  st.style.samples = samples.into_iter().filter(|s| !s.trim().is_empty()).collect();
  st.style.signature = signature;
  st.style.language = if language == "ar" { "ar".into() } else { "en".into() };
  if !st.style.samples.is_empty() {
    let user = format!("Analyse these emails written by one person and produce a concise style guide (max 12 bullet lines) covering: tone, formality, typical length, greeting, structure of paragraphs, how they state value, how they ask for the call to action, sign-off, words or phrases they favour, and things they never do.\n\n{}", st.style.samples.iter().enumerate().map(|(i, s)| format!("--- email {} ---\n{}", i + 1, s)).collect::<Vec<_>>().join("\n\n"));
    st.style.guide = crate::llm::complete(None, None, "You are a precise writing-style analyst. Output plain text bullets only.".into(), user, 700)?;
  }
  save(st)
}

pub fn record_edit(draft: String, final_text: String) -> Result<(), String> {
  if draft.trim() == final_text.trim() || draft.trim().is_empty() { return Ok(()); }
  let mut st = load();
  st.style.learned.push(Learned { draft, final_text, at: integrations::now_iso() });
  if st.style.learned.len() > 25 { let n = st.style.learned.len() - 25; st.style.learned.drain(0..n); }
  save(st).map(|_| ())
}

fn split_subject(text: &str) -> (String, String) {
  let mut lines = text.lines();
  let mut subject = String::new();
  let mut rest = Vec::new();
  for l in lines.by_ref() {
    let lt = l.trim();
    if subject.is_empty() && lt.to_lowercase().starts_with("subject:") { subject = lt[8..].trim().to_string(); continue; }
    if subject.is_empty() && lt.is_empty() { continue; }
    rest.push(l);
    break;
  }
  rest.extend(lines);
  (subject, rest.join("\n").trim().to_string())
}
