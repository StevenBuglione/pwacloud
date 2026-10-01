wit_bindgen::generate!({ path: "../../contracts/plugin.wit", world: "guest" });
use exports::pwacloud::plugin::lifecycle::Guest;
use pwacloud::plugin::types::{Event, Effect, ErrorInfo, UiUpdate, KvRead};
struct Analyzer;
impl Guest for Analyzer {
    fn activate(_: String, _: Option<Vec<u8>>) -> Result<(), ErrorInfo> { Ok(()) }
    fn handle(event: Event) -> Result<Vec<Effect>, ErrorInfo> {
        match event {
            Event::Action(a) if a.action == "hang" => { loop { std::hint::black_box(1); } },
            Event::Action(a) if a.action == "read" => Ok(vec![Effect::Read(KvRead { request_id: "guest-read".into(), key: a.body_json })]),
            Event::Completed(r) => Ok(vec![Effect::Render(UiUpdate { channel: "completed".into(), body_json: serde_json::json!({"requestId":r.request_id, "ok":r.body.is_ok()}).to_string() })]),
            Event::Action(a) => {
                let text = serde_json::from_str::<serde_json::Value>(&a.body_json).ok().and_then(|v| v.get("text").and_then(|s| s.as_str()).map(str::to_owned)).unwrap_or_default();
                let result = serde_json::json!({"words":text.split_whitespace().count(),"characters":text.chars().count(),"source":"Rust Component Model Wasm"});
                Ok(vec![Effect::Render(UiUpdate { channel:"analysis".into(), body_json:result.to_string() })])
            },
            _ => Ok(vec![])
        }
    }
    fn snapshot() -> Result<Vec<u8>, ErrorInfo> { Ok(b"{}".to_vec()) }
    fn shutdown() {}
}
export!(Analyzer);
