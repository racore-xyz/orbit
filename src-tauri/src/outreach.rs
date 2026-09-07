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
  #[serde(default)]
  pub template_id: Option<String>,
  #[serde(default)]
  pub variant_id: Option<String>,
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
  #[serde(default)]
  pub pending_draft: Option<PendingDraft>,
  #[serde(default)]
  pub pending_reply: Option<PendingDraft>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct PendingDraft { pub subject: String, pub body: String, pub step: u32, pub at: String, pub source: String }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Step { pub delay_days: u32, pub subject: String, pub body: String }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Sequence { pub id: String, pub name: String, pub steps: Vec<Step> }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Learned { pub draft: String, pub final_text: String, pub at: String }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Style { pub samples: Vec<String>, pub guide: String, pub signature: String, pub learned: Vec<Learned>, pub language: String }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Settings { pub send_via: String, pub auto_followup: bool, pub default_max_followups: u32, pub default_interval_days: u32, #[serde(default)] pub default_template_id: Option<String>, #[serde(default)] pub variant_mode: String, #[serde(default)] pub auto_reply: bool }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Variant { pub id: String, pub label: String, pub subject: String, pub body: String, #[serde(default)] pub angle: String }

/// The user's base first email, written in their own words with {{placeholders}}, plus generated variants.
#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Template { pub id: String, pub name: String, pub subject: String, pub body: String, pub variants: Vec<Variant>, pub created_at: String, pub updated_at: String, #[serde(default = "default_true")] pub in_rotation: bool }
fn default_true() -> bool { true }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Campaign { pub id: String, pub name: String, pub thread_ids: Vec<String>, pub template_id: Option<String>, pub variant_mode: String, pub sequence_id: Option<String>, pub scheduled_at: String, pub status: String, pub created_at: String }

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct State { pub threads: Vec<Thread>, pub sequences: Vec<Sequence>, pub style: Style, pub settings: Settings, pub updated_at: String, #[serde(default)] pub templates: Vec<Template>, #[serde(default)] pub campaigns: Vec<Campaign> }

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
  if s.settings.variant_mode.is_empty() { s.settings.variant_mode = "rotate".into(); }
  s
}

pub fn save(mut s: State) -> Result<State, String> {
  s.updated_at = integrations::now_iso();
  let p = path();
  if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
  std::fs::write(&p, serde_json::to_vec_pretty(&s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
  Ok(s)
}

pub fn create_campaign(name: String, thread_ids: Vec<String>, template_id: Option<String>, variant_mode: String, sequence_id: Option<String>, scheduled_at: String) -> Result<State, String> {
  let mut st = load();
  let ids: Vec<String> = thread_ids.into_iter().filter(|id| st.threads.iter().any(|t| &t.id == id && !t.email.trim().is_empty())).collect();
  if ids.is_empty() { return Err("Select at least one CRM lead with an email address".into()); }
  st.campaigns.push(Campaign { id: format!("campaign-{}", integrations::now_iso().replace(['-', ':'], "")), name: if name.trim().is_empty() { "Untitled campaign".into() } else { name }, thread_ids: ids, template_id, variant_mode: if variant_mode.is_empty() { "rotate".into() } else { variant_mode }, sequence_id, scheduled_at, status: "scheduled".into(), created_at: integrations::now_iso() });
  save(st)
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
pub fn send(thread_id: String, subject: String, body: String, step: u32, template_id: Option<String>, variant_id: Option<String>) -> Result<Thread, String> {
  let mut st = load();
  let via = st.settings.send_via.clone();
  let idx = st.threads.iter().position(|t| t.id == thread_id).ok_or("thread not found")?;
  let to = st.threads[idx].email.clone();
  if to.trim().is_empty() { return Err("This contact has no email address. Enrich the lead first.".into()); }
  crate::quota::gate_send()?;
  let mb = integrations::next_mailbox()?;
  let n = st.threads[idx].messages.len() + 1;
  let mid = format!("<orbit-{thread_id}-{n}@orbit.mail>");
  let res = integrations::send_via_mailbox(&mb.id, to.clone(), subject.clone(), body.clone(), Some(mid.clone()))?;
  crate::quota::record_send();
  let now = integrations::now_iso();
  let via = res.get("mailbox").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or(via);
  let t = &mut st.threads[idx];
  t.messages.push(Msg { id: format!("m-{}", t.messages.len() + 1), direction: "out".into(), subject, body, at: now.clone(), provider: Some(via), step, external_id: Some(res.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()).map(|c| format!("{c}|{mid}")).unwrap_or(mid)), template_id, variant_id });
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
pub fn sync_replies(app: Option<tauri::AppHandle>) -> Result<serde_json::Value, String> {
  let mut st = load();
  let cfg = integrations::load();
  let has_inbox = cfg.mailboxes.iter().any(|m| m.imap_host.is_some());
  if !has_inbox { return Err("No inbox to check: add a Gmail or SMTP+IMAP mailbox under Integrations \u{2192} Mailboxes.".into()); }
  // earliest outbound across all threads bounds the IMAP search window
  let since = st.threads.iter().flat_map(|t| t.messages.iter().filter(|m| m.direction == "out").map(|m| m.at.clone())).min().unwrap_or_else(|| integrations::now_iso());
  let inbox = integrations::fetch_inbox_since(&since)?;
  let mut found = 0;
  let mut bounced = 0;
  let mut newly: Vec<usize> = Vec::new();
  for msg in &inbox {
    let from_email = msg.get("from_email").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let from_domain = msg.get("from_domain").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let refs = msg.get("refs").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let subj = msg.get("subject").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
    let msg_id = msg.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let body_raw = msg.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let body_l = body_raw.to_lowercase();
    // Delivery Status Notification (Failure) / bounce — never treat as a reply; mark the thread bounced.
    let is_bounce = from_email.starts_with("mailer-daemon") || from_email.starts_with("postmaster")
      || subj.contains("delivery status notification") || subj.contains("undeliverable") || subj.contains("undelivered mail")
      || subj.contains("mail delivery failed") || subj.contains("failure notice") || subj.contains("returned mail")
      || subj.contains("delivery has failed") || subj.contains("delivery incomplete");
    if is_bounce {
      let bidx = st.threads.iter().position(|t| refs.contains(&format!("orbit-{}-", t.id)))
        .or_else(|| st.threads.iter().position(|t| !t.email.is_empty() && body_l.contains(&t.email.to_lowercase())));
      if let Some(bidx) = bidx {
        let t = &mut st.threads[bidx];
        if t.messages.iter().any(|m| m.external_id.as_deref().map(|e| e.contains(&msg_id)).unwrap_or(false)) { continue; }
        t.messages.push(Msg { id: format!("m-{}", t.messages.len() + 1), direction: "in".into(),
          subject: format!("\u{26A0} Delivery failed: {}", msg.get("subject").and_then(|v| v.as_str()).unwrap_or("")),
          body: body_raw.chars().take(800).collect(), at: msg.get("at").and_then(|v| v.as_str()).unwrap_or("").into(),
          provider: None, step: 0, external_id: Some(msg_id.clone()), template_id: None, variant_id: None });
        t.status = "bounced".into();
        t.next_followup_at = None;
        t.unread = true;
        t.last_activity = integrations::now_iso();
        bounced += 1;
      }
      continue;
    }
    // find the best thread: 1) our Message-ID threaded in refs, 2) exact from address,
    // 3) same domain AND the reply subject contains our first subject core.
    let idx = st.threads.iter().position(|t| refs.contains(&format!("orbit-{}-", t.id)))
      .or_else(|| st.threads.iter().position(|t| !t.email.is_empty() && t.email.to_lowercase() == from_email))
      .or_else(|| st.threads.iter().position(|t| {
        if from_domain.is_empty() || t.email.split('@').nth(1).map(|d| d.to_lowercase()) != Some(from_domain.clone()) { return false; }
        let core = t.messages.iter().find(|m| m.direction == "out").map(|m| m.subject.trim_start_matches("Re: ").to_lowercase()).unwrap_or_default();
        !core.is_empty() && subj.contains(&core)
      }));
    let Some(idx) = idx else { continue };
    let t = &mut st.threads[idx];
    if t.messages.iter().any(|m| m.external_id.as_deref().map(|e| e.contains(&msg_id)).unwrap_or(false)) { continue; }
    // skip if this is one of our own outbound message-ids echoed back
    if msg_id.contains("orbit-") { continue; }
    t.messages.push(Msg { id: format!("m-{}", t.messages.len() + 1), direction: "in".into(),
      subject: msg.get("subject").and_then(|v| v.as_str()).unwrap_or("").into(),
      body: msg.get("body").and_then(|v| v.as_str()).unwrap_or("").into(),
      at: msg.get("at").and_then(|v| v.as_str()).unwrap_or("").into(), provider: None, step: 0,
      external_id: Some(msg_id), template_id: None, variant_id: None });
    if t.status != "replied" { newly.push(idx); }
    t.status = "replied".into();
    t.next_followup_at = None;
    t.unread = true;
    t.last_activity = integrations::now_iso();
    found += 1;
  }
  save(st.clone())?;

  // Negotiation on reply: draft an AI answer for every newly-replied thread.
  let auto = st.settings.auto_reply;
  let mut auto_sent = 0;
  let mut drafted = 0;
  for idx in &newly {
    let tid = st.threads[*idx].id.clone();
    match draft_reply(tid.clone()) {
      Ok(d) => {
        let subject = d["subject"].as_str().unwrap_or("").to_string();
        let body = d["body"].as_str().unwrap_or("").to_string();
        if auto && !subject.is_empty() && !body.is_empty() {
          if send_reply(tid.clone(), subject, body).is_ok() { auto_sent += 1; }
        } else {
          let mut s2 = load();
          if let Some(t) = s2.threads.iter_mut().find(|t| t.id == tid) {
            t.pending_reply = Some(PendingDraft { subject, body, step: 0, at: integrations::now_iso(), source: "negotiation".into() });
          }
          let _ = save(s2);
          drafted += 1;
        }
      }
      Err(_) => {}
    }
  }
  if found > 0 {
    let title = format!("{found} new repl{}", if found == 1 { "y" } else { "ies" });
    let text = if auto_sent > 0 { format!("{auto_sent} AI negotiation repl{} sent automatically.", if auto_sent == 1 { "y" } else { "ies" }) }
      else if drafted > 0 { format!("{drafted} AI negotiation draft{} ready for your approval in Outreach.", if drafted == 1 { "" } else { "s" }) }
      else { "Open Outreach to read and answer them.".into() };
    let _ = crate::workspace::notify(app.as_ref(), "reply", &title, &text, Some("outreach"));
    let _ = crate::workspace::log("outreach".into(), format!("{found} replies synced ({auto_sent} auto-answered, {drafted} drafted)"));
  }
  if bounced > 0 {
    let title = format!("{bounced} email{} bounced", if bounced == 1 { "" } else { "s" });
    let _ = crate::workspace::notify(app.as_ref(), "bounce", &title, "A delivery failure came back — those contacts are marked bounced, not replied. Check the address.", Some("outreach"));
    let _ = crate::workspace::log("outreach".into(), format!("{bounced} delivery failures marked as bounced"));
  }
  Ok(serde_json::json!({ "found": found, "auto_sent": auto_sent, "drafted": drafted, "bounced": bounced, "errors": [] }))
}

/// Draft a negotiation reply to the latest inbound message, in the user's style, using full context.
pub fn draft_reply(thread_id: String) -> Result<serde_json::Value, String> {
  let st = load();
  let t = st.threads.iter().find(|t| t.id == thread_id).ok_or("thread not found")?;
  let last_in = t.messages.iter().rev().find(|m| m.direction == "in").ok_or("no reply to answer")?;
  let ws = crate::workspace::load().profile;
  let history: Vec<String> = t.messages.iter().map(|m| format!("[{} {}] {}\n{}", if m.direction == "out" { "YOU".to_string() } else { t.name.to_uppercase() }, m.at, m.subject, m.body)).collect();
  let first_subject = t.messages.iter().find(|m| m.direction == "out").map(|m| m.subject.clone()).unwrap_or_default();
  let reply_subject = if first_subject.to_lowercase().starts_with("re:") { first_subject.clone() } else { format!("Re: {first_subject}") };
  let system = format!(
    "You are {name} from {company} ({role}), replying by email to a prospect who just responded. You are negotiating in good faith to move toward a call or a deal.\nWhat you offer: {offer}\nGoal: {goals}\nWrite in the user's own voice (match the earlier YOU messages). Be warm, specific and concise. Directly answer their questions and objections, address pricing/timing if they raised it, and end with one clear next step (a proposed time, a question, or a light ask). Plain text only, no markdown. Language: {lang}. Output exactly:\nSubject: {subject}\n\n<body>",
    name = ws.name, company = ws.company, role = ws.role, offer = ws.offer, goals = ws.goals, lang = if ws.language == "ar" { "Arabic" } else { "English" }, subject = reply_subject,
  );
  let user = format!("CONVERSATION SO FAR:\n{}\n\nTHEIR LATEST MESSAGE (answer this):\n{}\n\nWrite my reply.", history.join("\n\n"), last_in.body);
  let text = crate::llm::complete(None, None, crate::outreach::style_prompt(&st) + "\n\n" + &system, user, 900)?;
  let (subject, body) = split_subject(&text);
  let subject = if subject.is_empty() { reply_subject } else { subject };
  Ok(serde_json::json!({ "subject": subject, "body": body }))
}

/// Send a negotiation reply on a thread (records it, clears the pending reply, keeps the thread open).
pub fn send_reply(thread_id: String, subject: String, body: String) -> Result<Thread, String> {
  let out = send(thread_id.clone(), subject, body, 0, None, None)?;
  let mut st = load();
  if let Some(t) = st.threads.iter_mut().find(|t| t.id == thread_id) {
    t.pending_reply = None;
    t.status = "sent".into(); // awaiting their next reply
    t.unread = false;
  }
  save(st)?;
  Ok(out)
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
  let ws = crate::workspace::load().profile;
  let sender = format!("SENDER (the user, writing in first person)\nName: {}\nCompany: {}\nRole: {}\nWebsite: {}\nWhat they offer: {}\nTarget market: {}\nGoal of this outreach: {}\n\n", ws.name, ws.company, ws.role, ws.website, ws.offer, ws.target_market, ws.goals);
  let user = sender + &format!(
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

pub fn split_subject(text: &str) -> (String, String) {
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

// ---------------------------------------------------------------- templates (base email in the user's words + variants)
pub const PLACEHOLDERS: &[(&str, &str)] = &[
  ("{{first_name}}", "recipient first name"), ("{{name}}", "recipient full name"), ("{{company}}", "recipient company"), ("{{industry}}", "recipient industry"),
  ("{{headline}}", "recipient headline"), ("{{location}}", "recipient city/country"), ("{{employees}}", "company size"),
  ("{{my_name}}", "your name"), ("{{my_company}}", "your company"), ("{{my_role}}", "your role"), ("{{my_website}}", "your website"), ("{{offer}}", "your offer (profile)"), ("{{signature}}", "your signature"),
];

fn get_str(v: &serde_json::Value, k: &str) -> String { v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string() }

/// Replace placeholders with lead + profile values. Unknown placeholders are left blank, never sent raw.
pub fn fill(text: &str, lead: &serde_json::Value, thread: &Thread) -> String {
  let ws = crate::workspace::load().profile;
  let st = load();
  let name = if !thread.name.is_empty() { thread.name.clone() } else { get_str(lead, "name") };
  let first = name.split_whitespace().next().unwrap_or("").trim_start_matches("Demo:").trim().to_string();
  let company = thread.company.clone().unwrap_or_else(|| get_str(lead, "company"));
  let pairs = [
    ("{{first_name}}", first), ("{{name}}", name), ("{{company}}", company), ("{{industry}}", get_str(lead, "industry")),
    ("{{headline}}", get_str(lead, "headline")), ("{{location}}", if get_str(lead, "location").is_empty() { get_str(lead, "headquarters") } else { get_str(lead, "location") }), ("{{employees}}", get_str(lead, "employees")),
    ("{{my_name}}", ws.name), ("{{my_company}}", ws.company), ("{{my_role}}", ws.role), ("{{my_website}}", ws.website), ("{{offer}}", ws.offer), ("{{signature}}", st.style.signature),
  ];
  let mut out = text.to_string();
  for (k, v) in pairs { out = out.replace(k, v.trim()); }
  let re_left = regex_lite_replace(&out);
  re_left
}
fn regex_lite_replace(s: &str) -> String {
  // strip any leftover {{...}} tokens
  let mut out = String::new();
  let mut rest = s;
  while let Some(i) = rest.find("{{") {
    out.push_str(&rest[..i]);
    if let Some(j) = rest[i..].find("}}") { rest = &rest[i + j + 2..]; } else { rest = &rest[i + 2..]; }
  }
  out.push_str(rest);
  out
}

/// Pick a variant: explicit id, or round-robin by thread id when variant_mode == "rotate", or the base.
pub fn pick_variant<'a>(t: &'a Template, thread_id: &str, variant_id: Option<&str>, mode: &str) -> (Option<&'a Variant>, String, String) {
  if let Some(id) = variant_id {
    if id == "base" { return (None, t.subject.clone(), t.body.clone()); }
    if let Some(v) = t.variants.iter().find(|v| v.id == id) { return (Some(v), v.subject.clone(), v.body.clone()); }
  }
  if mode == "rotate" && !t.variants.is_empty() {
    let h = thread_id.bytes().fold(0usize, |a, b| a.wrapping_mul(31).wrapping_add(b as usize));
    let n = t.variants.len() + 1; // base + variants
    let k = h % n;
    if k == 0 { return (None, t.subject.clone(), t.body.clone()); }
    let v = &t.variants[k - 1];
    return (Some(v), v.subject.clone(), v.body.clone());
  }
  (None, t.subject.clone(), t.body.clone())
}

/// Auto-fill a template for a thread (no LLM, instant).
pub fn fill_for_thread(thread_id: String, template_id: Option<String>, variant_id: Option<String>) -> Result<serde_json::Value, String> {
  let st = load();
  let thread = st.threads.iter().find(|t| t.id == thread_id).ok_or("thread not found")?;
  let tpl = match template_id {
    Some(tid) => st.templates.iter().find(|t| t.id == tid).ok_or("template not found")?,
    None => {
      // Distribute across every template in rotation (default first), then across its variants.
      let pool: Vec<&Template> = st.templates.iter().filter(|t| t.in_rotation && !t.body.trim().is_empty()).collect();
      if pool.is_empty() {
        let tid = st.settings.default_template_id.clone().ok_or("No template yet. Create one in the Templates tab.")?;
        st.templates.iter().find(|t| t.id == tid).ok_or("template not found")?
      } else if st.settings.variant_mode == "rotate" && pool.len() > 1 {
        let h = thread.id.bytes().rev().fold(7usize, |a, b| a.wrapping_mul(17).wrapping_add(b as usize));
        pool[h % pool.len()]
      } else {
        st.templates.iter().find(|t| Some(&t.id) == st.settings.default_template_id.as_ref()).unwrap_or(pool[0])
      }
    }
  };
  let (v, subject, body) = pick_variant(tpl, &thread.id, variant_id.as_deref(), &st.settings.variant_mode);
  let lead = thread.lead.clone().unwrap_or(serde_json::json!({}));
  Ok(serde_json::json!({ "subject": fill(&subject, &lead, thread), "body": fill(&body, &lead, thread), "template_id": tpl.id, "variant_id": v.map(|x| x.id.clone()).unwrap_or_else(|| "base".into()), "variant_label": v.map(|x| x.label.clone()).unwrap_or_else(|| "Base".into()) }))
}

/// Generate N variants of the user's base email, in their style, keeping placeholders intact.
pub fn generate_variants(template_id: String, count: u32) -> Result<State, String> {
  let mut st = load();
  let idx = st.templates.iter().position(|t| t.id == template_id).ok_or("template not found")?;
  let base = st.templates[idx].clone();
  if base.body.trim().is_empty() { return Err("Write the base email first.".into()); }
  let n = count.clamp(2, 6);
  let angles = ["shorter and more direct", "opens with a question about their situation", "leads with social proof or a concrete result", "curiosity-driven, one idea only", "warm and personal, mentions their location or industry", "problem-first, names the pain before the offer"];
  let mut system = style_prompt(&st);
  system.push_str("\n\nYou are rewriting the user's OWN base email into variants. Keep the user's voice, greeting and sign-off. Keep every {{placeholder}} exactly as written (do not fill them). Each variant must be a complete email of similar length, with a different angle. Output exactly this format for each variant:\n=== VARIANT k ===\nLabel: <2-4 word label>\nSubject: <subject>\n\n<body>\n");
  let user = format!("BASE EMAIL (written by the user):\nSubject: {}\n\n{}\n\nProduce {} variants. Angles, in order: {}.", base.subject, base.body, n, angles.iter().take(n as usize).enumerate().map(|(i, a)| format!("{}) {}", i + 1, a)).collect::<Vec<_>>().join("; "));
  let text = crate::llm::complete(None, None, system, user, 2200)?;
  let mut variants = Vec::new();
  for (i, chunk) in text.split("=== VARIANT").skip(1).enumerate() {
    let body_start = chunk.find('\n').map(|x| x + 1).unwrap_or(0);
    let block = &chunk[body_start..];
    let mut label = String::new();
    let mut subject = String::new();
    let mut lines = block.lines().peekable();
    let mut body_lines: Vec<&str> = Vec::new();
    while let Some(l) = lines.next() {
      let lt = l.trim();
      if label.is_empty() && lt.to_lowercase().starts_with("label:") { label = lt[6..].trim().to_string(); continue; }
      if subject.is_empty() && lt.to_lowercase().starts_with("subject:") { subject = lt[8..].trim().to_string(); continue; }
      if body_lines.is_empty() && lt.is_empty() { continue; }
      body_lines.push(l);
      break;
    }
    body_lines.extend(lines);
    let body = body_lines.join("\n").trim().to_string();
    if body.is_empty() { continue; }
    variants.push(Variant { id: format!("v{}-{}", i + 1, integrations::now_iso().replace([':', '-', 'T', 'Z'], "")), label: if label.is_empty() { format!("Variant {}", i + 1) } else { label }, subject: if subject.is_empty() { base.subject.clone() } else { subject }, body, angle: angles.get(i).unwrap_or(&"").to_string() });
  }
  if variants.is_empty() { return Err("The model returned no variants. Try again or use another provider.".into()); }
  st.templates[idx].variants = variants;
  st.templates[idx].updated_at = integrations::now_iso();
  if st.settings.default_template_id.is_none() { st.settings.default_template_id = Some(template_id); }
  save(st)
}

/// Fill a sequence step (follow-up) template for a thread without the LLM.
pub fn fill_step(thread_id: String, step: u32) -> Result<serde_json::Value, String> {
  let st = load();
  let thread = st.threads.iter().find(|t| t.id == thread_id).ok_or("thread not found")?;
  let seq = st.sequences.iter().find(|s| Some(&s.id) == thread.sequence_id.as_ref()).or(st.sequences.first()).ok_or("no sequence")?;
  let tpl = seq.steps.get((step.max(1) - 1) as usize).cloned().unwrap_or_default();
  let lead = thread.lead.clone().unwrap_or(serde_json::json!({}));
  let first_subject = thread.messages.iter().find(|m| m.direction == "out").map(|m| m.subject.clone()).unwrap_or_default();
  let mut subject = fill(&tpl.subject, &lead, thread);
  if step > 1 && !first_subject.is_empty() { subject = if first_subject.to_lowercase().starts_with("re:") { first_subject } else { format!("Re: {first_subject}") }; }
  let body = fill(&tpl.body.replace("{{opener}}", "").replace("{{value}}", "").replace("{{value_short}}", "").replace("{{cta}}", ""), &lead, thread);
  let body = body.split('\n').collect::<Vec<_>>().join("\n").replace("\n\n\n\n", "\n\n").replace("\n\n\n", "\n\n");
  Ok(serde_json::json!({ "subject": subject, "body": body.trim(), "step": step }))
}

/// Postpone a due follow-up by `days`, stop the sequence, or close the thread.
pub fn followup_action(thread_id: String, action: String, days: u32) -> Result<Thread, String> {
  let mut st = load();
  let t = st.threads.iter_mut().find(|t| t.id == thread_id).ok_or("thread not found")?;
  match action.as_str() {
    "postpone" => { let now = integrations::now_iso(); t.next_followup_at = Some(add_days(&now, days.max(1))); }
    "stop" => { t.next_followup_at = None; t.max_followups = t.followup_count; }
    "close" => { t.next_followup_at = None; t.status = "closed".into(); }
    _ => return Err("unknown action".into()),
  }
  let out = t.clone();
  save(st)?;
  Ok(out)
}

/// Background auto-drafting: one LLM draft per contact without a message, rate-limited per provider,
/// progress streamed on `jobs://<job_id>`, a notification when done. Runs on its own thread.
pub fn autodraft_job(app: tauri::AppHandle, job_id: String, limit: usize, cancel: std::sync::Arc<std::sync::atomic::AtomicBool>) {
  use tauri::Emitter;
  let topic = format!("jobs://{job_id}");
  let st = load();
  let targets: Vec<String> = st.threads.iter().filter(|t| t.status == "draft" && !t.email.is_empty() && t.pending_draft.is_none()).map(|t| t.id.clone()).take(limit).collect();
  let total = targets.len();
  let provider = crate::llm::settings().provider.unwrap_or_default();
  let rpm = crate::llm::rpm_for(&provider);
  let _ = app.emit(&topic, serde_json::json!({ "type": "start", "job": "autodraft", "total": total, "provider": provider, "rpm": rpm, "percent": 0 }));
  let mut done = 0usize;
  let mut failed = 0usize;
  let mut last_err = String::new();
  for (i, id) in targets.iter().enumerate() {
    if cancel.load(std::sync::atomic::Ordering::Relaxed) { let _ = app.emit(&topic, serde_json::json!({ "type": "cancelled", "done": done, "total": total })); return; }
    let name = load().threads.iter().find(|t| &t.id == id).map(|t| t.name.clone()).unwrap_or_default();
    let _ = app.emit(&topic, serde_json::json!({ "type": "progress", "index": i + 1, "total": total, "label": name, "percent": (i * 100 / total.max(1)) }));
    match draft(id.clone(), 1, None) {
      Ok(d) => {
        let mut s2 = load();
        if let Some(t) = s2.threads.iter_mut().find(|t| &t.id == id) {
          t.pending_draft = Some(PendingDraft { subject: d["subject"].as_str().unwrap_or("").into(), body: d["body"].as_str().unwrap_or("").into(), step: 1, at: integrations::now_iso(), source: "autodraft".into() });
        }
        let _ = save(s2);
        done += 1;
        let _ = app.emit(&topic, serde_json::json!({ "type": "item", "index": i + 1, "total": total, "thread_id": id, "label": name, "ok": true, "percent": ((i + 1) * 100 / total.max(1)) }));
      }
      Err(e) => {
        failed += 1; last_err = e.clone();
        let _ = app.emit(&topic, serde_json::json!({ "type": "item", "index": i + 1, "total": total, "thread_id": id, "label": name, "ok": false, "error": e, "percent": ((i + 1) * 100 / total.max(1)) }));
        if e.contains("No API key") || e.contains("No LLM provider") { break; }
      }
    }
  }
  if failed > 0 { crate::logs::add("error", "autodraft", &format!("{failed} draft(s) failed. Last error: {last_err}")); }
  let title = if failed == 0 { format!("{done} drafts ready to review") } else { format!("{done} drafts ready · {failed} need attention") };
  let text = if failed == 0 { "Open Outreach: every contact has a draft in your style waiting for your approval.".to_string() } else { format!("{done} ready in Outreach · {failed} failed — see the Log Center for details.") };
  let _ = crate::workspace::notify(Some(&app), "autodraft", &title, &text, Some("outreach"));
  let _ = crate::workspace::log("outreach".into(), format!("Auto-draft finished: {done} ready, {failed} failed"));
  let _ = app.emit(&topic, serde_json::json!({ "type": "done", "done": done, "failed": failed, "total": total, "percent": 100 }));
}

/// Process every thread whose follow-up is due: draft the next step and either send it
/// (when auto_followup is on) or queue it as a pending draft for approval. Progress on `jobs://<job_id>`.
pub fn run_followups_job(app: tauri::AppHandle, job_id: String, cancel: std::sync::Arc<std::sync::atomic::AtomicBool>) {
  use tauri::Emitter;
  let topic = format!("jobs://{job_id}");
  let st = load();
  let auto = st.settings.auto_followup;
  let targets = due(&st);
  let total = targets.len();
  let _ = app.emit(&topic, serde_json::json!({ "type": "start", "job": "followups", "total": total, "auto": auto, "percent": 0 }));
  let (mut sent, mut drafted, mut failed) = (0usize, 0usize, 0usize);
  let mut last_err = String::new();
  for (i, id) in targets.iter().enumerate() {
    if cancel.load(std::sync::atomic::Ordering::Relaxed) { let _ = app.emit(&topic, serde_json::json!({ "type": "cancelled", "sent": sent, "drafted": drafted, "total": total })); return; }
    let (name, step) = { let s = load(); match s.threads.iter().find(|t| &t.id == id) { Some(t) => (t.name.clone(), t.followup_count + 1), None => continue } };
    let _ = app.emit(&topic, serde_json::json!({ "type": "progress", "index": i + 1, "total": total, "label": name, "percent": (i * 100 / total.max(1)) }));
    match draft(id.clone(), step, None) {
      Ok(d) => {
        let subject = d["subject"].as_str().unwrap_or("").to_string();
        let body = d["body"].as_str().unwrap_or("").to_string();
        if subject.trim().is_empty() || body.trim().is_empty() { failed += 1; last_err = "empty draft".into(); continue; }
        if auto {
          match send(id.clone(), subject, body, step, None, None) {
            Ok(_) => { sent += 1; let _ = app.emit(&topic, serde_json::json!({ "type": "item", "index": i + 1, "total": total, "thread_id": id, "label": name, "ok": true, "action": "sent", "percent": ((i + 1) * 100 / total.max(1)) })); }
            Err(e) => { failed += 1; last_err = e.clone(); crate::logs::add("error", "followup", &format!("Follow-up to {name} failed: {e}")); let _ = app.emit(&topic, serde_json::json!({ "type": "item", "index": i + 1, "total": total, "thread_id": id, "label": name, "ok": false, "error": e, "percent": ((i + 1) * 100 / total.max(1)) })); if e.to_lowercase().contains("daily") || e.contains("kill switch") || e.contains("No mailbox") || e.contains("mailbox") { break; } }
          }
        } else {
          let mut s2 = load();
          if let Some(t) = s2.threads.iter_mut().find(|t| &t.id == id) { t.pending_draft = Some(PendingDraft { subject, body, step, at: integrations::now_iso(), source: "followup".into() }); }
          let _ = save(s2);
          drafted += 1;
          let _ = app.emit(&topic, serde_json::json!({ "type": "item", "index": i + 1, "total": total, "thread_id": id, "label": name, "ok": true, "action": "drafted", "percent": ((i + 1) * 100 / total.max(1)) }));
        }
      }
      Err(e) => { failed += 1; last_err = e.clone(); let _ = app.emit(&topic, serde_json::json!({ "type": "item", "index": i + 1, "total": total, "thread_id": id, "label": name, "ok": false, "error": e, "percent": ((i + 1) * 100 / total.max(1)) })); if e.contains("No API key") || e.contains("No LLM provider") { break; } }
    }
  }
  if failed > 0 { crate::logs::add("error", "followup", &format!("{failed} follow-up send(s) failed. Last error: {last_err}")); }
  let title = if auto { format!("{sent} follow-ups sent") } else { format!("{drafted} follow-ups drafted") };
  let text = if auto { if failed > 0 { format!("{sent} sent · {failed} need attention — open the Log Center.") } else { format!("{sent} due follow-ups sent automatically.") } }
    else if failed > 0 { format!("{drafted} drafted · {failed} need attention — open the Log Center.") }
    else { format!("{drafted} due follow-ups drafted — approve them in Outreach.") };
  let _ = crate::workspace::notify(Some(&app), "followup", &title, &text, Some("outreach"));
  let _ = crate::workspace::log("outreach".into(), format!("Follow-ups run: {sent} sent, {drafted} drafted, {failed} failed"));
  let _ = app.emit(&topic, serde_json::json!({ "type": "done", "sent": sent, "drafted": drafted, "failed": failed, "total": total, "percent": 100 }));
}

/// Dashboard data computed from the real stores (last 30 days vs the 30 before).
pub fn dashboard() -> serde_json::Value {
  let st = load();
  let now = integrations::now_iso();
  let now_s = parse_iso(&now).unwrap_or(0);
  let day = 86400u64;
  let cut30 = now_s.saturating_sub(30 * day);
  let cut60 = now_s.saturating_sub(60 * day);
  let month_start = format!("{}-01T00:00:00Z", &now[..7]);
  let month_s = parse_iso(&month_start).unwrap_or(0);
  let ts = |iso: &str| parse_iso(iso).unwrap_or(0);
  let msgs: Vec<(&Thread, &Msg)> = st.threads.iter().flat_map(|t| t.messages.iter().map(move |m| (t, m))).collect();
  let sent_in = |a: u64, b: u64| msgs.iter().filter(|(_, m)| m.direction == "out" && ts(&m.at) >= a && ts(&m.at) < b).count();
  let replies_in = |a: u64, b: u64| msgs.iter().filter(|(_, m)| m.direction == "in" && ts(&m.at) >= a && ts(&m.at) < b).count();
  let sent30 = sent_in(cut30, u64::MAX); let sent_prev = sent_in(cut60, cut30);
  let rep30 = replies_in(cut30, u64::MAX); let rep_prev = replies_in(cut60, cut30);
  let contacts30 = st.threads.iter().filter(|t| ts(&t.last_activity) >= cut30).count();
  let contacts_prev = st.threads.iter().filter(|t| ts(&t.last_activity) >= cut60 && ts(&t.last_activity) < cut30).count();
  let active = st.threads.iter().filter(|t| t.status == "sent").count();
  let pct = |a: usize, b: usize| -> Option<f64> { if b == 0 { None } else { Some(((a as f64 - b as f64) / b as f64 * 100.0 * 10.0).round() / 10.0) } };
  let rate = |r: usize, s: usize| if s == 0 { 0.0 } else { (r as f64 / s as f64 * 1000.0).round() / 10.0 };
  // daily series for the last 30 days
  let mut series = Vec::new();
  for d in (0..30).rev() {
    let a = now_s.saturating_sub((d + 1) * day); let b = now_s.saturating_sub(d * day);
    let label = integrations::iso_from_secs(b)[5..10].replace('-', "/");
    series.push(serde_json::json!({ "x": label, "sent": sent_in(a, b), "replies": replies_in(a, b), "followups": msgs.iter().filter(|(_, m)| m.direction == "out" && m.step > 1 && ts(&m.at) >= a && ts(&m.at) < b).count() }));
  }
  // status distribution
  let mut dist: std::collections::BTreeMap<String, usize> = Default::default();
  for t in &st.threads { *dist.entry(t.status.clone()).or_default() += 1; }
  // template/variant performance
  let mut perf: Vec<serde_json::Value> = Vec::new();
  for tpl in &st.templates {
    let mut rows: Vec<(String, String)> = vec![("base".into(), format!("{} · base", tpl.name))];
    rows.extend(tpl.variants.iter().map(|v| (v.id.clone(), format!("{} · {}", tpl.name, v.label))));
    for (vid, label) in rows {
      let sent: Vec<&Thread> = st.threads.iter().filter(|t| t.messages.iter().any(|m| m.direction == "out" && m.step == 1 && m.template_id.as_deref() == Some(&tpl.id) && (m.variant_id.clone().unwrap_or_else(|| "base".into()) == vid))).collect();
      if sent.is_empty() { continue; }
      let replied = sent.iter().filter(|t| t.status == "replied").count();
      perf.push(serde_json::json!({ "label": label, "sent": sent.len(), "replied": replied, "rate": rate(replied, sent.len()) }));
    }
  }
  perf.sort_by(|a, b| b["rate"].as_f64().partial_cmp(&a["rate"].as_f64()).unwrap_or(std::cmp::Ordering::Equal));
  // recent conversations
  let mut recent: Vec<&Thread> = st.threads.iter().collect();
  recent.sort_by(|a, b| b.last_activity.cmp(&a.last_activity));
  let recent_json: Vec<serde_json::Value> = recent.iter().take(5).map(|t| serde_json::json!({ "id": t.id, "name": t.name, "company": t.company, "status": t.status, "sent": t.messages.iter().filter(|m| m.direction == "out").count(), "replies": t.messages.iter().filter(|m| m.direction == "in").count(), "last": t.last_activity, "pending": t.pending_draft.is_some() })).collect();
  // insights
  let mut hours: std::collections::HashMap<u32, (usize, usize)> = Default::default();
  for t in &st.threads {
    if let Some(first) = t.messages.iter().find(|m| m.direction == "out") {
      let h = first.at.get(11..13).and_then(|x| x.parse::<u32>().ok()).unwrap_or(0);
      let e = hours.entry(h).or_default(); e.0 += 1; if t.status == "replied" { e.1 += 1; }
    }
  }
  let best_hour = hours.iter().filter(|(_, v)| v.0 >= 3).max_by(|a, b| rate(a.1 .1, a.1 .0).partial_cmp(&rate(b.1 .1, b.1 .0)).unwrap()).map(|(h, v)| serde_json::json!({ "hour": h, "rate": rate(v.1, v.0), "sent": v.0 }));
  let fu_replies = st.threads.iter().filter(|t| t.status == "replied" && t.followup_count > 0).count();
  let total_replied = st.threads.iter().filter(|t| t.status == "replied").count();
  let pending = st.threads.iter().filter(|t| t.pending_draft.is_some()).count();
  let drafts = st.threads.iter().filter(|t| t.status == "draft").count();
  // delivery failure (bounce) rate = bounced threads / threads we actually sent to
  let bounced = st.threads.iter().filter(|t| t.status == "bounced").count();
  let sent_threads = st.threads.iter().filter(|t| t.messages.iter().any(|m| m.direction == "out")).count();
  let failure_rate = rate(bounced, sent_threads);
  serde_json::json!({
    "stats": {
      "contacts": { "value": st.threads.len(), "trend": pct(contacts30, contacts_prev) },
      "active": { "value": active, "trend": None::<f64> },
      "reply_rate": { "value": rate(rep30, sent30), "trend": pct(rep30, rep_prev), "prev": rate(rep_prev, sent_prev) },
      "sent_mtd": { "value": sent_in(month_s, u64::MAX), "trend": pct(sent30, sent_prev) },
    },
    "series": series,
    "distribution": dist.iter().map(|(k, v)| serde_json::json!({ "name": k, "value": v })).collect::<Vec<_>>(),
    "templates": perf.iter().take(3).cloned().collect::<Vec<_>>(),
    "recent": recent_json,
    "insights": { "best_hour": best_hour, "followup_share": if total_replied > 0 { Some(rate(fu_replies, total_replied)) } else { None }, "best_template": perf.first().cloned(), "pending_drafts": pending, "drafts": drafts, "due": due(&st).len(), "bounced": bounced, "failure_rate": failure_rate },
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  fn tpl() -> Template {
    Template { id: "t1".into(), name: "First".into(), subject: "Hi {{company}}".into(), body: "Hello {{first_name}}".into(),
      variants: vec![
        Variant { id: "v1".into(), label: "A".into(), subject: "s1".into(), body: "b1".into(), angle: String::new() },
        Variant { id: "v2".into(), label: "B".into(), subject: "s2".into(), body: "b2".into(), angle: String::new() },
      ], created_at: String::new(), updated_at: String::new(), in_rotation: true }
  }

  #[test]
  fn explicit_variant_is_selected() {
    let t = tpl();
    let (v, subj, _) = pick_variant(&t, "any", Some("v2"), "rotate");
    assert_eq!(v.unwrap().id, "v2");
    assert_eq!(subj, "s2");
  }

  #[test]
  fn explicit_base_is_selected() {
    let t = tpl();
    let (v, subj, _) = pick_variant(&t, "any", Some("base"), "rotate");
    assert!(v.is_none());
    assert_eq!(subj, "Hi {{company}}");
  }

  #[test]
  fn rotation_spreads_across_base_and_variants() {
    let t = tpl();
    let mut seen = std::collections::HashSet::new();
    for i in 0..60 {
      let (v, _, _) = pick_variant(&t, &format!("thread-{i}"), None, "rotate");
      seen.insert(v.map(|x| x.id.clone()).unwrap_or_else(|| "base".into()));
    }
    // base + 2 variants should all appear over many thread ids
    assert!(seen.contains("base") && seen.contains("v1") && seen.contains("v2"), "got {seen:?}");
  }

  #[test]
  fn base_mode_always_uses_base() {
    let t = tpl();
    for i in 0..10 {
      let (v, _, _) = pick_variant(&t, &format!("x{i}"), None, "base");
      assert!(v.is_none());
    }
  }

  #[test]
  fn leftover_placeholders_are_stripped() {
    assert_eq!(regex_lite_replace("Hi {{unknown}} there"), "Hi  there");
    assert_eq!(regex_lite_replace("plain text"), "plain text");
    assert_eq!(regex_lite_replace("{{a}}{{b}}end"), "end");
  }

  #[test]
  fn iso_parse_roundtrips() {
    let secs = 1_780_000_000u64;
    let iso = integrations::iso_from_secs(secs);
    assert_eq!(parse_iso(&iso), Some(secs));
  }
}

/// Execute a scheduled campaign: fill the template per contact, rotate mailboxes, send the first email
/// with spacing and per-mailbox caps, stream progress on `jobs://<job_id>`, notify on finish.
pub fn campaign_run_job(app: tauri::AppHandle, job_id: String, campaign_id: String, cancel: std::sync::Arc<std::sync::atomic::AtomicBool>) {
  use tauri::Emitter;
  let topic = format!("jobs://{job_id}");
  let st = load();
  let Some(camp) = st.campaigns.iter().find(|c| c.id == campaign_id).cloned() else {
    let _ = app.emit(&topic, serde_json::json!({ "type": "error", "error": "campaign not found" }));
    return;
  };
  // Only threads that have not been contacted yet.
  let targets: Vec<String> = camp.thread_ids.iter().filter(|id| st.threads.iter().any(|t| &t.id == *id && !t.messages.iter().any(|m| m.direction == "out") && !t.email.trim().is_empty())).cloned().collect();
  let total = targets.len();
  // mark running
  { let mut s = load(); if let Some(c) = s.campaigns.iter_mut().find(|c| c.id == campaign_id) { c.status = "running".into(); } let _ = save(s); }
  let _ = app.emit(&topic, serde_json::json!({ "type": "start", "job": "campaign", "campaign": camp.name, "total": total, "percent": 0 }));
  let (mut done, mut failed) = (0usize, 0usize);
  let mut last_err = String::new();
  for (i, id) in targets.iter().enumerate() {
    if cancel.load(std::sync::atomic::Ordering::Relaxed) {
      { let mut s = load(); if let Some(c) = s.campaigns.iter_mut().find(|c| c.id == campaign_id) { c.status = "paused".into(); } let _ = save(s); }
      let _ = app.emit(&topic, serde_json::json!({ "type": "cancelled", "done": done, "total": total }));
      return;
    }
    let name = load().threads.iter().find(|t| &t.id == id).map(|t| t.name.clone()).unwrap_or_default();
    let _ = app.emit(&topic, serde_json::json!({ "type": "progress", "index": i + 1, "total": total, "label": name, "percent": (i * 100 / total.max(1)) }));
    // Fill (rotates template/variant) then send (rotates mailbox, gates spacing, records).
    let filled = fill_for_thread(id.clone(), camp.template_id.clone(), None);
    match filled.and_then(|f| {
      let subject = f["subject"].as_str().unwrap_or("").to_string();
      let body = f["body"].as_str().unwrap_or("").to_string();
      let vid = f["variant_id"].as_str().map(|s| s.to_string());
      send(id.clone(), subject, body, 1, camp.template_id.clone(), vid)
    }) {
      Ok(_) => { done += 1; let _ = app.emit(&topic, serde_json::json!({ "type": "item", "index": i + 1, "total": total, "label": name, "ok": true, "percent": ((i + 1) * 100 / total.max(1)) })); }
      Err(e) => {
        failed += 1; last_err = e.clone();
        let _ = app.emit(&topic, serde_json::json!({ "type": "item", "index": i + 1, "total": total, "label": name, "ok": false, "error": e, "percent": ((i + 1) * 100 / total.max(1)) }));
        // Stop the whole run on setup-level errors (no mailbox, no template, every cap reached).
        if e.contains("mailbox") || e.contains("template") || e.contains("cap") || e.contains("No LLM") { break; }
      }
    }
  }
  { let mut s = load(); if let Some(c) = s.campaigns.iter_mut().find(|c| c.id == campaign_id) { c.status = if failed == 0 { "sent".into() } else { "partial".into() }; } let _ = save(s); }
  let title = if failed == 0 { format!("Campaign “{}”: {done} sent", camp.name) } else { format!("Campaign “{}”: {done} sent, {failed} failed", camp.name) };
  let text = if failed == 0 { "Every contact received the first email. Follow-ups are scheduled.".to_string() } else { format!("Last error: {last_err}") };
  let _ = crate::workspace::notify(Some(&app), "campaign", &title, &text, Some("outreach"));
  let _ = crate::workspace::log("outreach".into(), format!("Campaign '{}' ran: {done} sent, {failed} failed", camp.name));
  let _ = app.emit(&topic, serde_json::json!({ "type": "done", "done": done, "failed": failed, "total": total, "percent": 100 }));
}

pub fn campaign_delete(id: String) -> Result<State, String> {
  let mut st = load();
  st.campaigns.retain(|c| c.id != id);
  save(st)
}
