use serde_json::json;
use tauri::{Emitter, Manager};

/// Observe authenticated desktop/session signals. Unlock never resumes authority.
pub fn watch(app: &tauri::AppHandle) -> Vec<gio::DBusConnection> {
    let mut connections = Vec::new();
    for (bus, sender, path, interface, signal) in [
        (
            gio::BusType::Session,
            "org.freedesktop.ScreenSaver",
            "/org/freedesktop/ScreenSaver",
            "org.freedesktop.ScreenSaver",
            "ActiveChanged",
        ),
        (
            gio::BusType::Session,
            "org.gnome.ScreenSaver",
            "/org/gnome/ScreenSaver",
            "org.gnome.ScreenSaver",
            "ActiveChanged",
        ),
        (
            gio::BusType::System,
            "org.freedesktop.login1",
            "/org/freedesktop/login1",
            "org.freedesktop.login1.Manager",
            "PrepareForSleep",
        ),
    ] {
        let Ok(connection) = gio::bus_get_sync(bus, gio::Cancellable::NONE) else {
            continue;
        };
        let handle = app.clone();
        connection.signal_subscribe(Some(sender), Some(interface), Some(signal), Some(path), None, gio::DBusSignalFlags::NONE,
            move |_, _, _, _, _, parameters| {
                if parameters.get::<(bool,)>() != Some((true,)) { return; }
                let state = handle.state::<super::AppState>();
                state.broker.lock().unwrap().pause_all();
                let _ = handle.emit("duby-event", json!({"state":"paused","summary":"The desktop locked or is going to sleep. File operations are paused. Review access before resuming."}));
            });
        connections.push(connection);
    }
    connections
}
