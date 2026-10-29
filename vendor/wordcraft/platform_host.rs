//! Company platform same-origin bridge. No network, credentials or filesystem access.
use wasm_bindgen::{JsCast as _, JsValue, closure::Closure};
use wordcraft_ui_egui::Inbox;

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

pub fn listen(inbox: Inbox, ctx: egui::Context) {
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
            if get("type").and_then(|v| v.as_string()).as_deref() != Some("wordcraft:open") {
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
            inbox
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .push((name, bytes.to_vec()));
            ctx.request_repaint();
        });
    if window
        .add_event_listener_with_callback("message", handler.as_ref().unchecked_ref())
        .is_ok()
    {
        handler.forget();
        let _ = post("wordcraft:ready", &[]);
    }
}

pub fn save(path: &str, bytes: &[u8]) -> Option<Result<(), String>> {
    frame()?;
    let name = path.rsplit(['/', '\\']).next().unwrap_or("document.docx");
    if bytes.len() > 5_000_000 {
        return Some(Err(
            "Platform file limit is 5 MB; use a smaller document".into()
        ));
    }
    Some(post(
        "wordcraft:save",
        &[
            ("name", name.into()),
            ("bytes", js_sys::Uint8Array::from(bytes).buffer().into()),
        ],
    ))
}

pub fn dirty(value: bool) {
    let _ = post("wordcraft:dirty", &[("dirty", value.into())]);
}
