//! Company platform same-origin bridge. No network, credentials or filesystem access.
use deckcraft_engine::DocState;
use deckcraft_ui_egui::{Inbox, SlideApp};
use std::cell::RefCell;
use wasm_bindgen::{JsCast as _, JsValue, closure::Closure};
thread_local! {
    static OPEN: RefCell<Option<(String, Vec<u8>)>> = const { RefCell::new(None) };
    static DIRTY: RefCell<bool> = const { RefCell::new(false) };
    static SEQ: RefCell<u32> = const { RefCell::new(0) };
    static CAPTURE: RefCell<Option<u32>> = const { RefCell::new(None) };
    static SNAPSHOT: RefCell<Option<(u32, DocState)>> = const { RefCell::new(None) };
    static ACK: RefCell<Option<u32>> = const { RefCell::new(None) };
}

fn frame() -> Option<(web_sys::Window, web_sys::Window, String)> {
    let window = web_sys::window()?;
    let parent = window.parent().ok().flatten()?;
    let origin = window.location().origin().ok()?;
    if !window.location().search().ok()?.contains("host=parent")
        || js_sys::Object::is(&window, &parent)
        || parent.location().origin().ok()? != origin
    {
        return None;
    }
    Some((window, parent, origin))
}

fn post(kind: &str, values: &[(&str, JsValue)]) -> Result<(), String> {
    let (_, parent, origin) = frame().ok_or("No same-origin host")?;
    let data = js_sys::Object::new();
    js_sys::Reflect::set(&data, &"type".into(), &kind.into()).map_err(|e| format!("{e:?}"))?;
    for (key, value) in values {
        js_sys::Reflect::set(&data, &(*key).into(), value).map_err(|e| format!("{e:?}"))?;
    }
    parent
        .post_message(&data, &origin)
        .map_err(|e| format!("{e:?}"))
}

pub fn listen(ctx: egui::Context) {
    let Some((window, parent, origin)) = frame() else {
        return;
    };
    let handler =
        Closure::<dyn FnMut(web_sys::MessageEvent)>::new(move |event: web_sys::MessageEvent| {
            if event.origin() != origin
                || !event
                    .source()
                    .is_some_and(|source| js_sys::Object::is(&source, &parent))
            {
                return;
            }
            let data = event.data();
            let get = |key: &str| js_sys::Reflect::get(&data, &key.into()).ok();
            if get("type").and_then(|v| v.as_string()).as_deref() == Some("deckcraft:saved") {
                if let Some(id) = get("requestId").and_then(|v| v.as_f64()).filter(|v| {
                    v.is_finite() && *v >= 0.0 && *v <= u32::MAX as f64 && v.fract() == 0.0
                }) {
                    ACK.with(|ack| *ack.borrow_mut() = Some(id as u32));
                    ctx.request_repaint();
                }
                return;
            }
            if get("type").and_then(|v| v.as_string()).as_deref() != Some("deckcraft:open") {
                return;
            }
            let Some(name) = get("name").and_then(|v| v.as_string()) else {
                return;
            };
            let Some(bytes) = get("bytes") else { return };
            if name.len() > 600
                || !(bytes.is_instance_of::<js_sys::ArrayBuffer>()
                    || bytes.is_instance_of::<js_sys::Uint8Array>())
            {
                return;
            }
            let bytes = js_sys::Uint8Array::new(&bytes);
            if bytes.length() > 5_000_000 {
                return;
            }
            OPEN.with(|pending| *pending.borrow_mut() = Some((name, bytes.to_vec())));
            ctx.request_repaint();
        });
    if window
        .add_event_listener_with_callback("message", handler.as_ref().unchecked_ref())
        .is_ok()
    {
        handler.forget();
        let _ = post("deckcraft:ready", &[]);
    }
}

pub fn save(path: &str, bytes: &[u8]) -> Option<Result<(), String>> {
    frame()?;
    let name = path
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("presentation.pptx");
    if bytes.len() > 5_000_000 {
        return Some(Err(
            "Platform file limit is 5 MB; use a smaller document".into()
        ));
    }
    let id = SEQ.with(|seq| {
        let mut seq = seq.borrow_mut();
        *seq = seq.wrapping_add(1);
        *seq
    });
    if name.to_ascii_lowercase().ends_with(".pptx")
        || name.to_ascii_lowercase().ends_with(".deckcraft")
    {
        CAPTURE.with(|capture| *capture.borrow_mut() = Some(id));
    }
    Some(post(
        "deckcraft:save",
        &[
            ("name", name.into()),
            ("requestId", id.into()),
            ("bytes", js_sys::Uint8Array::from(bytes).buffer().into()),
        ],
    ))
}

pub fn dirty(value: bool) {
    DIRTY.with(|last| {
        if *last.borrow() != value {
            *last.borrow_mut() = value;
            let _ = post("deckcraft:dirty", &[("dirty", value.into())]);
        }
    });
}

pub fn drain(app: &mut SlideApp, _inbox: &Inbox) {
    if let Some((name, bytes)) = OPEN.with(|pending| pending.borrow_mut().take()) {
        app.open_or_insert_bytes(&name, &bytes);
    }
    if let Some(id) = ACK.with(|ack| ack.borrow_mut().take()) {
        SNAPSHOT.with(|snapshot| {
            if let Some((saved_id, saved)) = snapshot.borrow().as_ref() {
                if *saved_id == id {
                    if let Some(current) = app.session.active_mut().filter(|d| d.uid == saved.uid) {
                        current.saved_doc = saved.doc.clone();
                    }
                }
            }
        });
    }
}

pub fn checkpoint(app: &SlideApp) {
    if let Some(id) = CAPTURE.with(|capture| capture.borrow_mut().take()) {
        if let Some(doc) = app.session.active() {
            SNAPSHOT.with(|snapshot| *snapshot.borrow_mut() = Some((id, doc.clone())));
        }
    }
}
