# Third-party notices

Duby first-party source is MIT. Its original artwork is separately CC BY 4.0.

- **OpenClaw**, copyright 2026 OpenClaw Foundation, MIT: the unmodified runtime and
  public Gateway client/protocol packages are normally installed dependencies.
  Full license and incorporated third-party notices are preserved in
  `docs/upstream/OpenClaw-MIT.txt` and `docs/upstream/OpenClaw-THIRD-PARTY.md`.
- **Coucou**, copyright 2026 Louis Raillé: reviewed as a reference; no source or asset
  files are incorporated in the executable. Its code license and separate restrictive
  asset license are recorded in `docs/upstream/`. No Mochi artwork, character drawing
  code, animations, media, sounds or identity are shipped.
- **Inter**, copyright the Inter Project Authors, SIL Open Font License 1.1: a local
  Latin variable font subset is bundled. See `assets/fonts/LICENSE-Inter.txt`.
- **Three.js**, MIT; **React**, MIT; **Lucide**, ISC; **Tauri**, MIT/Apache-2.0;
  **cap-std/cap-fs-ext**, Apache-2.0 with LLVM exception or Apache-2.0/MIT as declared;
  **rusqlite**, MIT. Exact versions and license metadata are recorded by the lockfiles
  and installed packages. Native host libraries retain their own distribution licenses.
- The bundled **Node.js** runtime and npm dependencies retain their own licenses.
  Packaging includes the installed package metadata and license files. Node's full
  distribution license must accompany the bundled executable (see staging script).

The generated `docs/dependency-licenses.json` inventories npm package license
metadata. It is an audit aid, not a replacement for each dependency's license text.
Do not remove legal notices when rebranding or updating dependencies.

## npm dependency security repack

The runtime uses npm 11.20.0-duby.1, a marked dependency-only repack of npm
11.20.0 replacing three bundled packages with patched upstream releases. See
`vendor/README.md` and `vendor/npm-patch.json`. Original/replacement license files
are preserved inside the archive; OpenClaw executable source remains unchanged.
