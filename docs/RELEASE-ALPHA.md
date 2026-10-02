Duby 0.1.0 development alpha

A native Linux desktop companion with an animated 3D character, folder-scoped
text-file tools, saved conversations and optional AI connections. This is an early
alpha, not the completed flagship specification.

Download `Duby_0.1.0_amd64.deb` and `SHA256SUMS` into the same folder. Then run:

```sh
sha256sum -c SHA256SUMS
sudo apt install ./Duby_0.1.0_amd64.deb
duby
```

The installer requires x86_64, glibc 2.41 or newer, WebKitGTK 4.1, GTK 3 and
libsecret-tools. APT resolves dependencies during installation. Do not force an
installation with unmet dependencies. Ubuntu 26.04 installation and real desktop
compatibility have not yet been verified. The automated packaging runner is
Ubuntu 24.04; its successful build does not establish compatibility with that
older distribution because the package retains the glibc 2.41 baseline.

Native UI, 3D rendering and permission-controlled file operations were tested on
cloud X11 with Debian 13 libraries. AI integration checks use a local deterministic
fixture, not live model inference. Voice, screen/input automation, complete
Wayland integration and signed updates remain unfinished. AI models and provider
accounts are not bundled. See `docs/STATUS.md` for the exact feature scope.

The manual publishing workflow uses only a standard Linux GitHub Actions runner
on this public repository. It does not run on private repositories, use larger
runners, retain paid Actions artifacts, or make hosted AI calls. The installer is
downloaded again and checksum-verified before its draft release is published.
