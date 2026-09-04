//! LLM providers. Keys live in the OS credential store; the default provider/model in
//! %APPDATA%\orbit\llm.json. All calls are synchronous (run via spawn_blocking).

use serde::{Deserialize, Serialize};
use std::time::Duration;

const SERVICE: &str = "orbit-growth-os";

#[derive(Serialize, Clone)]
pub struct ProviderInfo { pub id: &'static str, pub name: &'static str, pub models: &'static [&'static str], pub docs: &'static str }

pub const PROVIDERS: &[ProviderInfo] = &[
  ProviderInfo { id: "openai", name: "OpenAI", models: &["gpt-5.1", "gpt-5", "gpt-4.1-mini"], docs: "https://platform.openai.com/api-keys" },
  ProviderInfo { id: "anthropic", name: "Anthropic", models: &["claude-sonnet-4-5", "claude-haiku-4-5"], docs: "https://console.anthropic.com/settings/keys" },
  ProviderInfo { id: "google", name: "Google Gemini", models: &["gemini-3.8-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"], docs: "https://aistudio.google.com/app/apikey" },
  ProviderInfo { id: "mistral", name: "Mistral", models: &["mistral-medium-latest", "mistral-large-latest"], docs: "https://console.mistral.ai/api-keys" },
  ProviderInfo { id: "groq", name: "Groq", models: &["llama-4-scout", "llama-3.3-70b-versatile"], docs: "https://console.groq.com/keys" },
  ProviderInfo { id: "openrouter", name: "OpenRouter", models: &["openai/gpt-5.1", "anthropic/claude-sonnet-4-5"], docs: "https://openrouter.ai/keys" },
];

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Settings { pub provider: Option<String>, pub model: Option<String> }

fn settings_path() -> std::path::PathBuf {
  let base = std::env::var("APPDATA").map(std::path::PathBuf::from).unwrap_or_else(|_| std::env::temp_dir());
  base.join("orbit").join("llm.json")
}
pub fn settings() -> Settings { std::fs::read_to_string(settings_path()).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default() }
fn save_settings(s: &Settings) -> Result<(), String> {
  let p = settings_path();
  if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; }
  std::fs::write(&p, serde_json::to_string_pretty(s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

fn key_name(provider: &str) -> String { format!("llm-{provider}") }
pub fn get_key(provider: &str) -> Option<String> { keyring::Entry::new(SERVICE, &key_name(provider)).ok().and_then(|e| e.get_password().ok()).filter(|k| !k.trim().is_empty()) }

pub fn set_key(provider: &str, key: &str) -> Result<(), String> {
  if !PROVIDERS.iter().any(|p| p.id == provider) { return Err(format!("unknown provider {provider}")); }
  let entry = keyring::Entry::new(SERVICE, &key_name(provider)).map_err(|e| e.to_string())?;
  if key.trim().is_empty() { let _ = entry.delete_credential(); return Ok(()); }
  entry.set_password(key.trim()).map_err(|e| format!("credential store: {e}"))
}

pub fn set_default(provider: &str, model: &str) -> Result<(), String> {
  if !PROVIDERS.iter().any(|p| p.id == provider) { return Err(format!("unknown provider {provider}")); }
  save_settings(&Settings { provider: Some(provider.into()), model: Some(model.into()) })
}

pub fn status() -> serde_json::Value {
  let s = settings();
  serde_json::json!({
    "default": { "provider": s.provider, "model": s.model },
    "providers": PROVIDERS.iter().map(|p| serde_json::json!({ "id": p.id, "name": p.name, "models": p.models, "docs": p.docs, "configured": get_key(p.id).is_some() })).collect::<Vec<_>>(),
  })
}

fn client() -> reqwest::blocking::Client {
  reqwest::blocking::Client::builder().timeout(Duration::from_secs(90)).user_agent("orbit-growth-os/0.1").build().expect("http client")
}

/// One completion. `provider`/`model` fall back to the saved defaults.
pub fn complete(provider: Option<String>, model: Option<String>, system: String, user: String, max_tokens: u32) -> Result<String, String> {
  let s = settings();
  let provider = provider.or(s.provider).ok_or("No LLM provider selected. Add an API key under Integrations → LLM providers.")?;
  let info = PROVIDERS.iter().find(|p| p.id == provider).ok_or("unknown provider")?;
  let model = model.or(s.model).filter(|m| !m.is_empty()).unwrap_or_else(|| info.models[0].to_string());
  let key = get_key(&provider).ok_or(format!("No API key saved for {}. Add it under Integrations → LLM providers.", info.name))?;
  let c = client();
  let text = match provider.as_str() {
    "anthropic" => {
      let v: serde_json::Value = c.post("https://api.anthropic.com/v1/messages").header("x-api-key", &key).header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({ "model": model, "max_tokens": max_tokens, "system": system, "messages": [{ "role": "user", "content": user }] }))
        .send().map_err(|e| e.to_string())?.json().map_err(|e| e.to_string())?;
      if let Some(err) = v.get("error") { return Err(format!("Anthropic: {}", err.get("message").and_then(|m| m.as_str()).unwrap_or("error"))); }
      v.get("content").and_then(|c| c.get(0)).and_then(|c| c.get("text")).and_then(|t| t.as_str()).unwrap_or("").to_string()
    }
    "google" => {
      let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}");
      let v: serde_json::Value = c.post(&url).json(&serde_json::json!({ "systemInstruction": { "parts": [{ "text": system }] }, "contents": [{ "parts": [{ "text": user }] }], "generationConfig": { "maxOutputTokens": max_tokens } }))
        .send().map_err(|e| e.to_string())?.json().map_err(|e| e.to_string())?;
      if let Some(err) = v.get("error") { return Err(format!("Gemini: {}", err.get("message").and_then(|m| m.as_str()).unwrap_or("error"))); }
      v.pointer("/candidates/0/content/parts/0/text").and_then(|t| t.as_str()).unwrap_or("").to_string()
    }
    _ => {
      let base = match provider.as_str() { "groq" => "https://api.groq.com/openai/v1", "mistral" => "https://api.mistral.ai/v1", "openrouter" => "https://openrouter.ai/api/v1", _ => "https://api.openai.com/v1" };
      let v: serde_json::Value = c.post(format!("{base}/chat/completions")).bearer_auth(&key)
        .json(&serde_json::json!({ "model": model, "max_tokens": max_tokens, "messages": [{ "role": "system", "content": system }, { "role": "user", "content": user }] }))
        .send().map_err(|e| e.to_string())?.json().map_err(|e| e.to_string())?;
      if let Some(err) = v.get("error") { return Err(format!("{}: {}", info.name, err.get("message").and_then(|m| m.as_str()).unwrap_or("error"))); }
      v.pointer("/choices/0/message/content").and_then(|t| t.as_str()).unwrap_or("").to_string()
    }
  };
  if text.trim().is_empty() { return Err(format!("{} returned an empty response", info.name)); }
  Ok(text.trim().to_string())
}

/// Cheap connectivity probe for the Integrations page.
pub fn test(provider: String) -> Result<String, String> {
  let info = PROVIDERS.iter().find(|p| p.id == provider).ok_or("unknown provider")?;
  complete(Some(provider.clone()), Some(info.models[0].to_string()), "Reply with the single word OK.".into(), "ping".into(), 8)
}
