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
  #[serde(default)]
  pub demo: bool,
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

// ---------------------------------------------------------------- guided tour demo data
fn demo_lead(i: u32, name: &str, headline: &str, company: &str, industry: &str, employees: &str, growth: &str, revenue: &str, city: &str, notes: &str) -> serde_json::Value {
  let slug = company.to_lowercase().replace(' ', "-");
  let now = integrations::now_iso();
  serde_json::json!({
    "id": format!("DEMO-{:04}", i), "demo": true, "kind": "person", "name": name, "title": format!("{name} - {headline}"), "headline": headline,
    "company": company, "industry": industry, "employees": employees, "employee_growth": growth, "revenue_range": revenue, "total_funding": if i % 3 == 0 { "$1.2M" } else { "" },
    "founded": format!("{}", 2015 + (i % 8)), "headquarters": city, "location": city, "homepage": format!("{slug}.example.com"),
    "linkedin_url": format!("https://www.linkedin.com/in/demo-{slug}"), "source_url": format!("https://example.com/demo/{slug}"),
    "emails": [
      { "email": format!("hello@{slug}.example.com"), "role": "general", "source": format!("https://{slug}.example.com"), "consent": "demo" },
      { "email": format!("sales@{slug}.example.com"), "role": "sales", "source": format!("https://{slug}.example.com/contact"), "consent": "demo" }
    ],
    "performance": format!("employees {employees}; growth {growth}; revenue {revenue}"),
    "notes": notes, "published": now, "favicon": serde_json::Value::Null, "logo": serde_json::Value::Null, "photo": serde_json::Value::Null,
    "channel": "demo", "fetched_at": now
  })
}

pub fn demo_seed() -> Result<(), String> {
  let now = integrations::now_iso();
  let leads = vec![
    demo_lead(1, "Demo: Sara Haddad", "Founder & CEO at Nour Pay", "Nour Pay", "Financial Services", "10-20 employees", "+35% YoY", "$1M-$10M", "Riyadh, Saudi Arabia", "### Founder & CEO - [Nour Pay](https://nour-pay.example.com) (Current)\n\nNour Pay is a **Financial Services** company. Builds payment links for small merchants in the GCC.\n\n- Licensed by SAMA sandbox\n- 2,300 merchants onboarded"),
    demo_lead(2, "Demo: Omar Farouk", "Solo founder building Tarjim AI", "Tarjim AI", "Software Development", "1-10 employees", "+100% YoY", "under $1M", "Cairo, Egypt", "### Founder - Tarjim AI (Current)\n\nArabic-first translation API for e-commerce catalogs.\n\n- Shipped v2 in March\n- Looking for design partners"),
    demo_lead(3, "Demo: Layla Mansour", "Co-founder at Sahl Logistics", "Sahl Logistics", "Transportation and Logistics", "20-30 employees", "+18% YoY", "$1M-$10M", "Dubai, UAE", "### Co-founder - [Sahl Logistics](https://sahl-logistics.example.com) (Current)\n\nSame-day delivery network across the UAE. Has $1.2M in total funding, with 1 prior funding round."),
    demo_lead(4, "Demo: Karim Aziz", "Head of Growth at Qira Learning", "Qira Learning", "E-learning", "50-60 employees", "+22% YoY", "$1M-$10M", "Amman, Jordan", "### Head of Growth - Qira Learning (Current)\n\nK-12 tutoring marketplace. Expanding to Saudi Arabia in Q4."),
    demo_lead(5, "Demo: Nadia Rahman", "Founder at Bayt Fresh", "Bayt Fresh", "Food and Beverage Services", "5-10 employees", "+60% YoY", "under $1M", "Jeddah, Saudi Arabia", "### Founder - Bayt Fresh (Current)\n\nSubscription groceries for families. Ran the first 1,000 orders solo."),
    demo_lead(6, "Demo: Youssef Khalil", "Managing Director at Delta Dental Group", "Delta Dental Group", "Hospitals and Health Care", "100-200 employees", "+8% YoY", "$10M-$50M", "Alexandria, Egypt", "### Managing Director - Delta Dental Group (Current)\n\n11 clinics. Evaluating CRM and outreach tools for patient reactivation. Has $1.2M in total funding."),
    demo_lead(7, "Demo: Hana Saleh", "CEO at Makani Spaces", "Makani Spaces", "Real Estate", "30-40 employees", "+12% YoY", "$1M-$10M", "Doha, Qatar", "### CEO - Makani Spaces (Current)\n\nCo-working operator with 6 locations. Hiring a sales lead."),
    demo_lead(8, "Demo: Tariq Nasser", "Founder at Wasl Recruit", "Wasl Recruit", "Staffing and Recruiting", "10-20 employees", "+40% YoY", "under $1M", "Muscat, Oman", "### Founder - Wasl Recruit (Current)\n\nTech recruiting for Gulf startups. Publishes a weekly hiring newsletter."),
  ];
  let research = vec![
    serde_json::json!({ "id": "DEMO-R001", "demo": true, "kind": "page", "name": "", "title": "Demo: GCC Fintech Market Size & Share 2026", "headline": "Market report", "company": "Demo Intelligence", "industry": "Market research", "source_url": "https://example.com/demo/gcc-fintech-report", "homepage": "example.com", "emails": [], "performance": "", "notes": "## Key numbers\n\n- Market size **$4.1B** (2026)\n- CAGR 19%\n- 210 licensed fintechs", "published": now, "channel": "demo", "fetched_at": now, "favicon": serde_json::Value::Null, "logo": serde_json::Value::Null, "photo": serde_json::Value::Null }),
    serde_json::json!({ "id": "DEMO-R002", "demo": true, "kind": "company", "name": "", "title": "Demo: Nour Pay | Payment links for GCC merchants", "headline": "Company page", "company": "Nour Pay", "industry": "Financial Services", "employees": "10-20 employees", "employee_growth": "+35% YoY", "source_url": "https://example.com/demo/nour-pay", "homepage": "nour-pay.example.com", "emails": [{ "email": "press@nour-pay.example.com", "role": "marketing", "source": "https://nour-pay.example.com/press", "consent": "demo" }], "performance": "employees 10-20 employees; growth +35% YoY", "notes": "Nour Pay is a Financial Services company. 2,300 merchants.", "published": now, "channel": "demo", "fetched_at": now, "favicon": serde_json::Value::Null, "logo": serde_json::Value::Null, "photo": serde_json::Value::Null }),
    serde_json::json!({ "id": "DEMO-R003", "demo": true, "kind": "article", "name": "", "title": "Demo: Why solo founders in Egypt are choosing usage-based pricing", "headline": "Article", "company": "Demo Weekly", "industry": "Media", "source_url": "https://example.com/demo/article-usage-pricing", "homepage": "example.com", "emails": [], "performance": "", "notes": "Interviews with 14 founders. **Takeaway:** pricing pages with calculators convert 2x.", "published": now, "channel": "demo", "fetched_at": now, "favicon": serde_json::Value::Null, "logo": serde_json::Value::Null, "photo": serde_json::Value::Null }),
  ];
  let runs_dir = dir().join("runs");
  std::fs::create_dir_all(&runs_dir).map_err(|e| e.to_string())?;
  let run1 = serde_json::json!({ "id": "demo-leads", "demo": true, "mode": "leads", "query": "Demo: Solo founders and growth leads in the GCC", "target": 100, "count": leads.len(), "calls": [{ "query": "demo", "returned": leads.len(), "new": leads.len() }], "fetched_at": now, "saved_at": now, "leads": leads, "enriched": true });
  let run2 = serde_json::json!({ "id": "demo-research", "demo": true, "mode": "research", "query": "Demo: Fintech market in the GCC", "target": 50, "count": research.len(), "calls": [{ "query": "demo", "returned": research.len(), "new": research.len() }], "fetched_at": now, "saved_at": now, "leads": research });
  std::fs::write(runs_dir.join("demo-leads.json"), serde_json::to_vec(&run1).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
  std::fs::write(runs_dir.join("demo-research.json"), serde_json::to_vec(&run2).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;

  let mut o = outreach::load();
  o.threads.retain(|t| !t.id.starts_with("demo-"));
  let mk = |id: &str, lead: &serde_json::Value, status: &str, msgs: Vec<(&str, &str, &str, u32, i64)>, followups: u32, next: Option<i64>| {
    let base = outreach::parse_iso(&now).unwrap_or(0) as i64;
    outreach::Thread {
      id: id.into(), lead_id: lead.get("id").and_then(|v| v.as_str()).map(|s| s.to_string()), name: lead["name"].as_str().unwrap_or("").into(), company: lead["company"].as_str().map(|s| s.to_string()),
      email: lead["emails"][0]["email"].as_str().unwrap_or("").into(), status: status.into(),
      messages: msgs.iter().enumerate().map(|(i, (dir, subj, body, step, mins_ago))| outreach::Msg { id: format!("m-{}", i + 1), direction: dir.to_string(), subject: subj.to_string(), body: body.to_string(), at: integrations::iso_from_secs((base - mins_ago * 60).max(0) as u64), provider: if *dir == "out" { Some("demo".into()) } else { None }, step: *step, external_id: None, template_id: None, variant_id: None }).collect(),
      followup_count: followups, max_followups: 3, interval_days: 3, next_followup_at: next.map(|m| integrations::iso_from_secs((base + m * 60).max(0) as u64)), last_activity: now.clone(), sequence_id: Some("default".into()), lead: Some(lead.clone()), notes: None, unread: status == "replied",
    }
  };
  let l = &run1["leads"];
  o.threads.insert(0, mk("demo-1", &l[0], "replied", vec![
    ("out", "Quick question about Nour Pay", "Hi Sara,\n\nSaw Nour Pay crossed 2,300 merchants. We help GCC fintechs turn merchant sign-ups into activated accounts within the first week.\n\nWorth a 15-minute look this week?\n\nBest,\nDemo", 1, 4 * 24 * 60),
    ("out", "Re: Quick question about Nour Pay", "Hi Sara,\n\nFollowing up on my note below in case it got buried.\n\nBest,\nDemo", 2, 24 * 60),
    ("in", "Re: Quick question about Nour Pay", "Hi, yes let's talk. Thursday 2pm works for me. — Sara", 0, 3 * 60),
  ], 1, None));
  o.threads.insert(1, mk("demo-2", &l[1], "sent", vec![
    ("out", "Quick question about Tarjim AI", "Hi Omar,\n\nCongrats on shipping v2. Quick idea on design partners for the Arabic catalog API.\n\nOpen to a chat?\n\nDemo", 1, 6 * 24 * 60),
    ("out", "Re: Quick question about Tarjim AI", "Hi Omar, one more try in case this got buried.\n\nDemo", 2, 3 * 24 * 60),
  ], 1, Some(-30)));
  o.threads.insert(2, mk("demo-3", &l[2], "sent", vec![("out", "Quick question about Sahl Logistics", "Hi Layla,\n\nSame-day delivery across the UAE is a hard problem; we work with ops teams on route density.\n\nWorth 15 minutes?\n\nDemo", 1, 2 * 60)], 0, Some(3 * 24 * 60)));
  o.threads.insert(3, mk("demo-4", &l[3], "draft", vec![], 0, None));
  o.threads.insert(4, mk("demo-5", &l[5], "draft", vec![], 0, None));
  outreach::save(o)?;

  let mut w = load();
  w.demo = true;
  for (k, t) in [("demo", "Guided tour started with sample data"), ("research", "Demo: Lead Finder “Solo founders and growth leads in the GCC” → 8 records"), ("research", "Demo: Market Research “Fintech market in the GCC” → 3 records"), ("outreach", "Demo: Sent step 1 to Sara Haddad"), ("outreach", "Demo: 1 new reply synced from inbox")] {
    w.activity.push(Activity { at: now.clone(), kind: k.into(), text: t.into() });
  }
  save(w).map(|_| ())
}

pub fn demo_clear() -> Result<(), String> {
  let runs_dir = dir().join("runs");
  let _ = std::fs::remove_file(runs_dir.join("demo-leads.json"));
  let _ = std::fs::remove_file(runs_dir.join("demo-research.json"));
  let mut o = outreach::load();
  o.threads.retain(|t| !t.id.starts_with("demo-"));
  outreach::save(o)?;
  let mut w = load();
  w.demo = false;
  w.activity.retain(|a| a.kind != "demo" && !a.text.starts_with("Demo:"));
  w.activity.push(Activity { at: integrations::now_iso(), kind: "workspace".into(), text: "Guided tour finished, sample data removed".into() });
  save(w).map(|_| ())
}
