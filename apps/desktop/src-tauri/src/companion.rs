use gio::prelude::*;
use serde_json::{json, Value};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
static SESSION_BUS: std::sync::OnceLock<gio::DBusConnection> = std::sync::OnceLock::new();
static REGISTERED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

pub fn backend(app: &tauri::AppHandle) -> &'static str {
    let name = app
        .get_webview_window("main")
        .and_then(|w| w.gtk_window().ok())
        .map(|w| gtk::prelude::WidgetExt::display(&w))
        .map(|d| d.type_().name().to_string())
        .unwrap_or_default();
    if name.contains("X11") {
        "x11"
    } else if name.contains("Wayland") {
        "wayland"
    } else {
        "unknown"
    }
}
fn extension() -> Result<(), String> {
    let connection = gio::bus_get_sync(gio::BusType::Session, gio::Cancellable::NONE)
        .map_err(|e| e.to_string())?;
    // Keep the authenticated caller alive while the compositor owns the anchor.
    let _ = SESSION_BUS.set(connection.clone());
    let reply = connection.call_sync(Some("org.gnome.Shell.Extensions.Duby"), "/org/gnome/Shell/Extensions/Duby", "org.gnome.Shell.Extensions.Duby", "Register", None, None, gio::DBusCallFlags::NONE, 2500, gio::Cancellable::NONE).map_err(|_| "GNOME anchor extension is unavailable. Install the bundled extension or use the floating companion.".to_string())?;
    if reply.get::<(bool,)>() != Some((true,)) {
        return Err("The GNOME extension could not identify this Duby companion window".into());
    }
    REGISTERED.store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}
fn unregister() -> Result<(), String> {
    if !REGISTERED.load(std::sync::atomic::Ordering::SeqCst) {
        return Ok(());
    }
    if let Some(connection) = SESSION_BUS.get() {
        connection.call_sync(Some("org.gnome.Shell.Extensions.Duby"), "/org/gnome/Shell/Extensions/Duby", "org.gnome.Shell.Extensions.Duby", "Unregister", None, None, gio::DBusCallFlags::NONE, 2500, gio::Cancellable::NONE)
            .map_err(|_| "The GNOME extension did not release its anchor. Close the companion or disable the extension before changing modes.".to_string())?;
    }
    REGISTERED.store(false, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}
pub fn set_mode(app: &tauri::AppHandle, mode: &str) -> Result<Value, String> {
    if !["hidden", "floating", "top-edge"].contains(&mode) {
        return Err("Unknown companion mode".into());
    }
    if mode == "hidden" {
        if let Some(window) = app.get_webview_window("companion") {
            window.close().map_err(|e| e.to_string())?;
        }
        // Window destruction also removes registration when the extension is gone.
        REGISTERED.store(false, std::sync::atomic::Ordering::SeqCst);
        return Ok(json!({"mode":"hidden"}));
    }
    if mode == "floating" {
        unregister()?;
    }
    let display = backend(app);
    let window = match app.get_webview_window("companion") {
        Some(w) => w,
        None => WebviewWindowBuilder::new(app, "companion", WebviewUrl::App("index.html".into()))
            .title("Duby companion")
            .initialization_script("window.__DUBY_COMPANION__ = true;")
            .inner_size(210.0, 238.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .skip_taskbar(true)
            .focused(false)
            .always_on_top(true)
            .build()
            .map_err(|e| e.to_string())?,
    };
    window.show().map_err(|e| e.to_string())?;
    if mode == "floating" && display == "x11" {
        window
            .set_visible_on_all_workspaces(false)
            .map_err(|e| e.to_string())?;
    }
    // Pass clicks through the transparent outer margin. Only the visible pet
    // and caption area is interactive; no full-screen input surface exists.
    if let Ok(widget) = window.gtk_window() {
        let region =
            gtk::cairo::Region::create_rectangle(&gtk::cairo::RectangleInt::new(30, 18, 150, 220));
        gtk::prelude::WidgetExt::input_shape_combine_region(&widget, Some(&region));
    }
    if mode == "top-edge" {
        if display == "x11" {
            let monitor = window
                .primary_monitor()
                .map_err(|e| e.to_string())?
                .ok_or("No primary monitor")?;
            let area = monitor.work_area();
            let width = (210.0 * monitor.scale_factor()).round() as i32;
            window
                .set_position(tauri::PhysicalPosition::new(
                    area.position.x + area.size.width as i32 - width - 24,
                    area.position.y + 8,
                ))
                .map_err(|e| e.to_string())?;
            window
                .set_visible_on_all_workspaces(true)
                .map_err(|e| e.to_string())?;
        } else {
            // GNOME compositor registration checks the D-Bus caller's PID, title
            // and application class. No arbitrary window ID can be submitted.
            if let Err(error) = extension() {
                let _ = window.close();
                return Err(error);
            }
        }
    }
    Ok(json!({"mode":mode,"backend":display,"experimental":mode == "top-edge"}))
}
