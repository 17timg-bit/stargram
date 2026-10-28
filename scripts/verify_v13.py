"""Independently verify the actual v1.3 sample WAV/MIDI and portable app."""
from pathlib import Path
import array
import argparse
import hashlib
import json
import math
import sys
import wave
from verify_artifacts import parse_midi

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / '示例作品' / 'v1.3.0'
TITLE = '花园之外，还有星星'
state = json.loads((FOLDER / (TITLE + '.json')).read_text('utf-8'))
assert state['version'] == 2 and len(state['tracks']) == 5
assert sum(p >= 0 for t in state['tracks'] for p in t['notes']) == 19
tracks = parse_midi(FOLDER / (TITLE + '.mid'))
assert tracks[0]['tempo'] == round(60000000 / state['bpm'])
root, scale = {'dawn': (48, [0,2,4,7,9]), 'tide': (45, [0,3,5,7,10]), 'glass': (50, [0,2,5,7,9])}[state['scale']]
solo = any(t['solo'] for t in state['tracks'])
for index, track in enumerate(state['tracks']):
    notes, velocities = [], []
    for tick in range(64):
        step = (tick - track['shift']) % track['length']
        pitch = track['notes'][step]
        if pitch < 0 or track['muted'] or track['gain'] == 0 or (solo and not track['solo']):
            continue
        midi = root + [-1,0,1,2,2][index] * 12 + scale[pitch % 5] + pitch // 5 * 12
        notes.append([tick * 240, midi])
        velocities.append(min(127, max(1, math.floor(track['gain'] * track['accents'][step] * 95 + .5))))
    assert tracks[index + 1]['notes'] == notes
    assert tracks[index + 1]['velocities'] == velocities
with wave.open(str(FOLDER / (TITLE + '.wav'))) as audio:
    assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) == (2, 2, 44100)
    seconds = audio.getnframes() / audio.getframerate()
    assert abs(seconds - (64 * 30 / state['bpm'] + 3.2)) <= 1 / 44100
    pcm = array.array('h', audio.readframes(audio.getnframes()))
if sys.byteorder != 'little':
    pcm.byteswap()
peak = max(abs(x) for x in pcm) / 32768
rms = math.sqrt(sum(x*x for x in pcm) / len(pcm)) / 32768
clipped = sum(abs(x) >= 32767 for x in pcm)
assert 0 < peak <= .881 and clipped == 0
entry = (ROOT / 'index.html').read_bytes()
assert entry == (ROOT / '打开星轨留声机.html').read_bytes()
report = {
    'date': '2026-10-27', 'version': '1.3.0', 'sample': TITLE, 'map_version': 2,
    'wav': {'seconds': seconds, 'sample_rate': 44100, 'channels': 2, 'bit_depth': 16, 'peak_dbfs': 20 * math.log10(peak), 'rms_dbfs': 20 * math.log10(rms), 'clipped_samples': clipped},
    'midi': {'tracks': len(tracks), 'notes': sum(len(t['notes']) for t in tracks), 'pitch_time_velocity_match': True},
    'application': {'bytes': len(entry), 'sha256': hashlib.sha256(entry).hexdigest(), 'offline_and_web_identical': True},
    'files': [{'name': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(FOLDER.iterdir()) if p.suffix in ['.json', '.wav', '.mid']]
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--report', type=Path, default=Path('验证记录/v1.3.0/产物校验.json'), help='report path relative to the project root unless absolute')
args = parser.parse_args()
destination = args.report if args.report.is_absolute() else ROOT / args.report
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', 'utf-8', newline='\n')
print(json.dumps({key: value for key, value in report.items() if key != 'files'}, ensure_ascii=False, indent=2))
