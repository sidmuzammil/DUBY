import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const NAME = 'org.gnome.Shell.Extensions.Duby';
const PATH = '/org/gnome/Shell/Extensions/Duby';
const XML = `<node><interface name="${NAME}">
  <method name="Register"><arg name="registered" type="b" direction="out"/></method>
  <method name="Unregister"/>
</interface></node>`;
const allowedClasses = new Set(['duby', 'io.github.sidmuzammil.duby']);

export default class DubyAnchor extends Extension {
    enable() {
        this._registrations = new Map();
        this._sources = new Set();
        this._enabled = true;
        this._object = Gio.DBusExportedObject.wrapJSObject(XML, this);
        this._object.export(Gio.DBus.session, PATH);
        this._owner = Gio.bus_own_name_on_connection(Gio.DBus.session, NAME,
            Gio.BusNameOwnerFlags.NONE, null, null);
        this._signals = [
            [Main.layoutManager, Main.layoutManager.connect('monitors-changed', () => this._placeAll())],
            [global.display, global.display.connect('workareas-changed', () => this._placeAll())],
            [Main.sessionMode, Main.sessionMode.connect('updated', () => this._visibility())],
            [Main.overview, Main.overview.connect('showing', () => this._visibility(true))],
            [Main.overview, Main.overview.connect('hidden', () => this._visibility(false))],
        ];
    }

    async RegisterAsync(_parameters, invocation) {
        try {
            // The bus authenticates the caller. Never accept a caller-supplied
            // process ID, target window ID, coordinates, script or command.
            const sender = invocation.get_sender();
            const reply = Gio.DBus.session.call_sync('org.freedesktop.DBus',
                '/org/freedesktop/DBus', 'org.freedesktop.DBus',
                'GetConnectionUnixProcessID', new GLib.Variant('(s)', [sender]),
                new GLib.VariantType('(u)'), Gio.DBusCallFlags.NONE, 1000, null);
            const [pid] = reply.deep_unpack();
            let window;
            for (let attempt = 0; attempt < 16 && this._enabled; attempt++) {
                window = global.get_window_actors().map(actor => actor.meta_window).find(w =>
                    w.get_pid() === pid && w.get_title() === 'Duby companion' &&
                    allowedClasses.has((w.get_wm_class() || '').toLowerCase()));
                if (window)
                    break;
                await this._delay();
            }
            if (!window || !this._enabled) {
                invocation.return_value(new GLib.Variant('(b)', [false]));
                return;
            }
            if (!this._registrations.has(window)) {
                const unmanaged = window.connect('unmanaged', () => this._remove(window));
                const watch = Gio.bus_watch_name_on_connection(Gio.DBus.session, sender,
                    Gio.BusNameWatcherFlags.NONE, null, () => this._remove(window));
                this._registrations.set(window, {unmanaged, watch, sender});
            }
            window.make_above();
            window.stick();
            this._place(window);
            this._visibility();
            invocation.return_value(new GLib.Variant('(b)', [true]));
        } catch (error) {
            invocation.return_dbus_error(`${NAME}.RegistrationFailed`,
                'The caller could not be matched to a Duby companion window.');
            console.error(`Duby anchor registration: ${error.message}`);
        }
    }

    UnregisterAsync(_parameters, invocation) {
        const sender = invocation.get_sender();
        for (const [window, registration] of this._registrations) {
            if (registration.sender !== sender)
                continue;
            const actor = window.get_compositor_private();
            if (actor)
                actor.show();
            window.unstick();
            this._remove(window);
        }
        invocation.return_value(null);
    }

    _delay() {
        return new Promise(resolve => {
            const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._sources.delete(id);
                resolve();
                return GLib.SOURCE_REMOVE;
            });
            this._sources.add(id);
        });
    }

    _place(window) {
        const index = Main.layoutManager.primaryIndex;
        if (index < 0)
            return;
        const area = Main.layoutManager.getWorkAreaForMonitor(index);
        const frame = window.get_frame_rect();
        // Mutter uses logical coordinates, including fractional scaling.
        window.move_frame(false, area.x + Math.max(0, area.width - frame.width - 24), area.y + 8);
    }

    _placeAll() {
        for (const window of this._registrations.keys())
            this._place(window);
    }

    _visibility(overview = Main.overview.visible) {
        const hide = Main.sessionMode.isLocked || overview;
        for (const window of this._registrations.keys()) {
            const actor = window.get_compositor_private();
            if (actor)
                actor.visible = !hide;
        }
    }

    _remove(window) {
        const registration = this._registrations.get(window);
        if (!registration)
            return;
        this._registrations.delete(window);
        window.disconnect(registration.unmanaged);
        Gio.bus_unwatch_name(registration.watch);
    }

    disable() {
        this._enabled = false;
        for (const [object, signal] of this._signals)
            object.disconnect(signal);
        for (const window of [...this._registrations.keys()]) {
            const actor = window.get_compositor_private();
            if (actor)
                actor.show();
            window.unmake_above();
            window.unstick();
            this._remove(window);
        }
        // Pending registration timers resolve once, observe _enabled=false,
        // and complete their D-Bus replies; none survive more than 100 ms.
        this._object.unexport();
        Gio.bus_unown_name(this._owner);
    }
}
