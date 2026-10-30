#!/usr/bin/env python3
"""Smoke test of the Play MVP build on an Android emulator through adb + uiautomator.

Usage: python3 scripts/android_play_smoke.py <apk> <out_dir>
Writes screenshots, UI dumps and report.json into out_dir. Exits non-zero only when the app
crashes, does not start, or a methodology entry point is visible; timings are recorded for review.
"""
import json, re, subprocess, sys, time, xml.etree.ElementTree as ET
from pathlib import Path

PKG = 'com.andarfighttech.boxertimer'
APK, OUT = sys.argv[1], Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
report, failures = {'steps': []}, []


def adb(*args, check=True):
    return subprocess.run(['adb', *args], capture_output=True, text=True, check=check).stdout


def dump(tag):
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml', check=False)
    xml = adb('shell', 'cat', '/sdcard/ui.xml', check=False)
    (OUT / f'{tag}.xml').write_text(xml)
    with open(OUT / f'{tag}.png', 'wb') as f:
        f.write(subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True).stdout)
    try:
        return list(ET.fromstring(xml[xml.index('<'):]).iter('node'))
    except (ValueError, ET.ParseError):
        return []


def find(nodes, ids=(), texts=()):
    for n in nodes:
        rid, label = n.get('resource-id', ''), (n.get('text') or n.get('content-desc') or '').strip()
        if any(rid.endswith(i) for i in ids) or label in texts:
            return n
    return None


def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))


def remaining(nodes):
    """Seconds left in the whole workout (#metricRemaining, else the clock after «Осталось»)."""
    n = find(nodes, ids=('metricRemaining',))
    if n is None:
        labels = [(x.get('text') or x.get('content-desc') or '').strip() for x in nodes]
        for i, t in enumerate(labels):
            if t in ('Осталось', 'Remaining'):
                n = next((nodes[j] for j in range(i + 1, len(nodes)) if re.fullmatch(r'\d+:\d\d', labels[j])), None)
                break
    m = n is not None and re.fullmatch(r'(\d+):(\d\d)', (n.get('text') or n.get('content-desc') or '').strip())
    return int(m.group(1)) * 60 + int(m.group(2)) if m else None


def audio_players():
    uid = re.search(r'userId=(\d+)', adb('shell', 'dumpsys', 'package', PKG, check=False))
    out = adb('shell', 'dumpsys', 'audio', check=False)
    lines = [l.strip() for l in out.splitlines() if 'AudioPlaybackConfiguration' in l and uid and f'u/pid:{uid.group(1)}' in l]
    return {'players': len(lines), 'started': sum('state:started' in l for l in lines)}


def foreground():
    out = adb('shell', 'dumpsys', 'activity', 'activities', check=False)
    m = re.search(r'(?:mResumedActivity|topResumedActivity)[^\n]*', out)
    return bool(m and PKG in m.group(0))


def step(name, **data):
    report['steps'].append({'step': name, 't': round(time.time(), 1), **data})
    print(name, data, flush=True)


adb('install', '-r', APK)
badging = adb('shell', 'dumpsys', 'package', PKG)
report['targetSdk'] = (re.search(r'targetSdk=(\d+)', badging) or [None, None])[1]
report['versionName'] = (re.search(r'versionName=(\S+)', badging) or [None, None])[1]
adb('logcat', '-c')
adb('shell', 'am', 'start', '-W', '-n', f'{PKG}/.MainActivity')
time.sleep(12)
nodes = dump('01_main')
step('launch', foreground=foreground(), nodes=len(nodes), remaining=remaining(nodes))
if not foreground():
    failures.append('app is not in the foreground after launch')

# Library: Mine + Library visible, Tree / Methodology absent.
lib = find(nodes, ids=('programLibraryOpen',), texts=('Мои программы', 'My workouts', 'My programs'))
if lib is not None:
    tap(lib); time.sleep(3)
    nodes = dump('02_library_mine')
    labels = {(n.get('text') or n.get('content-desc') or '').strip() for n in nodes}
    hidden_seen = labels & {'Дерево', 'Методика', 'Tree', 'Methodology'}
    step('library_open', tabs_hidden_seen=sorted(hidden_seen), has_library_tab=bool(labels & {'Библиотека', 'Library'}))
    if hidden_seen:
        failures.append('methodology entry point visible: %s' % sorted(hidden_seen))
    tpl = find(nodes, ids=('programLibraryTemplates',), texts=('Библиотека', 'Library'))
    if tpl is not None:
        tap(tpl); time.sleep(3)
        nodes = dump('03_library_templates')
        step('library_templates', folders=[(n.get('text') or '').strip() for n in nodes if re.search(r'\d+$', (n.get('text') or '').strip())][:20])
    adb('shell', 'input', 'keyevent', '4'); time.sleep(2)   # Back closes the dialog
    nodes = dump('04_after_back')
    step('back_closes_library', foreground=foreground())
else:
    step('library_open', error='button not found in the UI dump')

# Workout: start, then lock the screen, Home, Back.
start = find(nodes, ids=('startBtn',), texts=('Старт', 'Start'))
if start is not None:
    tap(start); time.sleep(10)
    nodes = dump('05_running'); r0, t0 = remaining(nodes), time.time()
    step('running', remaining=r0, audio=audio_players())
    adb('shell', 'input', 'keyevent', '26'); time.sleep(3)            # power: screen off
    step('locked', audio=audio_players()); time.sleep(27)
    step('still_locked', audio=audio_players())
    adb('shell', 'input', 'keyevent', '224'); adb('shell', 'wm', 'dismiss-keyguard', check=False); time.sleep(4)
    nodes = dump('06_after_lock'); r1, t1 = remaining(nodes), time.time()
    step('after_lock', remaining=r1, wall_s=round(t1 - t0, 1), timer_s=(r0 - r1) if None not in (r0, r1) else None, foreground=foreground())
    adb('shell', 'input', 'keyevent', '3'); time.sleep(20)            # home
    step('background', audio=audio_players())
    adb('shell', 'am', 'start', '-n', f'{PKG}/.MainActivity'); time.sleep(4)
    nodes = dump('07_after_home'); r2, t2 = remaining(nodes), time.time()
    step('after_home', remaining=r2, wall_s=round(t2 - t1, 1), timer_s=(r1 - r2) if None not in (r1, r2) else None)
    adb('shell', 'input', 'keyevent', '4'); time.sleep(1)             # first Back during a workout only warns
    nodes = dump('08_back_once')
    step('back_once', foreground=foreground(), hint=any('Назад' in (n.get('text') or '') or 'Back again' in (n.get('text') or '') for n in nodes))
else:
    step('running', error='start button not found in the UI dump')

log = adb('logcat', '-d', check=False)
(OUT / 'logcat.txt').write_text(log)
crashes = [l for l in log.splitlines() if 'FATAL EXCEPTION' in l or ('AndroidRuntime' in l and PKG in l)]
js_errors = [l for l in log.splitlines() if 'Capacitor/Console' in l and ('ERROR' in l or 'Uncaught' in l)]
report.update(crashes=crashes[:20], js_errors=js_errors[:20], failures=failures)
if crashes:
    failures.append('crash in logcat')
(OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
print(json.dumps(report, ensure_ascii=False, indent=1))
sys.exit(1 if failures else 0)
