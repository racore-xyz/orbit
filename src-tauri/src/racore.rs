//! Racore License Gateway integration.
//! - A stable per-installation device_code (GUID) lives in the OS credential store.
//! - License verification and device login hit https://api.racore.xyz.
//! - The returned access_token is stored as the "racore" LLM provider key, so every AI call
//!   routes through the gateway (OpenAI-compatible /chat/completions). No server secret
//!   (Soal / Supabase / admin / webhook) ever ships in the app.

use serde::{Deserialize, Serialize};

const API: &str = "https://api.racore.xyz";
const SERVICE: &str = "orbit-growth-os";

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct LicenseState {
  #[serde(default)]
  pub license_code: String,
  #[serde(default)]
  pub expires_at: Option<String>,
  #[serde(default)]
  pub linked_at: Option<String>,
}

fn path() -> std::path::PathBuf {
  let base = std::env::var("APPDATA").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("racore.json")
}
fn load() -> LicenseState { std::fs::read_to_string(path()).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default() }
fn save(s: &LicenseState) -> Result<(), String> {
  let p = path();
  if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
  std::fs::write(&p, serde_json::to_vec_pretty(s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
fn client() -> reqwest::blocking::Client {
  reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(60)).user_agent("orbit-growth-os/0.1").build().expect("http client")
}

/// Stable per-installation device id: generated once (random GUID) and kept in the credential store.
pub fn device_code() -> String {
  let entry = keyring::Entry::new(SERVICE, "racore-device").ok();
  if let Some(e) = &entry { if let Ok(v) = e.get_password() { if v.trim().len() >= 16 { return v; } } }
  use rand::Rng;
  let mut rng = rand::thread_rng();
  let id: String = (0..32).map(|_| std::char::from_digit(rng.gen_range(0..16), 16).unwrap()).collect();
  if let Some(e) = &entry { let _ = e.set_password(&id); }
  id
}

/// The active license code (empty if not linked). Used to tag outgoing desktop events.
pub fn license_code() -> String { load().license_code }

fn mask(code: &str) -> String {
  if code.len() > 12 { format!("{}…{}", &code[..8], &code[code.len() - 4..]) } else { code.to_string() }
}

/// Server-authoritative license check (never trust a local result).
pub fn verify(license_code: String) -> Result<serde_json::Value, String> {
  let code = license_code.trim().to_string();
  if code.is_empty() { return Err("Enter a license code".into()); }
  let r = client().post(format!("{API}/licenses/verify")).json(&serde_json::json!({ "license_code": code })).send().map_err(|e| format!("Network error: {e}"))?;
  let status = r.status().as_u16();
  let v: serde_json::Value = r.json().unwrap_or(serde_json::json!({}));
  let valid = v.get("valid").and_then(|x| x.as_bool()).unwrap_or(status < 400);
  Ok(serde_json::json!({ "valid": valid, "expires_at": v.get("expires_at").cloned().unwrap_or(serde_json::Value::Null), "status": status }))
}

/// Register this device against the license and store the access token as the racore AI key.
pub fn login(license_code: String) -> Result<serde_json::Value, String> {
  let code = license_code.trim().to_string();
  if code.is_empty() { return Err("Enter a license code".into()); }
  let dc = device_code();
  let r = client().post(format!("{API}/auth/login")).json(&serde_json::json!({ "device_code": dc, "license_code": code })).send().map_err(|e| format!("Network error: {e}"))?;
  let status = r.status().as_u16();
  match status {
    401 | 404 => return Err("License or device code is not valid.".into()),
    403 => return Err("Maximum number of devices reached for this license.".into()),
    429 => return Err("Too many requests — wait a minute and try again.".into()),
    s if s >= 500 => return Err("Temporary server error — try again shortly.".into()),
    s if s >= 400 => return Err(format!("Login failed (HTTP {s}).")),
    _ => {}
  }
  let v: serde_json::Value = r.json().map_err(|e| e.to_string())?;
  let token = v.get("access_token").and_then(|x| x.as_str()).unwrap_or("").to_string();
  if token.is_empty() { return Err("No access token returned by the gateway.".into()); }
  crate::llm::set_key("racore", &token)?;
  let expires_at = verify(code.clone()).ok().and_then(|vv| vv.get("expires_at").cloned()).and_then(|x| x.as_str().map(|s| s.to_string()));
  save(&LicenseState { license_code: code, expires_at, linked_at: Some(crate::integrations::now_iso()) })?;
  let _ = crate::llm::set_default("racore", "gemini-2.5-flash");
  crate::logs::add("success", "license", "Device linked to the Racore license — AI now routes through the gateway.");
  Ok(serde_json::json!({ "ok": true, "expires_in": v.get("expires_in") }))
}

pub fn status() -> serde_json::Value {
  let s = load();
  serde_json::json!({
    "linked": crate::llm::get_key("racore").is_some(),
    "license_code": mask(&s.license_code),
    "expires_at": s.expires_at,
    "linked_at": s.linked_at,
    "device_code_short": mask(&device_code()),
    "api": API,
    "is_default": crate::llm::settings().provider.as_deref() == Some("racore"),
  })
}

/// Called by the AI layer when the gateway rejects the session (expired/revoked): drop the token
/// so the UI returns to the activation screen. This gateway signals it with 401/403/404.
pub fn on_auth_failure() {
  if crate::llm::get_key("racore").is_some() {
    let _ = crate::llm::set_key("racore", "");
    crate::logs::add("warn", "license", "Racore session expired or revoked — re-activate your license under Integrations.");
  }
}

/// Clear the session (e.g. after a 401) so the user can re-enter a license.
pub fn logout() -> Result<(), String> {
  let _ = crate::llm::set_key("racore", "");
  save(&LicenseState::default())?;
  crate::logs::add("info", "license", "Logged out of the Racore license.");
  Ok(())
}

/// Public early-access registration.
pub fn early_access(user_name: String, organization: String, email: String, country: String, usage_type: String) -> Result<serde_json::Value, String> {
  if !email.contains('@') { return Err("Enter a valid email".into()); }
  let r = client().post(format!("{API}/early-access/register"))
    .json(&serde_json::json!({ "user_name": user_name, "organization": organization, "email": email, "country": country, "usage_type": usage_type }))
    .send().map_err(|e| format!("Network error: {e}"))?;
  let status = r.status().as_u16();
  match status {
    201 | 200 => Ok(serde_json::json!({ "registered": true })),
    409 => Err("This email is already registered.".into()),
    429 => Err("Too many requests — try again shortly.".into()),
    403 => Err("Request blocked. Contact the administrator.".into()),
    s => Err(format!("Registration failed (HTTP {s}).")),
  }
}

#[cfg(test)]
mod tests {
  use super::mask;
  #[test]
  fn masks_long_codes() {
    assert_eq!(mask("orbit_abcdef1234567890zzzz"), "orbit_ab…zzzz");
    assert_eq!(mask("short"), "short");
  }
}
