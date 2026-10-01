# 10. Persistence and data ownership

## Browser stores

Use IndexedDB stores for workspaces, installations, manifests, verified receipts, grants, revisioned
settings, install journals, UI checkpoints, task summaries and plugin key/value records. Namespace all
plugin-owned records by workspace and stable plugin installation. Never infer ownership from a caller-
provided key prefix. The storage adapter prepends the namespace from the bound principal.

Put immutable package blobs and larger content in OPFS where available. Provide IndexedDB Blob fallback.
Keep package hashes and journal pointers in IndexedDB. The app can request persistent storage and inspect
quota estimates, but cannot guarantee the browser grants persistence or never evicts data [S11]. A plugin
quota is a logical ceiling under the origin's real quota, not reserved capacity.

Quotas include keys, metadata and values under a defined accounting rule. Updates replacing an existing
value charge the delta within a transaction. Parallel writes cannot exceed quota by racing read-check-write.
Reject a large write before copying it repeatedly. Keep documents separate from disposable package caches
so low-space cleanup removes safe cached bytes before valuable user content.

## Personal runtime stores

`contracts/runtime.sql` specifies a starting SQLite model for account metadata, workspaces, installations,
grants, sessions, AI runs, sequenced run events and usage reservations. OAuth tokens are **not** database
columns. The metadata may reference a permitted local credential-store record. Browser copies of provider
profiles contain only the minimum display and capability information. Identifiers used for account
binding are not sent to plugins unless needed and specifically authorized.

Use one writer with WAL where supported, explicit transactions, foreign keys, indexed ownership checks
and versioned migrations. Do not run a public multi-user hosted service by turning on a flag in this
single-user reference runtime. Separate tenancy requires a separately reviewed authorization model.

## State synchronization

The reference app is local-first, not automatically multi-device synced. A phone paired to a runtime can
observe that runtime's tasks; this is not a promise that every local document has been synchronized.
If document sync is added, expose conflict behavior and data location explicitly. Never silently upload
all local plugin content merely because ChatGPT is connected.

Each document or key has a revision. Writes use expected-revision checks where concurrent edits are
possible. Return conflicts with a recovery path. UI checkpoints are best-effort presentation state;
committed document saves need a stronger durable acknowledgement. A visible “Saved” label must follow
actual persistence, not just a debounce timer.

## Backups and exports

Provide per-plugin export, workspace export and restore preview. Validate import schemas, paths, sizes,
version compatibility and signatures where relevant. An exported data bundle is not an executable plugin
unless the user explicitly installs a separately verified package. Encrypting exports is optional but
must use maintained cryptographic libraries and a recoverability explanation. Never put tokens in exports.

Write a pre-migration backup before a nontrivial schema change. Record version, digest, timestamp and data
schema. Restoration must be rehearsed in tests. A backup written to the same browser storage may also be
lost to origin eviction; offer user-controlled file export rather than claiming it is disaster recovery.

## Retention and privacy defaults

Keep run metadata and errors with configurable retention; do not retain full prompts as analytics.
Store conversation history only for the feature and retention the user selected. Diagnostics use request
IDs, method names, durations, byte counts and coarse error codes. Content logging is off by default.
Deleting a plugin's data is distinct from disabling its executable. Account switch must close stale
ports, clear private in-memory state, and prevent old tasks from appearing in the new account UI.

## Consistency tests

Force termination at every install journal step; run parallel quota writes; interrupt migration before
and after pointer swap; simulate missing OPFS bytes, a full origin, a deleted IndexedDB database and
stale multitab leases. Ensure recovery never activates an unverified package or loses the last known
valid data without presenting recovery choices. Test data deletion/export against actual storage,
not just disappearing UI rows.
