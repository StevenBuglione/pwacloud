# Recovery and data ownership

Documents and settings live in IndexedDB. Immutable packages use a separate IndexedDB fallback store; OPFS is not required. Records charge UTF-8 JSON value bytes, UTF-8 key bytes and 64 logical metadata bytes. Parallel quota checks and writes share one transaction.

Updates freeze old authority and save a snapshot before migration. Replacement records, pointer, revision, generation and journal deletion commit atomically. Cancellation restores the old usable install with a newer generation. A terminated tab leaves a lease/journal; recovery waits for expiry and preserves another tab's active journal. A stale installer cannot clean up a newer owner's journal. External operations are durably admitted and are not automatically retried.

Rollback restores the pre-update snapshot and preserves later edits in host recovery records. Missing snapshots, expired receipts, revoked packages or failed validation produce a visible recovery state. Export preserved data before manual repair; do not change digest or generation to bypass validation.

In Library, Manage then Export data downloads a backup. Keep it outside origin storage. Uninstall explicitly offers retaining or deleting documents; generation tombstones prevent old sessions regaining authority on reinstall. Framework restore uses `storage.restoreNamespace(pluginId, backupText, quota)` after a preview and confirmation. It validates namespace, shape, duplicates, count, byte limits and quota before changing data. Backups cannot install code.

After origin eviction, the app presents an empty workspace. It cannot reconstruct documents from executable caches. Reinstall a signed app, review grants, and restore an explicit export. Connecting an account does not upload all local documents or enable automatic sync.

The runtime keeps SQLite run metadata, sessions, admissions and event journals separately from protected credentials. Interrupted requests remain interrupted after restart. Cursor replay does not execute the provider again. Windows uses DPAPI; other supported local systems require a separate encryption key. Never delete credentials as a browser-data repair step.

Phone pairing requires a certificate trusted by the phone and the exact HTTPS origin. A one-use invitation gives the browser only an app session. Account sign-out invalidates account generations, pairing, grants and delivery. Desktop TLS fixtures do not certify physical phone pairing.
