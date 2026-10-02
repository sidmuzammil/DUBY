# KDE integration: release gate remains open

KDE Plasma Wayland panel anchoring and layer-shell role creation are not implemented
or validated. The native standalone window is the current fallback. Do not apply
layer-shell to an already-realized Tauri window or use XWayland as a policy bypass.

The next proof must assign the window role before realization using a maintained
integration, and test show/hide/close/reopen, input regions, fractional scaling,
monitor removal, fullscreen/focus and renderer ownership on a named Plasma release.
No desktop-wide remote-control surface should be introduced to obtain anchoring.
