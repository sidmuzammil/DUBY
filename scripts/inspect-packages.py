"""Inspect generated installers without installing them. Requires rpmfile==2.1.0.
Validates each embedded runtime checksum and records artifact identity, not distro compatibility.
"""
import hashlib
import io
import json
import pathlib
import subprocess
import tarfile
import tempfile
import rpmfile

root = pathlib.Path('.artifacts/packages')
def digest(stream):
    result = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        result.update(chunk)
    return result.hexdigest()

def inspect_entries(entries):
    names, archive_hash, manifest = [], None, None
    for name, stream in entries:
        names.append(name.lstrip('./'))
        if name.endswith('/runtime.tar.zst'):
            archive_hash = digest(stream)
        elif name.endswith('/runtime-manifest.json'):
            manifest = json.load(stream)
        elif name.endswith('/bin/duby'):
            assert stream.read(4) == b'\x7fELF'
    for required in ['usr/bin/duby', 'usr/lib/Duby/runtime.tar.zst', 'usr/lib/Duby/runtime-manifest.json', 'usr/share/applications/Duby.desktop']:
        assert required in names, required
    assert archive_hash and manifest and archive_hash == manifest['sha256']
    return len(names)

reports = []
for path in sorted(root.iterdir()):
    if path.suffix not in ['.deb', '.rpm', '.AppImage']:
        continue
    with path.open('rb') as stream:
        checksum = digest(stream)
    if path.suffix == '.AppImage':
        with tempfile.TemporaryDirectory(prefix='package-inspect-', dir='.artifacts') as directory:
            subprocess.run([str(path.resolve()), '--appimage-extract'], cwd=directory, check=True, stdout=subprocess.DEVNULL)
            app = pathlib.Path(directory) / 'squashfs-root'
            required = ['usr/bin/duby', 'usr/lib/Duby/runtime.tar.zst', 'usr/lib/Duby/runtime-manifest.json', 'usr/share/applications/Duby.desktop']
            streams = [(name, (app / name).open('rb')) for name in required]
            try:
                inspect_entries(streams)
            finally:
                for _, stream in streams:
                    stream.close()
            assert (app / 'AppRun').exists()
            assert not list((app / 'usr/lib').glob('libwebkit2gtk*')), 'Use the host WebKit and its matching helpers'
            requirements = json.loads((app / 'usr/share/duby/runtime-requirements.json').read_text())
            assert 'libwebkit2gtk-4.1.so.0' in requirements['hostLibraries']
            assert (app / 'usr/share/duby/gnome/duby@sidmuzammil.github.io/extension.js').is_file()
            count = sum(1 for entry in app.rglob('*') if entry.is_file())
    elif path.suffix == '.rpm':
        with rpmfile.open(str(path)) as rpm:
            assert b'libc.so.6(GLIBC_2.41)(64bit)' in rpm.headers['requirename']
            if 'archive_compression' not in rpm.headers:
                # rpmfile 2.1.0 assumes gzip for this valid uncompressed RPM case.
                # Confirm raw CPIO magic before using its ordinary CPIO parser.
                with path.open('rb') as stream:
                    stream.seek(rpm.data_offset)
                    raw = stream.read()
                assert raw.startswith(b'070701')
                rpm._data_file = io.BytesIO(raw)
            count = inspect_entries((m.name, rpm.extractfile(m)) for m in rpm.getmembers())
    else:
        depends = subprocess.check_output(['dpkg-deb', '-f', str(path), 'Depends'], text=True)
        assert 'libc6 (>= 2.41)' in depends
        process = subprocess.Popen(['dpkg-deb', '--fsys-tarfile', str(path)], stdout=subprocess.PIPE)
        with tarfile.open(fileobj=process.stdout, mode='r|') as archive:
            count = inspect_entries((m.name, archive.extractfile(m)) for m in archive if m.isfile())
        assert process.wait() == 0
    reports.append({'file': path.name, 'bytes': path.stat().st_size, 'sha256': checksum, 'payloadFiles': count, 'runtimeArchiveHashVerified': True})
report = {'packages': reports, 'baseline': 'Debian 13.6 x86_64, glibc 2.41', 'cleanSystemInstall': 'not performed', 'rpmDesktopInstall': 'not performed', 'signed': False}
pathlib.Path('docs/evidence/packages.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
