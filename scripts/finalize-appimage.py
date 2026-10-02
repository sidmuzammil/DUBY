"""Finalize a relocatable AppDir while using the host's matching WebKit stack.

WebKitGTK subprocesses have an installation-specific helper path. Bundling only
its shared objects can load mismatched or missing host helpers, so this AppImage
explicitly requires system WebKitGTK 4.1 (as the native installers do).
"""
from pathlib import Path
import json, shutil, os
root=Path(__file__).resolve().parents[1]
app=root/'target/release/bundle/appimage/Duby.AppDir'
assert app.is_dir()
for pattern in ['libwebkit2gtk-4.1.so*','libjavascriptcoregtk-4.1.so*']:
 for file in (app/'usr/lib').glob(pattern):file.unlink()
sysroot=Path('/workspace/toolchains/sysroot')
hook=app/'apprun-hooks/linuxdeploy-plugin-gtk.sh'
hook.write_text(hook.read_text().replace('/workspace/toolchains/sysroot',''))
schemas=app/'usr/share/glib-2.0/schemas'
schemas.mkdir(parents=True,exist_ok=True)
source=sysroot/'usr/share/glib-2.0/schemas'
if not source.exists():source=Path('/usr/share/glib-2.0/schemas')
for file in source.glob('*'):
 if file.is_file():shutil.copy2(file,schemas/file.name)
# linuxdeploy cannot query dpkg ownership for an unprivileged extracted sysroot.
# Preserve those original package notices alongside the host notices it found.
if sysroot.exists():
 for notice in (sysroot/'usr/share/doc').glob('*/copyright'):
  dest=app/'usr/share/doc'/notice.parent.name/'copyright'
  dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(notice,dest)
data=app/'usr/share/duby'
data.mkdir(parents=True,exist_ok=True)
shutil.copytree(root/'integrations/gnome',data/'gnome',dirs_exist_ok=True)
(data/'runtime-requirements.json').write_text(json.dumps({
 'baseline':'Debian 13 x86_64, glibc >= 2.41',
 'hostLibraries':['libwebkit2gtk-4.1.so.0','libjavascriptcoregtk-4.1.so.0'],
 'hostHelpers':'Matching system WebKitGTK subprocesses and sandbox dependencies are required.',
 'modelIncluded':False,
},indent=2)+'\n')
print('AppDir finalized; system WebKitGTK is an explicit prerequisite.')
