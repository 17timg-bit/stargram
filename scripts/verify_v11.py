"""Read actual v1.1 exports independently of the JavaScript sequencer."""
from pathlib import Path
import array
import hashlib
import json
import math
import sys
import wave
from verify_artifacts import parse_midi

ROOT=Path(__file__).resolve().parent.parent
FOLDER=ROOT/'示例作品'/'v1.1.0'
MAP=FOLDER/'薄荷色的回声.json'
state=json.loads(MAP.read_text('utf-8'))
assert state['format']=='stargram' and state['version']==2
tracks=parse_midi(FOLDER/'薄荷色的回声.mid')
scales={'dawn':(48,[0,2,4,7,9]),'tide':(45,[0,3,5,7,10]),'glass':(50,[0,2,5,7,9])}
root,scale=scales[state['scale']]
has_solo=any(t['solo'] for t in state['tracks'])
assert tracks[0]['tempo']==math.floor(60000000/state['bpm']+.5)
total=0
for i,t in enumerate(state['tracks']):
    notes,velocities=[],[]
    for tick in range(64):
        step=(tick-t['shift'])%t['length'];pitch=t['notes'][step]
        audible=not t['muted'] and t['gain']>0 and (not has_solo or t['solo'])
        if not audible or pitch<0:continue
        midi=root+[-1,0,1,2,2][i]*12+scale[pitch%5]+pitch//5*12
        notes.append([tick*240,midi]);velocities.append(min(127,max(1,math.floor(t['gain']*t['accents'][step]*95+.5))))
    assert tracks[i+1]['notes']==notes
    assert tracks[i+1]['velocities']==velocities
    total+=len(notes)
assert max(v for t in tracks for v in t['velocities'])==127
with wave.open(str(FOLDER/'薄荷色的回声.wav')) as wav:
    assert (wav.getnchannels(),wav.getsampwidth(),wav.getframerate())==(2,2,44100)
    seconds=wav.getnframes()/wav.getframerate()
    assert abs(seconds-(64*30/state['bpm']+3.2))<=1/44100
    pcm=array.array('h',wav.readframes(wav.getnframes()))
    if sys.byteorder!='little':pcm.byteswap()
peak=max(abs(v) for v in pcm)/32768
rms=math.sqrt(sum(v*v for v in pcm)/len(pcm))/32768
clipped=sum(abs(v)>=32767 for v in pcm)
assert 0<peak<=.881 and clipped==0
entry=ROOT/'打开星轨留声机.html'
assert entry.read_bytes()==(ROOT/'index.html').read_bytes()
report={'date':'2026-10-27','version':'1.1.0','map_version':2,'title':state['title'],'wav':{'seconds':seconds,'sample_rate':44100,'bit_depth':16,'channels':2,'peak_dbfs':20*math.log10(peak),'rms_dbfs':20*math.log10(rms),'clipped_samples':clipped},'midi':{'tracks':len(tracks),'notes':total,'pitch_time_velocity_match':True,'maximum_velocity':127},'application':{'bytes':entry.stat().st_size,'sha256':hashlib.sha256(entry.read_bytes()).hexdigest()},'files':[]}
for path in sorted(FOLDER.iterdir()):
    if path.is_file():report['files'].append({'path':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(ROOT/'验证记录'/'v1.1.0'/'产物校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8',newline='\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False,indent=2))
