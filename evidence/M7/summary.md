# Scoped tool runner and durable admission slice

Recorded 2026-10-01 23:00:14 UTC, Windows x64, Node 24.19.0. These are working-tree
observations; the integration owner records the final matching source commit and full-suite results.

`packages/broker/src/agent.ts` now implements a bounded deterministic `ScopedAgent`. The broker's
existing capability dispatch implementation was not changed. Call batches use a maintained schema
validator, explicit registered tools, JSON size/depth/node budgets and immutable snapshots. Whole-batch
validation happens before effects. Write confirmation sees the exact frozen arguments. A run checks
cancellation before and after approval, reads, admission and writes, passes the signal to callbacks,
and has a configurable deadline. A late approval cannot resume a cancelled write. Each admitted
callback can invoke its write only once.

Optional `admitWrite` supports a host-owned durable admission boundary. The selected-document adapter
uses the actual `PluginStorage.operationOnce`, scoped to workspace, plugin, digest, generation, stable
run ID and call ID. Confirmed or ambiguously failed writes cannot be automatically replayed. The only
adapter tools read the approved `selected-note` service handle and add one bounded Canvas card through
the actual capability broker. Tool inputs cannot select another principal, provider, arbitrary path,
shell command, installation or paid fallback.

Observed commands:

| Command | Exit | Result |
| --- | --- | --- |
| `tsx --test tests/production/agent.test.ts tests/production/framework.test.ts` | 0 | 13 passed, 0 failed/skipped; 9 new agent cases plus 4 existing framework regressions |
| `playwright test -c artifacts/agent-browser.config.ts agent.spec.ts` | 0 | Chromium and WebKit: 2 passed at 360 CSS pixels |
| `tsc --noEmit` | 0 | Integrated working-tree typecheck |
| `tsx scripts/lint.ts` | 0 | TypeScript and package boundary lint |

Node cases cover cancellation during pending and late approval, cancellation after a read, cancelled
deferred write admission, maximum steps, malicious tools and authority fields, exact argument snapshots,
denied writes, replay across recreated runners, ambiguous failures, deadlines, input budgets and double
invocation of an admission callback. The Node admission fixture is explicitly synthetic.

The browser fixture verifies actual locally signed example packages, installs them through the real
controller into IndexedDB, creates a broker-bound Canvas principal, reads the approved Notebook selected
note, rejects escalation and an unapproved write, persists one confirmed card, closes/reopens the actual
database and recreates the broker/runner. Replaying the same call is denied and the persisted board stays
unchanged. It uses synthetic selection/write approval callbacks and synthetic content; it does not claim
an authorized provider account or a real human approval observation.

Raw logs: `scoped-agent-test-output.txt` and `scoped-agent-browser-output.txt`. Public
`scoped-agent-browser-results.json` removes machine paths; the original remains under ignored
`artifacts/private-evidence/M7`. The integration owner's complete browser suite performs the final source
check after the last small callback-invocation guard (independently tested by the Node regression).

Final integration adds `runAgentLoop` with iterative untrusted selector decisions and immutable
correlated result history. Three additional tests prove multi-turn approved composition, global limits
across turns, denied tool escalation, and cancellation before a late selector response. All12 agent
tests pass; real model selection remains unverified. Executors must cooperate with cancellation; an already committed
write is not undone. The host must pause the board editor during composition to prevent a concurrent
editor update from replacing the same board state. No physical-device, always-on, provider-entitlement,
secret-isolation or hosted-release result is inferred from these tests.
