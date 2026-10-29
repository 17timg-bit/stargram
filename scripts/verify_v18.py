"""Independently read SL1, the actual received JSON and exported MIDI."""
from pathlib import Path
import base64
import argparse
import hashlib
import json
import math
from verify_artifacts import parse_midi

ROOT=Path(__file__).resolve().parent.parent
FOLDER=ROOT/'示例作品'/'v1.8.0'
TITLE='穿过玫瑰星云的信'
code=(FOLDER/(TITLE+'.txt')).read_text('utf-8').strip()
prefix,body,check=code.split('.')
assert prefix=='SL1' and len(code)<=4096
checksum=2166136261
for byte in body.encode('ascii'):
    checksum=((checksum^byte)*16777619)&0xffffffff
assert f'{checksum:08x}'==check
p=json.loads(base64.urlsafe_b64decode(body+'='*((-len(body))%4)))
alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVW'
tracks=[]
for length,shift,gain,muted,solo,stars in p[5]:
    values=[alphabet.index(c) for c in stars]
    tracks.append(dict(length=length,shift=shift,gain=gain,muted=bool(muted),solo=bool(solo),notes=[v//3-1 for v in values],accents=[[.55,1,1.35][v%3] for v in values]))
received=dict(format='stargram',version=2,title=p[0],bpm=p[1],scale=p[2],volume=p[3],space=p[4],tracks=tracks)
state=json.loads((FOLDER/(TITLE+'.json')).read_text('utf-8'))
assert received==state and p[6]=='SG1-4121'
midi=parse_midi(FOLDER/(TITLE+'.mid'))
assert midi[0]['tempo']==round(60000000/state['bpm'])
root,scale={'dawn':(48,[0,2,4,7,9]),'tide':(45,[0,3,5,7,10]),'glass':(50,[0,2,5,7,9])}[state['scale']]
solo=any(t['solo'] for t in tracks)
for index,t in enumerate(tracks):
    notes,velocities=[],[]
    for tick in range(64):
        step=(tick-t['shift'])%t['length'];pitch=t['notes'][step]
        if pitch<0 or t['muted'] or t['gain']==0 or (solo and not t['solo']):continue
        notes.append([tick*240,root+[-1,0,1,2,2][index]*12+scale[pitch%5]+pitch//5*12])
        velocities.append(min(127,max(1,math.floor(t['gain']*t['accents'][step]*95+.5))))
    assert midi[index+1]['notes']==notes and midi[index+1]['velocities']==velocities
app=(ROOT/'index.html').read_bytes()
assert app==(ROOT/'打开星轨留声机.html').read_bytes()
report={'date':'2026-10-29','version':'1.8.0','sample':TITLE,'sl1':{'characters':len(code),'checksum_valid':True,'exact_json_match':True,'recipe':p[6]},'midi':{'tracks':len(midi),'notes':sum(len(t['notes']) for t in midi),'pitch_time_velocity_match':True},'application':{'bytes':len(app),'sha256':hashlib.sha256(app).hexdigest(),'offline_and_web_identical':True},'files':[{'name':f.name,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(FOLDER.iterdir())]}
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--report',type=Path,default=Path('验证记录/v1.8.0/产物校验.json'))
args=parser.parse_args()
destination=args.report if args.report.is_absolute() else ROOT/args.report
destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8',newline='\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False,indent=2))
