# Pinned npm dependency patch

OpenClaw 2026.9.7 is unmodified. Its npm 11.20.0 dependency bundled packages with
three published advisories that ordinary overrides could not replace. The marked
`npm-11.20.0-duby.1.tgz` repack replaces only these directories:

| Package | Original | Patched |
| --- | --- | --- |
| brace-expansion | 5.0.9 | 5.0.12 |
| ip-address | 10.5.0 | 10.7.2 |
| undici | 6.28.0 | 6.28.1 |

The manifest version is marked `11.20.0-duby.1`. No npm executable source is changed;
all licenses remain included. The root lockfile pins the archive and an explicit
override directs OpenClaw to it through normal `npm ci`. Package installation and
npm execution remain unavailable to the model.

`node scripts/repack-npm.mjs` rebuilds from exact registry versions.
`npm-patch.json` records upstream SHA-512 integrity and final archive SHA-256.
Repinning requires repeating runtime, alternate-tool denial, credential-residue,
native and packaging checks.
