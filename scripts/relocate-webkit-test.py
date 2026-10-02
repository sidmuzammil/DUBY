"""Cloud-only helper path relocation; never changes a shipped library or sandbox.

Debian's WebKit library hardcodes /usr/lib for its subprocess executables. In an
unprivileged cloud sysroot those executables live under /workspace. PRoot causes
filesystem EFAULT errors in Node/OpenClaw, so use a private library copy with only
that constant relocated. The original library and all production packages remain
untouched. A normal Linux installation does not need this test accommodation.
"""
from pathlib import Path
import hashlib
import json

root = Path('/workspace/toolchains')
helpers = root / 'wk41'
target = root / 'sysroot/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1'
if not helpers.exists():
    helpers.symlink_to(target, target_is_directory=True)
assert helpers.resolve() == target.resolve()
source = root / 'sysroot/usr/lib/x86_64-linux-gnu/libwebkit2gtk-4.1.so.0'
old = b'/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1\0'
new = str(helpers).encode() + b'\0'
data = source.read_bytes()
assert len(new) <= len(old) and data.count(old) == 1
patched = data.replace(old, new.ljust(len(old), b'\0'))
out = root / 'webkit-relocated'
out.mkdir(exist_ok=True)
(out / source.name).write_bytes(patched)
(out / 'relocation.json').write_text(json.dumps({
    'sourceSha256': hashlib.sha256(data).hexdigest(),
    'testCopySha256': hashlib.sha256(patched).hexdigest(),
    'changedConstant': old.decode().rstrip('\0'),
    'replacement': str(helpers),
    'productionLibraryUnchanged': True,
    'sandboxDisabled': False,
}, indent=2) + '\n')
print('Cloud test helper path prepared:', out)
