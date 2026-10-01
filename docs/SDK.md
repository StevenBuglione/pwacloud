# SDK and embedding

`examples/minimal-host` uses workspace package exports to prove a second host. The framework packages have no Ionic dependency. Source workspace consumption is supported; npm publication is not performed.

```typescript
import {PluginStorage} from '@pwacloud/storage';
import {createPluginHost} from '@pwacloud/controller';
const storage = await PluginStorage.open('my-own-host');
const host = createPluginHost({storage});
await host.install(verifiedPackage, reviewedGrantIds);
const session = await host.mount(container, verifiedPackage.manifest.id);
session.close();
host.dispose();
storage.close();
```

Obtain `verifiedPackage` from `verifyPackage` or `RegistryClient` against independently configured public roots. Publishers cannot add trust roots to install packets. The browser authenticates to its runtime's `/v1/trust`, then verifies exact envelope and receipt signatures independently.

An independently bundled UI imports `connectPlugin` or a React/Lit adapter, validates results with maintained schemas, handles typed denials and disposes listeners. Storage receives keys only: the host derives the namespace from the bound principal. AI requires a selected model, explicit prompt and stable request ID. Subscriptions acknowledge immediately and replay sequenced events from a saved cursor. Cancellation stops inference; unsubscribe closes a particular stream.

The UI entry mounts into `#root` and is a self-contained IIFE. CSS is packaged separately. No CDN imports, publisher Worker glue, or plugin code in the shell realm is permitted. Services implement `contracts/plugin.wit`; correlated completion events bridge asynchronous effects. Storage, HTTP, AI and service effects use the same scoped broker checks. The bridge bounds turns, effects and total bytes. Trusted transformation refuses unknown imports and unbounded core memories and hashes every output.

Hosts explicitly supply dependency selections keyed by `consumerId:interface`. The whole graph is checked before staging; selected provider digests are persisted atomically. Cycles, incompatible providers and removal of required providers are rejected.

Host-owned `migrate(previous, next, backup, signal)` prepares validated replacement JSON without a capability broker. Publisher migration JavaScript is not executed. The old generation is frozen, a snapshot is saved, and replacement data and pointer commit together in IndexedDB. Major data transitions without a migration are refused. Rollback restores the previous snapshot and preserves subsequent edits in recovery records.

Use `suspend` on visibility changes and `dispose` on shutdown. Durable installs are distinct from ephemeral frame and Worker handles. One rich frame and two service Workers are allowed by default. See `docs/RECOVERY.md` for storage and trust limits.

## Scoped agent composition

`runAgentLoop(agent, selectNext, approve, options)` repeatedly requests a schema-checked decision
from a host-supplied selector. It passes immutable correlated call/results history, bounds the total
tool calls across turns, and enforces an overall cancellation deadline. Decisions are either
`{type: 'calls', calls: [...]}` or `{type: 'done', output: ...}`. Every call uses the existing scoped
runner, including per-tool validation, principal binding, durable write admission and write approval.
The selector cannot register tools or grant itself authority. Synthetic selectors cover this loop;
connecting a real model requires explicit adapter capability validation and remains unverified.

`ScopedAgent` runs an explicitly supplied list of host-owned tools. It validates and freezes the whole
call batch before any effect, limits steps, input/output bytes and run time, and passes an `AbortSignal`
to approval, admission and execution. Cancelling during approval or after a read prevents a subsequent
write. A tool executor must honor that signal; cancellation cannot undo a write already committed.
Write approval is bound to the immutable exact arguments. Prompt text and plugin descriptions never
add tools, change the bound principal or create grants. Shell execution, installation and paid fallback
are not tools in the supported composition.

The optional `admitWrite(call, perform, signal)` callback must reserve the operation durably before
calling `perform`. `createSelectedDocumentAgent` binds it to `PluginStorage.operationOnce`, scoped to
the host's workspace, plugin, exact digest, generation, stable run ID and call ID. Recreated instances
using the same run ID cannot duplicate a confirmed action. An admitted operation that fails or has an
ambiguous outcome is retained and never automatically replayed. Omitting durable admission gives only
instance-local replay protection.

The selected-document helper exposes only `documents.read-selected` with `{handle: 'selected-note'}`
and `canvas.add-card` with `{text: string}` (at most 150 characters). The host supplies the actual
broker-bound principal, the storage instance and stable run ID. Select the Notebook document through
the broker's approved binding first; every read/write still checks current grants and generations.
The helper reads and updates the bounded Canvas Board state through the scoped storage broker. Run
composition while the board editor is paused to avoid concurrent edits overwriting the same board.

```typescript
import {createSelectedDocumentAgent} from '@pwacloud/broker';
const agent = createSelectedDocumentAgent({broker, storage, principal, runId: savedRunId});
const [document] = await agent.run(
  [{id: 'read-selected', tool: 'documents.read-selected', input: {handle: 'selected-note'}}],
  reviewExactWriteArguments,
  abort.signal,
);
// Validate the returned document, then explicitly construct/review the next bounded call.
await agent.run(
  [{id: 'add-card', tool: 'canvas.add-card', input: {text: reviewedCardText}}],
  reviewExactWriteArguments,
  abort.signal,
);
```

This is a deterministic tool runner and host composition adapter. A real model choosing and sequencing
these calls has not been verified; it requires an authorized provider with supported tool-call semantics
and separate live evidence. The runner does not synthesize a provider result or continue in the background.
