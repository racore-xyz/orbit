//! Real integrations for the desktop app.
//!
//! - Non-secret settings live in %APPDATA%\orbit\integrations.json
//! - Secrets (SMTP/IMAP passwords, webhook secret)
//!   live in the OS credential store (Windows Credential Manager) via `keyring`.
//! - Nothing is sent anywhere without an explicit user click in the UI.

use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const SERVICE: &str = "orbit-growth-os";

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Smtp {
  pub host: Option<String>,
  pub port: Option<u16>,
  pub username: Option<String>,
  pub from: Option<String>,
  pub security: Option<String>, // "starttls" | "ssl"
  pub verified_at: Option<String>,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Webhook {
  pub url: Option<String>,
  pub last_status: Option<u16>,
  pub last_sent_at: Option<String>,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Imap {
  pub host: Option<String>,
  pub port: Option<u16>,
  pub username: Option<String>,
  pub verified_at: Option<String>,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Config {
  pub smtp: Smtp,
  pub webhook: Webhook,
  #[serde(default)]
  pub imap: Imap,
  #[serde(default)]
  pub mailboxes: Vec<Mailbox>,
}

/// One sending account. Campaigns rotate across every enabled mailbox, each capped per day.
#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Mailbox {
  pub id: String,
  pub label: String,
  pub kind: String, // gmail | smtp
  pub smtp_host: String,
  pub smtp_port: u16,
  pub security: String, // starttls | ssl
  pub username: String,
  pub from: String,
  pub imap_host: Option<String>,
  pub imap_port: Option<u16>,
  pub enabled: bool,
  pub daily_cap: u32,
  pub verified_at: Option<String>,
  #[serde(default)]
  pub sent_today: u32,
  #[serde(default)]
  pub sent_day: String,
  #[serde(default)]
  pub last_send_at: Option<String>,
}

fn config_path() -> PathBuf {
  let base = std::env::var("APPDATA").map(PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("integrations.json")
}

pub fn load() -> Config {
  let mut cfg: Config = std::fs::read_to_string(config_path()).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
  // One-time migration: turn the old single SMTP account into the first mailbox.
  if cfg.mailboxes.is_empty() {
    if let (Some(host), Some(from)) = (cfg.smtp.host.clone(), cfg.smtp.from.clone()) {
      if let Some(pw) = secret_get("smtp-password") {
        let id = "primary".to_string();
        let _ = secret_set(&format!("mailbox-{id}-smtp"), &pw);
        if let Some(ipw) = secret_get("imap-password") { let _ = secret_set(&format!("mailbox-{id}-imap"), &ipw); }
        cfg.mailboxes.push(Mailbox {
          id, label: from.clone(), kind: if host == "smtp.gmail.com" { "gmail".into() } else { "smtp".into() },
          smtp_host: host, smtp_port: cfg.smtp.port.unwrap_or(587), security: cfg.smtp.security.clone().unwrap_or_else(|| "starttls".into()),
          username: cfg.smtp.username.clone().unwrap_or_default(), from, imap_host: cfg.imap.host.clone(), imap_port: cfg.imap.port,
          enabled: true, daily_cap: 100, verified_at: cfg.smtp.verified_at.clone(), sent_today: 0, sent_day: String::new(), last_send_at: None,
        });
        let _ = save(&cfg);
      }
    }
  }
  cfg
}

fn save(cfg: &Config) -> Result<(), String> {
  let p = config_path();
  if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
  std::fs::write(&p, serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

pub fn now_iso() -> String {
  let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
  iso_from_secs(secs)
}

pub fn iso_from_secs(secs: u64) -> String {
  let days = secs / 86400;
  let (y, m, d) = civil_from_days(days as i64);
  let rem = secs % 86400;
  format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z", rem / 3600, (rem % 3600) / 60, rem % 60)
}

pub fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
  let y = if m <= 2 { y - 1 } else { y };
  let era = if y >= 0 { y } else { y - 399 } / 400;
  let yoe = y - era * 400;
  let mp = if m > 2 { m - 3 } else { m + 9 } as i64;
  let doy = (153 * mp + 2) / 5 + d as i64 - 1;
  let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  era * 146097 + doe - 719468
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
  let z = z + 719468;
  let era = if z >= 0 { z } else { z - 146096 } / 146097;
  let doe = (z - era * 146097) as u64;
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  let y = yoe as i64 + era * 400;
  let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  let mp = (5 * doy + 2) / 153;
  let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
  let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
  (if m <= 2 { y + 1 } else { y }, m, d)
}

// ---------------------------------------------------------------- secrets
fn secret_set(key: &str, value: &str) -> Result<(), String> {
  keyring::Entry::new(SERVICE, key).and_then(|e| e.set_password(value)).map_err(|e| format!("credential store: {e}"))
}
fn secret_get(key: &str) -> Option<String> {
  keyring::Entry::new(SERVICE, key).ok().and_then(|e| e.get_password().ok())
}
fn secret_del(key: &str) {
  if let Ok(e) = keyring::Entry::new(SERVICE, key) { let _ = e.delete_credential(); }
}

fn client() -> reqwest::blocking::Client {
  reqwest::blocking::Client::builder().timeout(Duration::from_secs(30)).user_agent("orbit-growth-os/0.1").build().expect("http client")
}

fn rand_token(n: usize) -> String {
  use rand::{distributions::Alphanumeric, Rng};
  rand::thread_rng().sample_iter(&Alphanumeric).take(n).map(char::from).collect()
}

// ---------------------------------------------------------------- status
pub fn status() -> serde_json::Value {
  let cfg = load();
  serde_json::json!({
    "smtp": {
      "connected": cfg.smtp.host.is_some() && secret_get("smtp-password").is_some(),
      "host": cfg.smtp.host, "port": cfg.smtp.port, "username": cfg.smtp.username, "from": cfg.smtp.from,
      "security": cfg.smtp.security, "verified_at": cfg.smtp.verified_at,
    },
    "imap": {
      "connected": cfg.imap.host.is_some() && secret_get("imap-password").is_some(),
      "host": cfg.imap.host, "port": cfg.imap.port, "username": cfg.imap.username, "verified_at": cfg.imap.verified_at,
    },
    "webhook": {
      "connected": cfg.webhook.url.is_some() && secret_get("webhook-secret").is_some(),
      "url": cfg.webhook.url, "last_status": cfg.webhook.last_status, "last_sent_at": cfg.webhook.last_sent_at,
    },
    "mailboxes": cfg.mailboxes.iter().map(|m| serde_json::json!({
      "id": m.id, "label": m.label, "kind": m.kind, "from": m.from, "username": m.username,
      "smtp_host": m.smtp_host, "smtp_port": m.smtp_port, "security": m.security,
      "imap": m.imap_host.is_some(), "enabled": m.enabled, "daily_cap": m.daily_cap,
      "verified_at": m.verified_at, "sent_today": if m.sent_day == today() { m.sent_today } else { 0 },
    })).collect::<Vec<_>>(),
    "config_path": config_path().to_string_lossy(),
  })
}

fn today() -> String { now_iso()[..10].to_string() }

// ---------------------------------------------------------------- mailboxes (multiple senders, round-robin)
fn mailbox_transport(m: &Mailbox, password: &str) -> Result<lettre::SmtpTransport, String> {
  use lettre::transport::smtp::authentication::Credentials;
  let builder = if m.security == "ssl" { lettre::SmtpTransport::relay(&m.smtp_host) } else { lettre::SmtpTransport::starttls_relay(&m.smtp_host) }
    .map_err(|e| format!("SMTP setup: {e}"))?;
  Ok(builder.port(m.smtp_port).credentials(Credentials::new(m.username.clone(), password.to_string())).timeout(Some(Duration::from_secs(20))).build())
}

/// Add or update a mailbox. Verifies SMTP (and IMAP if given) before saving. Password optional on update.
#[allow(clippy::too_many_arguments)]
pub fn mailbox_add(id: Option<String>, label: String, kind: String, smtp_host: String, smtp_port: u16, security: String, username: String, from: String, imap_host: Option<String>, imap_port: Option<u16>, password: String, daily_cap: u32) -> Result<serde_json::Value, String> {
  if smtp_host.trim().is_empty() || from.trim().is_empty() || username.trim().is_empty() { return Err("Host, username and From address are required".into()); }
  let id = id.filter(|x| !x.is_empty()).unwrap_or_else(|| format!("mb-{}", SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)));
  if !password.trim().is_empty() { secret_set(&format!("mailbox-{id}-smtp"), password.trim())?; }
  let pw = secret_get(&format!("mailbox-{id}-smtp")).ok_or("Password is required")?;
  let mut m = Mailbox {
    id: id.clone(), label: if label.trim().is_empty() { from.trim().into() } else { label.trim().into() }, kind,
    smtp_host: smtp_host.trim().into(), smtp_port, security, username: username.trim().into(), from: from.trim().into(),
    imap_host: imap_host.filter(|h| !h.trim().is_empty()), imap_port, enabled: true, daily_cap: daily_cap.max(1),
    verified_at: None, sent_today: 0, sent_day: today(), last_send_at: None,
  };
  mailbox_transport(&m, &pw)?.test_connection().map_err(|e| format!("SMTP connection failed: {e}"))?;
  if let Some(ihost) = m.imap_host.clone() {
    if !password.trim().is_empty() { secret_set(&format!("mailbox-{id}-imap"), password.trim())?; }
    let ipw = secret_get(&format!("mailbox-{id}-imap")).unwrap_or_else(|| pw.clone());
    if secret_get(&format!("mailbox-{id}-imap")).is_none() { secret_set(&format!("mailbox-{id}-imap"), &ipw)?; }
    let tls = native_tls::TlsConnector::builder().build().map_err(|e| e.to_string())?;
    let client = imap::connect((ihost.as_str(), m.imap_port.unwrap_or(993)), ihost.as_str(), &tls).map_err(|e| format!("IMAP connect: {e}"))?;
    let mut session = client.login(m.username.clone(), &ipw).map_err(|e| format!("IMAP login: {}", e.0))?;
    session.select("INBOX").map_err(|e| format!("IMAP INBOX: {e}"))?;
    let _ = session.logout();
  }
  m.verified_at = Some(now_iso());
  let mut cfg = load();
  if let Some(existing) = cfg.mailboxes.iter_mut().find(|x| x.id == id) { m.sent_today = existing.sent_today; m.sent_day = existing.sent_day.clone(); *existing = m.clone(); } else { cfg.mailboxes.push(m.clone()); }
  save(&cfg)?;
  Ok(serde_json::json!({ "ok": true, "id": id, "verified_at": m.verified_at }))
}

pub fn mailbox_add_gmail(address: String, app_password: String, daily_cap: u32) -> Result<serde_json::Value, String> {
  let addr = address.trim().to_string();
  let id = format!("gmail-{}", addr.replace(['@', '.'], "-"));
  let pw = app_password.replace(char::is_whitespace, "");
  mailbox_add(Some(id), format!("Gmail · {addr}"), "gmail".into(), "smtp.gmail.com".into(), 587, "starttls".into(), addr.clone(), addr, Some("imap.gmail.com".into()), Some(993), pw, daily_cap)
}

pub fn mailbox_remove(id: String) -> Result<(), String> {
  secret_del(&format!("mailbox-{id}-smtp"));
  secret_del(&format!("mailbox-{id}-imap"));
  let mut cfg = load();
  cfg.mailboxes.retain(|m| m.id != id);
  save(&cfg)
}

pub fn mailbox_toggle(id: String, enabled: bool) -> Result<(), String> {
  let mut cfg = load();
  if let Some(m) = cfg.mailboxes.iter_mut().find(|m| m.id == id) { m.enabled = enabled; }
  save(&cfg)
}

pub fn mailbox_set_cap(id: String, cap: u32) -> Result<(), String> {
  let mut cfg = load();
  if let Some(m) = cfg.mailboxes.iter_mut().find(|m| m.id == id) { m.daily_cap = cap.max(1); }
  save(&cfg)
}

pub fn mailbox_test(id: String) -> Result<serde_json::Value, String> {
  let cfg = load();
  let m = cfg.mailboxes.iter().find(|m| m.id == id).ok_or("mailbox not found")?;
  let pw = secret_get(&format!("mailbox-{id}-smtp")).ok_or("password missing")?;
  mailbox_transport(m, &pw)?.test_connection().map_err(|e| format!("SMTP: {e}"))?;
  Ok(serde_json::json!({ "ok": true }))
}

/// Pick the next mailbox for a send: enabled, under its daily cap, least-recently used, fewest sent today.
pub fn next_mailbox() -> Result<Mailbox, String> {
  let cfg = load();
  let day = today();
  let mut avail: Vec<&Mailbox> = cfg.mailboxes.iter().filter(|m| m.enabled && (if m.sent_day == day { m.sent_today } else { 0 }) < m.daily_cap).collect();
  if avail.is_empty() {
    if cfg.mailboxes.is_empty() { return Err("No mailbox connected. Add a Gmail or SMTP account under Integrations → Mailboxes.".into()); }
    return Err("Every mailbox reached its daily cap. Raise the caps under Integrations → Mailboxes, add another account, or continue tomorrow.".into());
  }
  avail.sort_by(|a, b| {
    let (sa, sb) = (if a.sent_day == day { a.sent_today } else { 0 }, if b.sent_day == day { b.sent_today } else { 0 });
    sa.cmp(&sb).then(a.last_send_at.cmp(&b.last_send_at))
  });
  Ok(avail[0].clone())
}

/// Send through a specific mailbox and record its usage (for rotation and caps).
pub fn send_via_mailbox(mailbox_id: &str, to: String, subject: String, body: String) -> Result<serde_json::Value, String> {
  use lettre::{message::header::ContentType, Message, Transport};
  let mut cfg = load();
  let day = today();
  let idx = cfg.mailboxes.iter().position(|m| m.id == mailbox_id).ok_or("mailbox not found")?;
  let pw = secret_get(&format!("mailbox-{mailbox_id}-smtp")).ok_or("mailbox password missing")?;
  let (from, m) = { let m = &cfg.mailboxes[idx]; (m.from.clone(), m.clone()) };
  let msg = Message::builder().from(from.parse().map_err(|e| format!("from: {e}"))?).to(to.parse().map_err(|e| format!("to: {e}"))?)
    .subject(subject).header(ContentType::TEXT_PLAIN).body(body).map_err(|e| e.to_string())?;
  let r = mailbox_transport(&m, &pw)?.send(&msg).map_err(|e| format!("SMTP send failed: {e}"))?;
  let mb = &mut cfg.mailboxes[idx];
  if mb.sent_day != day { mb.sent_day = day; mb.sent_today = 0; }
  mb.sent_today += 1;
  mb.last_send_at = Some(now_iso());
  save(&cfg)?;
  Ok(serde_json::json!({ "ok": true, "response": r.code().to_string(), "from": from, "to": to, "mailbox": mailbox_id }))
}

// ---------------------------------------------------------------- IMAP (reply detection for SMTP accounts)
pub fn imap_save(host: String, port: u16, username: String, password: String) -> Result<serde_json::Value, String> {
  if host.trim().is_empty() || username.trim().is_empty() { return Err("IMAP host and username are required".into()); }
  if !password.is_empty() { secret_set("imap-password", &password)?; }
  let pw = secret_get("imap-password").ok_or("Password is required")?;
  let tls = native_tls::TlsConnector::builder().build().map_err(|e| e.to_string())?;
  let client = imap::connect((host.trim(), port), host.trim(), &tls).map_err(|e| format!("IMAP connect: {e}"))?;
  let mut session = client.login(username.trim(), &pw).map_err(|e| format!("IMAP login: {}", e.0))?;
  session.select("INBOX").map_err(|e| format!("IMAP INBOX: {e}"))?;
  let _ = session.logout();
  let mut cfg = load();
  cfg.imap = Imap { host: Some(host.trim().into()), port: Some(port), username: Some(username.trim().into()), verified_at: Some(now_iso()) };
  save(&cfg)?;
  Ok(serde_json::json!({ "ok": true, "verified_at": cfg.imap.verified_at }))
}

pub fn imap_disconnect() -> Result<(), String> {
  secret_del("imap-password");
  let mut cfg = load();
  cfg.imap = Imap::default();
  save(&cfg)
}

/// Reply search across every mailbox that has IMAP configured.
pub fn imap_replies_all(from_email: &str, since: &str) -> Result<Vec<serde_json::Value>, String> {
  let cfg = load();
  let boxes: Vec<Mailbox> = cfg.mailboxes.iter().filter(|m| m.imap_host.is_some()).cloned().collect();
  if boxes.is_empty() { return imap_replies_from(from_email, since); }
  let mut out = Vec::new();
  let mut last_err = String::new();
  for m in boxes {
    match imap_replies_mailbox(&m, from_email, since) { Ok(mut v) => out.append(&mut v), Err(e) => last_err = e }
  }
  if out.is_empty() && !last_err.is_empty() { return Err(last_err); }
  Ok(out)
}

fn imap_replies_mailbox(m: &Mailbox, from_email: &str, since: &str) -> Result<Vec<serde_json::Value>, String> {
  let host = m.imap_host.clone().ok_or("no imap")?;
  let pw = secret_get(&format!("mailbox-{}-imap", m.id)).ok_or("imap password missing")?;
  let tls = native_tls::TlsConnector::builder().build().map_err(|e| e.to_string())?;
  let client = imap::connect((host.as_str(), m.imap_port.unwrap_or(993)), host.as_str(), &tls).map_err(|e| format!("IMAP connect: {e}"))?;
  let mut session = client.login(m.username.clone(), &pw).map_err(|e| format!("IMAP login: {}", e.0))?;
  session.select("INBOX").map_err(|e| e.to_string())?;
  let out = imap_search_session(&mut session, from_email, since);
  let _ = session.logout();
  out
}

fn imap_search_session<T: std::io::Read + std::io::Write>(session: &mut imap::Session<T>, from_email: &str, since: &str) -> Result<Vec<serde_json::Value>, String> {
  let (y, m, d) = civil_from_days((crate::outreach::parse_iso(since).unwrap_or(0) / 86400) as i64);
  let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let query = format!("FROM \"{}\" SINCE {}-{}-{}", from_email, d, months[(m as usize).saturating_sub(1).min(11)], y);
  let ids = session.search(&query).map_err(|e| format!("IMAP search: {e}"))?;
  let mut out = Vec::new();
  for uid in ids.iter().take(10) {
    let fetch = session.fetch(uid.to_string(), "(RFC822)").map_err(|e| e.to_string())?;
    for msg in fetch.iter() {
      let Some(raw) = msg.body() else { continue };
      let parsed = mailparse::parse_mail(raw).map_err(|e| e.to_string())?;
      let subject = parsed.headers.iter().find(|h| h.get_key().eq_ignore_ascii_case("subject")).map(|h| h.get_value()).unwrap_or_default();
      let date = parsed.headers.iter().find(|h| h.get_key().eq_ignore_ascii_case("date")).map(|h| h.get_value()).unwrap_or_default();
      let at = mailparse::dateparse(&date).ok().map(|s| iso_from_secs(s.max(0) as u64)).unwrap_or_else(now_iso);
      let mut body = String::new();
      if parsed.subparts.is_empty() { body = parsed.get_body().unwrap_or_default(); } else { for sp in &parsed.subparts { if sp.ctype.mimetype == "text/plain" { body = sp.get_body().unwrap_or_default(); break; } } }
      out.push(serde_json::json!({ "id": format!("imap-{uid}"), "subject": subject, "body": body.chars().take(2000).collect::<String>(), "at": at }));
    }
  }
  Ok(out)
}

pub fn imap_replies_from(from_email: &str, since: &str) -> Result<Vec<serde_json::Value>, String> {
  let cfg = load();
  let host = cfg.imap.host.ok_or("IMAP is not configured (Integrations > SMTP > Inbox)")?;
  let pw = secret_get("imap-password").ok_or("IMAP password missing")?;
  let tls = native_tls::TlsConnector::builder().build().map_err(|e| e.to_string())?;
  let client = imap::connect((host.as_str(), cfg.imap.port.unwrap_or(993)), host.as_str(), &tls).map_err(|e| format!("IMAP connect: {e}"))?;
  let mut session = client.login(cfg.imap.username.unwrap_or_default(), &pw).map_err(|e| format!("IMAP login: {}", e.0))?;
  session.select("INBOX").map_err(|e| e.to_string())?;
  let (y, m, d) = civil_from_days((crate::outreach::parse_iso(since).unwrap_or(0) / 86400) as i64);
  let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let query = format!("FROM \"{}\" SINCE {}-{}-{}", from_email, d, months[(m as usize).saturating_sub(1).min(11)], y);
  let ids = session.search(&query).map_err(|e| format!("IMAP search: {e}"))?;
  let mut out = Vec::new();
  for uid in ids.iter().take(10) {
    let fetch = session.fetch(uid.to_string(), "(RFC822)").map_err(|e| e.to_string())?;
    for msg in fetch.iter() {
      let Some(raw) = msg.body() else { continue };
      let parsed = mailparse::parse_mail(raw).map_err(|e| e.to_string())?;
      let subject = parsed.headers.iter().find(|h| h.get_key().eq_ignore_ascii_case("subject")).map(|h| h.get_value()).unwrap_or_default();
      let date = parsed.headers.iter().find(|h| h.get_key().eq_ignore_ascii_case("date")).map(|h| h.get_value()).unwrap_or_default();
      let at = mailparse::dateparse(&date).ok().map(|s| iso_from_secs(s.max(0) as u64)).unwrap_or_else(now_iso);
      let mut body = String::new();
      if parsed.subparts.is_empty() { body = parsed.get_body().unwrap_or_default(); } else { for sp in &parsed.subparts { if sp.ctype.mimetype == "text/plain" { body = sp.get_body().unwrap_or_default(); break; } } }
      out.push(serde_json::json!({ "id": format!("imap-{uid}"), "subject": subject, "body": body.chars().take(2000).collect::<String>(), "at": at }));
    }
  }
  let _ = session.logout();
  Ok(out)
}

// ---------------------------------------------------------------- SMTP
fn smtp_transport(cfg: &Smtp, password: &str) -> Result<lettre::SmtpTransport, String> {
  use lettre::transport::smtp::authentication::Credentials;
  let host = cfg.host.clone().ok_or("SMTP host missing")?;
  let port = cfg.port.unwrap_or(587);
  let user = cfg.username.clone().unwrap_or_default();
  let builder = if cfg.security.as_deref() == Some("ssl") { lettre::SmtpTransport::relay(&host) } else { lettre::SmtpTransport::starttls_relay(&host) }
    .map_err(|e| format!("SMTP setup: {e}"))?;
  Ok(builder.port(port).credentials(Credentials::new(user, password.to_string())).timeout(Some(Duration::from_secs(20))).build())
}

pub fn smtp_save(host: String, port: u16, username: String, password: String, from: String, security: String) -> Result<serde_json::Value, String> {
  if host.trim().is_empty() || from.trim().is_empty() { return Err("Host and From address are required".into()); }
  if !password.is_empty() { secret_set("smtp-password", &password)?; }
  let pw = secret_get("smtp-password").ok_or("Password is required")?;
  let mut cfg = load();
  cfg.smtp = Smtp { host: Some(host.trim().into()), port: Some(port), username: Some(username.trim().into()), from: Some(from.trim().into()), security: Some(security), verified_at: None };
  // Verify by opening an authenticated session (no mail is sent).
  let mailer = smtp_transport(&cfg.smtp, &pw)?;
  mailer.test_connection().map_err(|e| format!("SMTP connection failed: {e}"))?;
  cfg.smtp.verified_at = Some(now_iso());
  save(&cfg)?;
  Ok(serde_json::json!({ "ok": true, "verified_at": cfg.smtp.verified_at }))
}

pub fn smtp_send(to: String, subject: String, body: String) -> Result<serde_json::Value, String> {
  use lettre::{message::header::ContentType, Message, Transport};
  let cfg = load();
  let pw = secret_get("smtp-password").ok_or("SMTP is not configured")?;
  let from = cfg.smtp.from.clone().ok_or("SMTP is not configured")?;
  let msg = Message::builder().from(from.parse().map_err(|e| format!("from: {e}"))?).to(to.parse().map_err(|e| format!("to: {e}"))?)
    .subject(subject).header(ContentType::TEXT_PLAIN).body(body).map_err(|e| e.to_string())?;
  let r = smtp_transport(&cfg.smtp, &pw)?.send(&msg).map_err(|e| format!("SMTP send failed: {e}"))?;
  Ok(serde_json::json!({ "ok": true, "response": r.code().to_string(), "from": from, "to": to }))
}

pub fn smtp_disconnect() -> Result<(), String> {
  secret_del("smtp-password");
  let mut cfg = load();
  cfg.smtp = Smtp::default();
  save(&cfg)
}

// ---------------------------------------------------------------- Webhooks (HMAC-SHA256 signed JSON POST)
pub fn webhook_save(url: String, secret: String) -> Result<serde_json::Value, String> {
  let url = url.trim().to_string();
  if !(url.starts_with("https://") || url.starts_with("http://localhost") || url.starts_with("http://127.0.0.1")) { return Err("Webhook URL must use https:// (or localhost for testing)".into()); }
  let secret = if secret.trim().is_empty() { rand_token(40) } else { secret.trim().to_string() };
  secret_set("webhook-secret", &secret)?;
  let mut cfg = load();
  cfg.webhook = Webhook { url: Some(url), last_status: None, last_sent_at: None };
  save(&cfg)?;
  Ok(serde_json::json!({ "ok": true, "secret": secret }))
}

pub fn webhook_send(event: String, payload: serde_json::Value) -> Result<serde_json::Value, String> {
  let mut cfg = load();
  let url = cfg.webhook.url.clone().ok_or("Webhook is not configured")?;
  let secret = secret_get("webhook-secret").ok_or("Webhook secret missing")?;
  let body = serde_json::json!({ "event": event, "sent_at": now_iso(), "source": "orbit-growth-os", "data": payload }).to_string();
  let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).map_err(|e| e.to_string())?;
  mac.update(body.as_bytes());
  let sig = hex::encode(mac.finalize().into_bytes());
  let resp = client().post(&url).header("Content-Type", "application/json").header("X-Orbit-Signature", format!("sha256={sig}")).header("X-Orbit-Event", event.clone()).body(body).send().map_err(|e| format!("request failed: {e}"))?;
  let status = resp.status().as_u16();
  let text = resp.text().unwrap_or_default();
  cfg.webhook.last_status = Some(status);
  cfg.webhook.last_sent_at = Some(now_iso());
  save(&cfg)?;
  Ok(serde_json::json!({ "ok": (200..300).contains(&status), "status": status, "response": text.chars().take(300).collect::<String>() }))
}

pub fn webhook_disconnect() -> Result<(), String> {
  secret_del("webhook-secret");
  let mut cfg = load();
  cfg.webhook = Webhook::default();
  save(&cfg)
}

// ---------------------------------------------------------------- Exa (Agent Reach web search) personal API key
/// Save the user's Exa key and write a private mcporter config that uses it. Empty key = back to the free shared endpoint.
pub fn exa_set_key(key: String) -> Result<serde_json::Value, String> {
  let key = key.trim().to_string();
  let cfg_path = exa_config_path();
  if key.is_empty() {
    secret_del("exa-api-key");
    let _ = std::fs::remove_file(&cfg_path);
    return Ok(serde_json::json!({ "ok": true, "configured": false }));
  }
  secret_set("exa-api-key", &key)?;
  if let Some(d) = cfg_path.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
  let cfg = serde_json::json!({ "mcpServers": { "exa": { "baseUrl": format!("https://mcp.exa.ai/mcp?exaApiKey={key}") } }, "imports": [] });
  std::fs::write(&cfg_path, serde_json::to_vec_pretty(&cfg).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
  Ok(serde_json::json!({ "ok": true, "configured": true }))
}
pub fn exa_config_path() -> std::path::PathBuf {
  let base = std::env::var("APPDATA").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("mcporter.json")
}
pub fn exa_status() -> serde_json::Value {
  let has = secret_get("exa-api-key").is_some() && exa_config_path().exists();
  serde_json::json!({ "configured": has, "config": exa_config_path().to_string_lossy() })
}
