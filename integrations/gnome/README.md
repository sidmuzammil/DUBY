# GNOME integration: release gate remains open

The current app is a normal Tauri/GTK window. The true GLB renderer is implemented,
but GNOME Wayland panel anchoring has not been demonstrated in this headless build
machine. There is no enabled shell extension and no arbitrary window-control API.

The required next proof is a GNOME 45+ extension owning a panel action and positioning
only registered Duby windows (expected app ID plus process registration), with
monitor/scaling, window creation, focus, disable/re-enable and logout cleanup tests.
The application ID is `io.github.sidmuzammil.duby`, desktop entry `Duby.desktop`, and
StartupWMClass `duby`. Name matching alone is not sufficient registration evidence.

Do not turn a tray icon or standalone window into a passing flagship acceptance gate.
