"""Independently parse the three generated WAV/MIDI samples exported by the app."""
from pathlib import Path
import array
import hashlib
import json
import math
import sys
import wave
from verify_artifacts import parse_midi

ROOT=Path(__file__).resolve().parent.parent
FOLDER=ROOT/'示例作品'/'v1.9.0'
manifest=json.loads((FOLDER/'样片说明.json').read_text('utf-8'))
results=[]
for item in manifest:
    name=item['style']
    s=json.loads((FOLDER/(name+'.json')).read_text('utf-8'))
    assert s['title']==item['title'] and s['bpm']==item['bpm'] and s['scale']==item['scale'] and s['space']==item['space'] and s['volume']==.55
    assert [t['length'] for t in s['tracks']]==item['periods']
    midi=parse_midi(FOLDER/(name+'.mid'))
    assert midi[0]['tempo']==round(60000000/s['bpm'])
    root,scale={'dawn':(48,[0,2,4,7,9]),'tide':(45,[0,3,5,7,10]),'glass':(50,[0,2,5,7,9])}[s['scale']]
    solo=any(t['solo'] for t in s['tracks'])
    for index,t in enumerate(s['tracks']):
        notes,velocities=[],[]
        for tick in range(64):
            step=(tick-t['shift'])%t['length'];pitch=t['notes'][step]
            if pitch<0 or t['muted'] or t['gain']==0 or (solo and not t['solo']):continue
            notes.append([tick*240,root+[-1,0,1,2,2][index]*12+scale[pitch%5]+pitch//5*12])
            velocities.append(min(127,max(1,math.floor(t['gain']*t['accents'][step]*95+.5))))
        assert midi[index+1]['notes']==notes and midi[index+1]['velocities']==velocities
    with wave.open(str(FOLDER/(name+'.wav'))) as audio:
        assert (audio.getnchannels(),audio.getsampwidth(),audio.getframerate())==(2,2,44100)
        seconds=audio.getnframes()/44100
        assert abs(seconds-(64*30/s['bpm']+3.2))<=1/44100
        pcm=array.array('h',audio.readframes(audio.getnframes()))
    if sys.byteorder!='little':pcm.byteswap()
    peak=max(abs(x) for x in pcm)/32768
    rms=math.sqrt(sum(x*x for x in pcm)/len(pcm))/32768
    clipped=sum(abs(x)>=32767 for x in pcm)
    assert 0<peak<=.881 and clipped==0
    results.append({'style':name,'bpm':s['bpm'],'scale':s['scale'],'space':s['space'],'periods':item['periods'],'wav':{'seconds':seconds,'sample_rate':44100,'channels':2,'bit_depth':16,'peak_dbfs':20*math.log10(peak),'rms_dbfs':20*math.log10(rms),'clipped_samples':clipped},'midi':{'tracks':len(midi),'notes':sum(len(t['notes']) for t in midi),'pitch_time_velocity_match':True}})
app=(ROOT/'index.html').read_bytes()
assert app==(ROOT/'打开星轨留声机.html').read_bytes()
report={'date':'2026-10-29','version':'1.9.0','samples':results,'application':{'bytes':len(app),'sha256':hashlib.sha256(app).hexdigest(),'offline_and_web_identical':True},'files':[{'name':f.name,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(FOLDER.iterdir())]}
(ROOT/'验证记录'/'v1.9.0'/'产物校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8',newline='\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False,indent=2))
