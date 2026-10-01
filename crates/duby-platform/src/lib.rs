use serde_json::{json, Value};
use std::{env, process::Command};
/// Probe interfaces; a portal being present does not establish user consent.
pub fn capabilities() -> Value {
    let introspection = Command::new("gdbus")
        .args([
            "introspect",
            "--session",
            "--dest",
            "org.freedesktop.portal.Desktop",
            "--object-path",
            "/org/freedesktop/portal/desktop",
            "--timeout",
            "2",
        ])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();
    let keychain = Command::new("gdbus")
        .args([
            "introspect",
            "--session",
            "--dest",
            "org.freedesktop.secrets",
            "--object-path",
            "/org/freedesktop/secrets",
            "--timeout",
            "2",
        ])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    json!({"os":env::consts::OS,"arch":env::consts::ARCH,"session":env::var("XDG_SESSION_TYPE").unwrap_or("unknown".into()),"desktop":env::var("XDG_CURRENT_DESKTOP").unwrap_or("unknown".into()),"keychain":keychain,"window":"standalone","anchoring":"experimental; not verified on GNOME or KDE","portals":{"screenshot":introspection.contains("org.freedesktop.portal.Screenshot"),"screenCast":introspection.contains("org.freedesktop.portal.ScreenCast"),"remoteDesktop":introspection.contains("org.freedesktop.portal.RemoteDesktop"),"globalShortcuts":introspection.contains("org.freedesktop.portal.GlobalShortcuts")},"capture":"disabled","microphone":"disabled","shell":"disabled: no verified subprocess sandbox","network":"AI uses only the explicitly configured provider; OS-level offline enforcement not implemented"})
}
