"""Measured process-tree cost on this cloud X11 machine, not a GPU/battery claim.

Only authenticates the Gateway. No model request or external provider call is made.
PSS apportions shared pages; sums include the native app, WebKit, bridge and Gateway.
"""
import time
started = time.monotonic()
import native_driver as ui
import os, json
from pathlib import Path

def processes():
    rows = {}
    for directory in Path('/proc').glob('[0-9]*'):
        try:
            stat = (directory / 'stat').read_text().rpartition(')')[2].split()
            rows[int(directory.name)] = (int(stat[1]), int(stat[11]) + int(stat[12]), directory)
        except (OSError, ValueError):
            pass
    selected = {ui.app.pid}
    while True:
        found = {pid for pid, (parent, _, _) in rows.items() if parent in selected}
        if found <= selected:
            break
        selected |= found
    return {pid: rows[pid] for pid in selected if pid in rows}

def memory(rows):
    totals = {'native': 0, 'webkit': 0, 'runtime': 0}
    for pid, (_, _, directory) in rows.items():
        try:
            command = (directory / 'cmdline').read_bytes().lower()
            group = 'native' if pid == ui.app.pid else 'webkit' if b'webkit' in command else 'runtime'
            for line in (directory / 'smaps_rollup').read_text().splitlines():
                if line.startswith('Pss:'):
                    totals[group] += int(line.split()[1])
        except (OSError, ValueError):
            pass
    return {group: round(value / 1024, 1) for group, value in totals.items()}

def sample():
    first = processes()
    start = time.monotonic()
    time.sleep(10)
    last = processes()
    elapsed = time.monotonic() - start
    ticks = sum(tick - first.get(pid, (0, 0, None))[1] for pid, (_, tick, _) in last.items())
    return {
        'seconds': round(elapsed, 2),
        'cpuPercentOfOneCore': round(ticks / os.sysconf('SC_CLK_TCK') / elapsed * 100, 2),
        'proportionalMemoryMiB': memory(last),
        'processCount': len(last),
    }

try:
    ui.find('Explore Duby first', timeout=60)
    first_ui = time.monotonic() - started
    ui.click('Explore Duby first')
    ui.find('Duby 3D companion, available.', timeout=30)
    # The locally bundled runtime is extracted on first start; let it settle.
    ui.click('Settings')
    ui.find('Model ID', kind='editable')
    ui.fill('Model ID', 'qwen3:8b')
    time.sleep(12)
    shell = sample()
    connect_start = time.monotonic()
    ui.click('Connect runtime')
    ui.find('Runtime connected', timeout=180)
    gateway_start = time.monotonic() - connect_start
    time.sleep(8)
    gateway = sample()
    report = {
        'environment': 'Debian 13.6 x86_64, Xvfb X11, software WebKitGTK rendering',
        'binary': ui.binary,
        'freshAppData': True,
        'timeToAccessibleOnboardingSeconds': round(first_ui, 2),
        'firstGatewayHandshakeSeconds': round(gateway_start, 2),
        'settledSettingsShellAndBridge': shell,
        'settledSettingsWithGateway': gateway,
        'modelRequests': 0,
        'limits': ['Single cloud sample, not a performance guarantee', 'Display server and compositor excluded', 'No GPU, battery, animation frame timing or local-model measurement', 'Automation overhead included in readiness timings'],
    }
    (ui.root / 'docs/evidence/native-performance.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    ui.close(); ui.cleanup()
finally:
    ui.close()
