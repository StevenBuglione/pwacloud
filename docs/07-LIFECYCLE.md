# 07. Install transactions, reconciliation and recovery

## Durable model

Persist desired state and generations, not live Worker handles. An installation is scoped to a workspace.
`desiredVersion` resolves to an immutable artifact digest before activation. Runtime instances are ephemeral.
Use states: absent, resolving, awaiting-consent, downloading, verifying, staged, ready, starting, running,
suspended, degraded, backoff, updating, quarantined, disabled, uninstalling, recovery-required.

The UI can collapse technical states into “Installing,” “Ready,” “Paused,” and “Needs attention,” but
logs retain exact states and reasons. Persist each critical transition with a monotonically increasing
revision. Transition code uses compare-and-swap or a transaction so two tabs do not activate different versions.

## Installation transaction

1. Normalize supported repository input. Fetch metadata without executing source.
2. Resolve a release and manifest; freeze its exact digest and source identity.
3. Validate compatibility, quotas, UI profile, archive limits and dependency graph.
4. Verify provenance/signatures/receipt. Display the verified identity and requested permissions.
5. Collect consent. Missing optional grants stay absent; declined required grants stop activation.
6. Download and hash into a staging namespace. Verify all entry hashes and sizes.
7. Write the immutable verified package and grant set to durable local stores.
8. Commit the installation pointer, manifest digest and generation atomically.
9. Start only when requested or needed for a bounded approved task.

Downloads may happen before consent only if no execution or sensitive access occurs and this is disclosed.
No grants or enabled installation survive cancellation. An incomplete staging directory is garbage-collected
on the next foreground reconciliation. OPFS and IndexedDB do not share one transaction; bridge them with
a journal and a pointer-commit protocol, not an imaginary cross-store transaction.

## Startup and scheduling

Reconcile on app boot, foreground/resume, desired-state mutation, task admission, dependency change,
worker exit and trust-feed update. Avoid polling healthy inactive apps. On a phone permit one active
rich frame and two active service Workers by default; schedule additional jobs in a fair bounded queue.
A specific user-visible long task can request a larger budget after consent. Browser capabilities and
measured pressure can reduce concurrency. Do not rely on nonportable memory metrics as the only safety signal.

A healthy idle instance can be snapshotted and terminated. An installed plugin does not need a running
instance. `enabled` means eligible to start, not “keep process alive.” Persist UI route/document state
before suspending; respect the fact that sudden OS termination may happen without a final callback.

## Health and hangs

Service initialization, event calls and heartbeats use separate deadlines. Background-tab throttling
must not create restart loops. On resume, compare last-known state and recreate stale instances rather
than counting every elapsed heartbeat as a crash. Use exponential backoff with bounded jitter and a
rolling crash count. Quarantine repeat crashes with a user-readable reason and reset option.

Terminate the Worker when a guest exceeds its wall-clock budget; discard its MessagePorts and pending
responses. Retrying a pure formatting call can be automatic within a small bound. Replaying an external
write or admitted AI request cannot. Use operation IDs and explicit completion records.

## Update policy

Default to notify-and-apply when inactive, not arbitrary background auto-update. A release without new
grants may be staged automatically; activation still waits for a safe point. An expanded grant set or
changed UI trust profile requires consent. Signature or publisher changes require explicit review.
Preserve the previous package until the update's data compatibility and smoke tests pass.

A staged update has its own generation, migration plan and journal. Pause old work, snapshot relevant
data, perform versioned migrations, run a bounded health check, then atomically switch the active pointer.
Migration code runs without network/AI grants. Avoid in-place destructive migrations. Prefer additive
schemas with old/new read compatibility; declare the compatible rollback window.

## Rollback and data safety

Code rollback is not automatically data rollback. Store a pre-migration snapshot or a reversible,
verified migration path. If the old artifact cannot read the new data, do not point it at that data.
Use the snapshot or enter recovery-required with export/recovery options. Keep actual user edits made
after the snapshot in a separate recovery record when possible. Never silently discard them.

A malicious downgrade cannot bypass current host minimum versions, signature policy or revoked-digest
rules. Rollback is permitted only to a verified allowed version. The user should see why a rollback
is blocked rather than a generic “failed” toast.

## Disable, revoke and uninstall

Revocation invalidates grants immediately, aborts broker work where possible, and prevents queued work
from starting. It cannot retract data already sent or guarantee a provider refund. Disable stops runtime
instances and retains data. Uninstall invalidates all sessions and contributions, closes frames/Workers,
removes the install pointer and offers retain/export/delete data. Cleanup is idempotent after interruption.
Shared cache objects can be deleted only when no installation or rollback reference uses them.

## Multitab and offline operation

Use a leader lease with fencing/revision checks for install and migration work. BroadcastChannel can
notify peers, but durable revision checks provide correctness even when broadcasts are missed. Web Locks
may improve coordination where available; retain a transaction-backed lease fallback. UI sessions can
remain separate, but no duplicated external effect is permitted merely because two tabs are open.

Offline, load verified cached packages, keep local editing available, and expose trust freshness.
Never enable new permissions based on expired metadata. If storage is evicted, show a recoverable empty
state, restore from explicit backups where available, and do not invent missing data.
