#!/usr/bin/env python3
"""Validate normative schemas and positive/hostile fixtures. Requires jsonschema==4.26.0."""
from pathlib import Path
from copy import deepcopy
from urllib.parse import urlsplit
import json,re
from jsonschema import Draft202012Validator,FormatChecker
R=Path(__file__).resolve().parents[1]
checks=0
def load(p):return json.loads((R/p).read_text(encoding='utf-8'))
validators={}
for path in (R/'contracts').glob('*.schema.json'):
    schema=json.loads(path.read_text(encoding='utf-8'));Draft202012Validator.check_schema(schema)
    validators[path.name]=Draft202012Validator(schema,format_checker=FormatChecker());checks+=1
manifest_validator=validators['plugin-manifest.schema.json']
def safe_path(path):
    return isinstance(path,str) and bool(re.fullmatch(r'[A-Za-z0-9._/-]{1,240}',path)) and all(x not in ('','.','..') and not x.endswith('.') for x in path.split('/'))
def valid_manifest(d):
    if list(manifest_validator.iter_errors(d)):return False
    paths=[d['source']['directory']]
    if 'ui' in d:
        paths.append(d['ui']['entry'])
        if 'style' in d['ui']:paths.append(d['ui']['style'])
        if d['ui']['profile']=='host-rendered' and not d['ui']['entry'].endswith('.json'):return False
    if 'service' in d:
        paths.append(d['service']['entry'])
        if not d['service']['entry'].endswith('.wasm'):return False
    if not all(safe_path(p) for p in paths):return False
    permission_ids=[p['id'] for p in d['permissions']]
    if len(permission_ids)!=len(set(permission_ids)):return False
    for p in d['permissions']:
        if p['capability']=='network.http':
            for rule in p['scope']['rules']:
                u=urlsplit(rule['origin'])
                if u.scheme!='https' or u.username or u.password or u.path or u.query or u.fragment:return False
                if not u.hostname or any(c in u.hostname for c in '*[]:'):return False
                if re.fullmatch(r'[0-9.]+',u.hostname) or re.search(r'(?:^|\.)(localhost|local|internal)$',u.hostname):return False
                try:
                    if u.port is not None and not (1 <= u.port <= 65535):return False
                except ValueError:return False
                for prefix in rule['pathPrefixes']:
                    if not prefix.startswith('/') or '?' in prefix or '#' in prefix or '%' in prefix:return False
                    if prefix!='/' and not safe_path(prefix[1:].rstrip('/')):return False
    return True
fixtures=list((R/'examples/manifests').glob('*.json'))
for p in fixtures:
    assert valid_manifest(json.loads(p.read_text(encoding='utf-8'))),p.name;checks+=1
base=load('examples/manifests/notebook.json')
mutations=[
 ('unknown top-level',lambda d:d.update({'arbitraryCode':'x'})),
 ('missing version',lambda d:d.pop('version')),
 ('bad host major',lambda d:d['hostApi'].update({'major':9})),
 ('path traversal',lambda d:d['ui'].update({'entry':'ui/../../payload.js'})),
 ('host renderer cannot execute JS',lambda d:d['ui'].update({'profile':'host-rendered'})),
 ('unknown UI profile',lambda d:d['ui'].update({'profile':'trusted-host'})),
 ('unknown scope',lambda d:d['permissions'][0]['scope'].update({'allFiles':True})),
 ('negative quota',lambda d:d['permissions'][0]['scope'].update({'quotaBytes':-1})),
 ('AI no background',lambda d:d['permissions'][1]['scope'].update({'background':True})),
 ('duplicate permission ID',lambda d:d['permissions'].append(deepcopy(d['permissions'][0]))),
 ('manifest API version mismatch',lambda d:d.update({'apiVersion':'v999'})),
 ('leading zero semver',lambda d:d.update({'version':'01.2.3'})),
 ('leading zero prerelease',lambda d:d.update({'version':'1.2.3-01'})),
 ('unknown wasm world',lambda d:d['service'].update({'world':'arbitrary:world/anything@1.0.0'})),
 ('source file traversal',lambda d:d['source'].update({'directory':'examples/../private'})),
 ('component is not WASM',lambda d:d['service'].update({'entry':'worker.js'})),
 ('resource over policy',lambda d:d['service'].update({'maxLinearMemoryMiB':99999})),
]
for name,mutate in mutations:
    d=deepcopy(base);mutate(d);assert not valid_manifest(d),name;checks+=1
for v in ['1.2.3-alpha.1','1.2.3+build.01','1.2.3-rc.1+sha.abc']:
    d=deepcopy(base);d['version']=v;assert valid_manifest(d),v;checks+=1
feed=load('examples/manifests/feed-reader.json')
network=next(p for p in feed['permissions'] if p['capability']=='network.http')
for origin in ['https://*.example.com','http://feeds.example.com','https://user@feeds.example.com','https://feeds.example.com/path','https://127.0.0.1','https://host.local','https://feeds.example.com:99999']:
    d=deepcopy(feed);next(p for p in d['permissions'] if p['capability']=='network.http')['scope']['rules'][0]['origin']=origin
    assert not valid_manifest(d),origin;checks+=1
rpc={'v':1,'id':'x','type':'request','method':'storage.get','params':{'key':'x'}}
rv=validators['rpc-request.schema.json'];assert rv.is_valid(rpc);checks+=1
for field in ['principal','pluginId','accessToken']:
    assert not rv.is_valid({**rpc,field:'forged'});checks+=1
assert not rv.is_valid({**rpc,'method':'shell.exec'});checks+=1
pending=load('evidence/release.pending.json');assert validators['evidence.schema.json'].is_valid(pending);checks+=1
# Shape-valid pending does NOT pass release evidence. The executable release gate checks completeness.
envelope={'format':'pwacloud.release.v1','pluginId':'dev.example.fixture','version':'1.0.0','sourceCommit':'a'*40,
 'archive':{'sha256':'b'*64,'bytes':100},'manifestSha256':'c'*64,
 'files':[{'path':'manifest.json','sha256':'c'*64,'bytes':50}],
 'sourceRepository':'https://github.com/example/fixture','componentWorld':None,'browserTransform':None}
ev=validators['release-envelope.schema.json'];assert ev.is_valid(envelope);checks+=1
for mutate in [lambda d:d['archive'].update({'sha256':'fake'}),lambda d:d['archive'].update({'bytes':-1}),lambda d:d.update({'executeHook':'evil'})]:
    d=deepcopy(envelope);mutate(d);assert not ev.is_valid(d);checks+=1
receipt={'format':'pwacloud.verification.v1','keyId':'fixture-root','pluginId':'dev.example.fixture','version':'1.0.0',
 'archiveSha256':'b'*64,'manifestSha256':'c'*64,'publisherIdentity':'fixture-only','policyVersion':'test-1',
 'verifiedAt':'2026-10-01T00:00:00Z','expiresAt':'2026-10-02T00:00:00Z','revocationSequence':0}
v=validators['verification-receipt.schema.json'];assert v.is_valid(receipt);checks+=1
for mutate in [lambda d:d.update({'keyId':''}),lambda d:d.update({'expiresAt':'not-a-date'}),lambda d:d.update({'revocationSequence':-1})]:
    d=deepcopy(receipt);mutate(d);assert not v.is_valid(d);checks+=1
print(json.dumps({'status':'passed','scope':'JSON Schema and semantic fixture checks only','checks':checks,'schemas':len(validators),'manifestFixtures':len(fixtures)},indent=2))
