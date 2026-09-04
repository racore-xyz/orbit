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
}

fn config_path() -> PathBuf {
  let base = std::env::var("APPDATA").map(PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("integrations.json")
}

pub fn load() -> Config {
  std::fs::read_to_string(config_path()).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
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
    "config_path": config_path().to_string_lossy(),
  })
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
