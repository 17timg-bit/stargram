"""Independent validation of exported files; standard Python library only."""
from pathlib import Path
import array
import hashlib
import json
import math
import struct
import wave

ROOT = Path(__file__).resolve().parent.parent
SCALES = {'dawn': (48, [0,2,4,7,9]), 'tide': (45,[0,3,5,7,10]), 'glass': (50,[0,2,5,7,9])}
OCTAVES = [-1,0,1,2,2]

def parse_midi(path):
    raw = path.read_bytes()
    assert raw[:4] == b'MThd' and struct.unpack('>IHHH', raw[4:14]) == (6,1,6,480)
    tracks, pos = [], 14
    while pos < len(raw):
        assert raw[pos:pos+4] == b'MTrk'
        end = pos + 8 + int.from_bytes(raw[pos+4:pos+8], 'big')
        p, time, active, notes, tempo, name, ended = pos+8, 0, {}, [], None, None, False
        def vlq():
            nonlocal p
            value = 0
            for _ in range(4):
                b = raw[p]; p += 1; value = (value << 7) | (b & 127)
                if not b & 128: return value
            raise AssertionError('Invalid VLQ')
        while p < end:
            time += vlq(); status = raw[p]; p += 1
            if status == 255:
                kind = raw[p]; p += 1; size = vlq()
                if kind == 81: tempo = int.from_bytes(raw[p:p+size], 'big')
                if kind == 3: name = raw[p:p+size].decode('ascii')
                if kind == 47: ended = True
                p += size
            elif status & 240 == 192: p += 1
            else:
                pitch, velocity = raw[p:p+2]; p += 2; key = (status & 15, pitch)
                if status & 240 == 144 and velocity:
                    assert key not in active; active[key] = time; notes.append([time, pitch])
                else:
                    assert key in active and time > active[key]; del active[key]
        assert p == end and not active and ended
        tracks.append({'name':name,'tempo':tempo,'notes':notes,'end':time}); pos = end
    assert len(tracks) == 6 and pos == len(raw)
    return tracks

results = []
for path in sorted((ROOT/'示例作品'/'星图').glob('*.json')):
    state = json.loads(path.read_text('utf-8'))
    audio = ROOT/'示例作品'/'音乐'/(path.stem+'.wav')
    midi = ROOT/'示例作品'/'音乐'/(path.stem+'.mid')
    with wave.open(str(audio)) as wav:
        assert wav.getnchannels() == 2 and wav.getsampwidth() == 2 and wav.getframerate() == 44100
        duration = wav.getnframes()/wav.getframerate()
        assert abs(duration-(64*30/state['bpm']+3.2)) < 1/44100 + 1e-8
        data = array.array('h', wav.readframes(wav.getnframes()))
    peak = max(abs(v) for v in data)/32768
    rms = math.sqrt(sum(v*v for v in data)/len(data))/32768
    clipped = sum(abs(v) >= 32767 for v in data)
    assert 0.0001 < peak <= 0.881 and clipped == 0
    tracks = parse_midi(midi)
    assert tracks[0]['tempo'] == math.floor(60000000/state['bpm']+.5)
    root, scale = SCALES[state['scale']]
    for i, track in enumerate(state['tracks']):
        expected = []
        for tick in range(64):
            pitch = track['notes'][(tick-track['shift']) % track['length']]
            if not track['muted'] and pitch >= 0 and track['gain'] > 0:
                expected.append([tick*240,root+OCTAVES[i]*12+scale[pitch%5]+pitch//5*12])
        assert tracks[i+1]['notes'] == expected
    results.append({'title':state['title'],'seconds':round(duration,6),'sample_rate':44100,'channels':2,'bit_depth':16,'peak_dbfs':round(20*math.log10(peak),3),'rms_dbfs':round(20*math.log10(rms),3),'clipped_samples':clipped,'midi_tracks':6,'midi_notes':sum(len(t['notes']) for t in tracks),'midi_matches_map':True})
assert len(results) == 3, 'Expected three complete sample works'
postcards = []
for path in (ROOT/'示例作品'/'明信片').glob('*.png'):
    raw = path.read_bytes(); assert raw[:8] == b'\x89PNG\r\n\x1a\n'
    size = struct.unpack('>II',raw[16:24]); assert size == (1600,1200)
    postcards.append({'file':path.name,'width':size[0],'height':size[1]})
assert postcards, 'Missing exported postcard'
report = {'date':'2026-10-26','audio_and_midi':results,'postcards':postcards,'files':[]}
for path in sorted((ROOT/'示例作品').rglob('*')):
    if path.is_file(): report['files'].append({'path':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
entry = ROOT/'打开星轨留声机.html'
report['application'] = {'bytes':entry.stat().st_size,'sha256':hashlib.sha256(entry.read_bytes()).hexdigest()}
(ROOT/'验证记录'/'产物校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps({'works':results,'postcards':postcards,'checked_files':len(report['files'])},ensure_ascii=False,indent=2))
