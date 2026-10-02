# Experimental GNOME companion anchor

The optional extension positions the actual transparent Tauri/Three.js GLB window;
it does not replace the character with a panel icon. Install as your desktop user:

```bash
bash integrations/gnome/install.sh
```

Sign out and back in, enable **Duby companion anchor** in Extensions, then select
**Top edge · experimental** in Duby Settings. Floating mode works independently.
An unavailable extension returns an error and closes the attempted anchored surface.

`Register` accepts no target IDs, process IDs, coordinates, commands or scripts.
The extension gets the caller PID from D-Bus and requires a window owned by that PID
with Duby's title and expected application class. It handles delayed creation,
monitor/workarea changes, overview/lock visibility, caller loss and disable cleanup.
The native process holds its bus connection for the lifetime of the anchor.
`Unregister` also accepts no arguments and releases only that D-Bus caller's window
when switching back to floating mode.

This implementation has syntax checks, but **has not been exercised in a real
GNOME Wayland session**. GNOME 45–51 is a test target, not verified compatibility.
Creation timing, fractional scaling, multiple monitors, fullscreen, lock/unlock and
disable/re-enable remain acceptance gates. No general desktop-control or capture
interface is exposed.

Disable it in Extensions before removal. Its own directory is
`$XDG_DATA_HOME/gnome-shell/extensions/duby@sidmuzammil.github.io`, normally under
`~/.local/share`. No system files or shell profiles are changed.
