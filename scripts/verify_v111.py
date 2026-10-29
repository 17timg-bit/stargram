"""Verify real portable manuscripts and the composition exported after retrieval."""
from pathlib import Path
import array
import copy
import hashlib
import json
import math
import struct
import sys
import wave
import zlib
from verify_artifacts import parse_midi

ROOT=Path(__file__).resolve().parent.parent
FOLDER=ROOT/'示例作品/v1.11.0'
first=json.loads((FOLDER/'把这一句留给明天.draft.json').read_text('utf-8'))
revised=json.loads((FOLDER/'把这一句留给明天_修订稿.draft.json').read_text('utf-8'))
for data in [first,revised]:
    assert data['format']=='stargram-draft' and data['version']==1 and data['index']==2
    assert data['base']['bpm']==72 and data['base']['scale']=='glass'
    assert data['base']['tracks'][2]['length']==16 and data['base']['tracks'][2]['shift']==3
    assert data['draft']['length']==24 and data['draft']['shift']==4
    for key in ['gain','muted','solo']:
        assert data['draft'][key]==data['base']['tracks'][2][key]
    assert not any(k in data for k in ['id','revision','history','appearance'])
def heard(track):
    return [(tick,track['notes'][(tick-track['shift'])%track['length']],track['accents'][(tick-track['shift'])%track['length']]) for tick in range(track['length']) if track['notes'][(tick-track['shift'])%track['length']]>=0]
assert heard(first['draft'])==[(1,8,.55),(23,2,1.35)]
assert heard(revised['draft'])==[(1,9,.55),(23,3,1.35)]
assert first['base']['volume']==.55 and revised['base']['volume']==.3

title='未完星笺_续写样片'
state=json.loads((FOLDER/(title+'.json')).read_text('utf-8'))
expected=copy.deepcopy(first['base']);expected['volume']=.3;expected['title']=title;expected['tracks'][first['index']]=copy.deepcopy(first['draft'])
assert state==expected
midi=parse_midi(FOLDER/(title+'.mid'))
assert len(midi)==6 and midi[0]['tempo']==round(60000000/state['bpm'])
root,scale={'dawn':(48,[0,2,4,7,9]),'tide':(45,[0,3,5,7,10]),'glass':(50,[0,2,5,7,9])}[state['scale']]
solo=any(t['solo'] for t in state['tracks'])
for index,t in enumerate(state['tracks']):
    notes,velocities=[],[]
    for tick in range(64):
        step=(tick-t['shift'])%t['length'];pitch=t['notes'][step]
        if pitch<0 or t['muted'] or t['gain']==0 or (solo and not t['solo']):continue
        notes.append([tick*240,root+[-1,0,1,2,2][index]*12+scale[pitch%5]+pitch//5*12])
        velocities.append(min(127,max(1,math.floor(t['gain']*t['accents'][step]*95+.5))))
    assert midi[index+1]['notes']==notes and midi[index+1]['velocities']==velocities
with wave.open(str(FOLDER/(title+'.wav'))) as audio:
    assert (audio.getnchannels(),audio.getsampwidth(),audio.getframerate())==(2,2,44100)
    seconds=audio.getnframes()/44100
    assert abs(seconds-(64*30/state['bpm']+3.2))<=1/44100
    pcm=array.array('h',audio.readframes(audio.getnframes()))
if sys.byteorder!='little':pcm.byteswap()
peak=max(abs(x) for x in pcm)/32768;rms=math.sqrt(sum(x*x for x in pcm)/len(pcm))/32768
clipped=sum(abs(x)>=32767 for x in pcm);assert 0<peak<=.881 and clipped==0
png=(FOLDER/(title+'.png')).read_bytes()
assert png[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',png[16:24])==(1600,1200)
offset=8
while offset<len(png):
    length=struct.unpack('>I',png[offset:offset+4])[0];payload=png[offset+4:offset+8+length]
    assert zlib.crc32(payload)&0xffffffff==struct.unpack('>I',png[offset+8+length:offset+12+length])[0]
    offset+=length+12
assert offset==len(png)
app=(ROOT/'index.html').read_bytes();assert app==(ROOT/'打开星轨留声机.html').read_bytes()
report={'date':'2026-10-29','version':'1.11.0','source':'实际界面下载的两份手稿文件，及取回原稿、应用后实际下载的四种作品文件','portable_files':{'count':2,'original_and_draft_exact':True,'revised_pitches_preserve_phase_and_accents':True},'retrieved_composition':{'all_source_parameters_and_other_tracks_match':True,'retained_volume':.3,'applied_draft_matches_file':True},'wav':{'seconds':seconds,'sample_rate':44100,'channels':2,'bit_depth':16,'peak_dbfs':20*math.log10(peak),'rms_dbfs':20*math.log10(rms),'clipped_samples':clipped},'midi':{'tracks':len(midi),'notes':sum(len(t['notes']) for t in midi),'pitch_time_velocity_match':True},'png':{'width':1600,'height':1200,'chunk_crc_valid':True},'application':{'bytes':len(app),'sha256':hashlib.sha256(app).hexdigest(),'offline_and_web_identical':True},'files':[{'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(FOLDER.iterdir()) if p.suffix in ['.json','.wav','.mid','.png']]}
(ROOT/'验证记录/v1.11.0/产物校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['source','files']},ensure_ascii=True,indent=2))
