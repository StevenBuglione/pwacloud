wit_bindgen::generate!({ path: "../../contracts/plugin.wit", world: "guest" });
use exports::pwacloud::plugin::lifecycle::Guest;
use pwacloud::plugin::types::{Event, Effect, ErrorInfo, UiUpdate, KvRead};
struct Analyzer;
use std::sync::atomic::{AtomicUsize, Ordering};
static LAST_WORDS: AtomicUsize = AtomicUsize::new(0);
static LAST_CHARACTERS: AtomicUsize = AtomicUsize::new(0);
impl Guest for Analyzer {
    fn activate(_: String, checkpoint: Option<Vec<u8>>) -> Result<(), ErrorInfo> {
        if let Some(bytes) = checkpoint {
            let value: serde_json::Value = serde_json::from_slice(&bytes).map_err(|_| ErrorInfo { code: "invalid-checkpoint".into(), message: "Checkpoint is malformed".into() })?;
            LAST_WORDS.store(value["words"].as_u64().unwrap_or(0) as usize, Ordering::Relaxed);
            LAST_CHARACTERS.store(value["characters"].as_u64().unwrap_or(0) as usize, Ordering::Relaxed);
        }
        Ok(())
    }
    fn handle(event: Event) -> Result<Vec<Effect>, ErrorInfo> {
        match event {
            Event::Action(a) if a.action == "hang" => { loop { std::hint::black_box(1); } },
            Event::Action(a) if a.action == "read" => Ok(vec![Effect::Read(KvRead { request_id: "guest-read".into(), key: a.body_json })]),
            Event::Action(a) if a.action == "grow" => {
                let failed = core::arch::wasm32::memory_grow::<0>(2048) == usize::MAX;
                Ok(vec![Effect::Render(UiUpdate { channel: "memory".into(), body_json: serde_json::json!({"growthDenied":failed}).to_string() })])
            },
            Event::Completed(r) => Ok(vec![Effect::Render(UiUpdate { channel: "completed".into(), body_json: serde_json::json!({"requestId":r.request_id, "ok":r.body.is_ok()}).to_string() })]),
            Event::Action(a) if a.action == "analyze" => {
                let text = serde_json::from_str::<serde_json::Value>(&a.body_json).ok().and_then(|v| v.get("text").and_then(|s| s.as_str()).map(str::to_owned)).unwrap_or_default();
                let words=text.split_whitespace().count();let characters=text.chars().count();
                LAST_WORDS.store(words,Ordering::Relaxed);LAST_CHARACTERS.store(characters,Ordering::Relaxed);
                let result = serde_json::json!({"words":words,"characters":characters,"source":"Rust Component Model Wasm"});
                Ok(vec![Effect::Render(UiUpdate { channel:"analysis".into(), body_json:result.to_string() })])
            },
            Event::Action(_) => Err(ErrorInfo { code:"unknown-action".into(), message:"Action is unsupported".into() }),
            _ => Ok(vec![])
        }
    }
    fn snapshot() -> Result<Vec<u8>, ErrorInfo> { Ok(serde_json::json!({"words":LAST_WORDS.load(Ordering::Relaxed),"characters":LAST_CHARACTERS.load(Ordering::Relaxed)}).to_string().into_bytes()) }
    fn shutdown() {}
}
export!(Analyzer);
