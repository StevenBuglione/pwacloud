#!/usr/bin/env python3
"""Structural handoff/SQLite audit, not product validation. No third-party dependencies."""
from pathlib import Path
import json,re,sqlite3,os
R=Path(__file__).resolve().parents[1]
checks=[]
def check(ok,label):
    if not ok:raise AssertionError(label)
    checks.append(label)
def load(p):return json.loads((R/p).read_text(encoding='utf-8'))
required=['README.md','AGENTS.md','CODEX_START.md','PUBLICATION_STATUS.md','LICENSE',
 'contracts/plugin-manifest.schema.json','contracts/plugin.wit','contracts/runtime.sql','contracts/openapi.json',
 'contracts/rpc-request.schema.json','contracts/evidence.schema.json','contracts/release-envelope.schema.json',
 'contracts/verification-receipt.schema.json','planning/acceptance-cases.json','planning/progress.json',
 'planning/milestones.json','planning/sources.json','scripts/publish-github.ts','scripts/verify-evidence.ts']
for p in required:check((R/p).is_file(),'required '+p)
for parent,dirs,files in os.walk(R):
    dirs[:]=[name for name in dirs if name not in {'node_modules','.git','.cache','artifacts','dist','target','test-results','playwright-report','runtime-data'}]
    for filename in files:
        if not filename.endswith('.json'):continue
        p=Path(parent)/filename
    # Exclude generated authoring reports, including this command's redirected stdout.
        if not p.is_relative_to(R/'evidence/authoring'):
            json.loads(p.read_text(encoding='utf-8'));checks.append('JSON parses '+str(p.relative_to(R)))
sources=load('planning/sources.json')['sources'];ids={s['id'] for s in sources}
check(len(ids)==len(sources),'unique source IDs')
for p in (R/'docs').rglob('*.md'):
    for match in re.finditer(r'\[(S\d{2}(?:,\s*S\d{2})*)\]',p.read_text(encoding='utf-8')):
        for sid in re.findall(r'S\d{2}',match.group()):check(sid in ids,'source exists '+sid)
    check('contracts/openapi.yaml' not in p.read_text(encoding='utf-8'),'current API path '+p.name)
ms=load('planning/milestones.json')['milestones'];case_list=load('planning/acceptance-cases.json')['cases']
cases={c['id']:c for c in case_list};mids={m['id'] for m in ms}
check(len(cases)==len(case_list),'unique acceptance IDs')
check(len(mids)==len(ms),'unique milestone IDs')
seen=set();mapped=[]
for m in ms:
    check(set(m['dependsOn'])<=seen,'dependency ordered '+m['id']);seen.add(m['id'])
    check((R/m['instructions']).is_file(),'milestone instructions '+m['id'])
    check(bool(m['acceptanceCases']),'nonempty cases '+m['id'])
    for cid in m['acceptanceCases']:
        check(cid in cases and cases[cid]['milestone']==m['id'],'case mapping '+cid);mapped.append(cid)
check(sorted(mapped)==sorted(cases),'each case mapped once')
for case in case_list:
    check(bool(case['passCriterion']) and bool(case['evidenceRequired']),'case has observable criterion '+case['id'])
    check(('hosted' in case['requiredFor']) and (('local-alpha' in case['requiredFor'])==(case['milestone']!='M11')),'release scope '+case['id'])
api=load('contracts/openapi.json');check(api['openapi']=='3.1.0','OpenAPI version')
ops=[]
for path,methods in api['paths'].items():
    for method,op in methods.items():
        if method=='parameters':continue
        check(bool(op['responses']),'API responses '+path);ops.append(op['operationId'])
        if path!='/health':check(op.get('security')==[{'appSession':[]}],'API session required '+path)
check(len(ops)==len(set(ops)),'unique API operation IDs')
# SQLite actual execution and isolation constraints.
db=sqlite3.connect(':memory:');db.executescript((R/'contracts/runtime.sql').read_text(encoding='utf-8'))
check(db.execute('PRAGMA foreign_keys').fetchone()[0]==1,'SQLite foreign keys enabled')
check(db.execute('SELECT version FROM schema_migrations').fetchone()[0]==1,'SQLite migration applied')
db.execute("INSERT INTO workspaces VALUES('w1','One',0)");db.execute("INSERT INTO workspaces VALUES('w2','Two',0)")
db.execute("INSERT INTO installs VALUES('w1','i1','plugin.one','digest',1,'ready','{}')")
db.execute("INSERT INTO installs VALUES('w2','i2','plugin.two','digest',1,'ready','{}')")
def refused(sql,params=()):
    try:db.execute(sql,params)
    except sqlite3.IntegrityError:return True
    return False
check(refused("INSERT INTO installs VALUES('missing','x','p','d',1,'ready','{}')"),'unknown workspace rejected')
check(refused("INSERT INTO installs VALUES('w1','x','p','d',0,'ready','{}')"),'zero generation rejected')
check(refused("INSERT INTO grants VALUES('w2','i1','g','ai.respond','{}',1,0,NULL)"),'cross-workspace grant FK rejected')
row=('r1','w1','i1',None,1,1,'synthetic-account','idem','reserved','demo',100,0)
run_sql="INSERT INTO runs(id,workspace_id,install_id,registration_id,generation,account_generation,account_key,idempotency_key,state,provider_mode,created_at,last_sequence) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)"
db.execute(run_sql,row)
check(refused(run_sql,('r2',*row[1:])),'duplicate idempotency key rejected')
check(refused(run_sql,('r3','w2','i1',None,1,1,'synthetic-account','other','reserved','demo',100,0)),'cross-workspace run rejected')
check(refused(run_sql,('r4','w1','i1',None,1,1,'synthetic-account','other','faked-success','demo',100,0)),'unknown run state rejected')
db.execute("INSERT INTO run_events VALUES('r1',1,'started','{}')")
check(refused("INSERT INTO run_events VALUES('r1',1,'again','{}')"),'duplicate event sequence rejected')
check(refused("INSERT INTO run_events VALUES('missing',1,'started','{}')"),'orphan event rejected')
check(refused("INSERT INTO usage_reservations VALUES('r1',100,NULL,-1,NULL)"),'negative usage bytes rejected')
for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type='table'"):
    columns=[r[1] for r in db.execute('PRAGMA table_info('+table+')')]
    check(not any(c in ('access_token','refresh_token','id_token','api_key') for c in columns),'no raw provider secret columns '+table)
print(json.dumps({'status':'passed','scope':'handoff structure and SQLite constraints only','checks':len(checks),'acceptanceCases':len(cases),'milestones':len(ms),'sources':len(ids)},indent=2))
