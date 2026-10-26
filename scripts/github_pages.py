"""Publish with the current Git credential helper. Never store or print credentials.

python scripts/github_pages.py inspect|create|enable|status
Git push uses Git's own credential manager separately.
"""
from pathlib import Path
import argparse
import json
import os
import subprocess
import urllib.error
import urllib.request

OWNER, REPOSITORY = '17timg-bit', 'stargram'
ROOT = Path(__file__).resolve().parent.parent
API = 'https://api.github.com'

def credential():
    env = os.environ.copy()
    env.update(GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never')
    result = subprocess.run(['git','credential','fill'], input='protocol=https\nhost=github.com\n\n', text=True, capture_output=True, env=env, timeout=30)
    fields = dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
    if result.returncode or not fields.get('password'):
        raise RuntimeError('No non-interactive GitHub credential is available.')
    return fields['password']

def request(token, method, path, body=None):
    headers = {'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Stargram-Publisher'}
    data = json.dumps(body).encode() if body is not None else None
    if data is not None: headers['Content-Type']='application/json'
    req = urllib.request.Request(API+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=45) as response:
            raw=response.read();return response.status,json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        try: message=json.loads(error.read()).get('message','GitHub API error')
        except Exception: message='GitHub API error'
        return error.code,{'message':message}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['inspect','create','enable','status']);args=parser.parse_args()
    token=credential()
    code,user=request(token,'GET','/user')
    if code!=200 or user.get('login')!=OWNER: raise RuntimeError('Git credential account does not match the intended GitHub owner.')
    base=f'/repos/{OWNER}/{REPOSITORY}'
    code,repo=request(token,'GET',base)
    if args.mode=='create':
        if code==404:
            code,repo=request(token,'POST','/user/repos',{'name':REPOSITORY,'description':'星轨留声机 · Stargram — an offline orbital music toy. 点亮星星，让轨道替你作曲。','private':False,'auto_init':False,'has_issues':True,'has_projects':False,'has_wiki':False})
            if code!=201:raise RuntimeError(f'Repository creation failed ({code}): '+repo.get('message',''))
        else:raise RuntimeError('Repository already exists or could not be inspected; inspect it before reusing.')
    if code not in [200,201]:
        print(json.dumps({'account':OWNER,'repository_exists':False,'http_status':code,'message':repo.get('message')},ensure_ascii=False));return
    output={'account':OWNER,'repository':repo['full_name'],'repository_url':repo['html_url'],'private':repo['private'],'empty':repo['size']==0,'default_branch':repo['default_branch']}
    pages_code,pages=request(token,'GET',base+'/pages')
    if args.mode=='enable':
        if pages_code==404:
            pages_code,pages=request(token,'POST',base+'/pages',{'source':{'branch':'main','path':'/'},'build_type':'legacy'})
            if pages_code!=201:raise RuntimeError(f'Pages creation failed ({pages_code}): '+pages.get('message',''))
        elif pages_code!=200:raise RuntimeError(f'Pages inspection failed ({pages_code}).')
        if pages.get('source')!={'branch':'main','path':'/'}:raise RuntimeError('Unexpected existing Pages source; no configuration was changed.')
    output['pages_http_status']=pages_code
    if pages_code in [200,201]:
        output['pages']={key:pages.get(key) for key in ['html_url','status','build_type','source','https_enforced']}
        build_code,build=request(token,'GET',base+'/pages/builds/latest')
        output['latest_build_http_status']=build_code
        if build_code==200:output['latest_build']={key:build.get(key) for key in ['status','commit','duration','error','created_at','updated_at']}
    print(json.dumps(output,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
