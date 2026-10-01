# M1 mobile shell implementation evidence

The production React 19.3 / Ionic 9.0.6 / Vite 8.3.2 shell implements Home, Library, Discover, Activity and header Settings at 360 CSS pixels. It stores notes, appearance, pins, navigation and redacted events in actual IndexedDB. Tabs retain their search, route and scroll state. A validated plugin route passes through the principal-bound broker before the shell changes browser history. Back restores the plugin view; Settings returns to its invoking app. Unsaved edits have host-owned Save, Discard and Cancel controls.

The install flow resolves verified bytes, reviews required and optional grants, stages installation and opens one isolated app. Manage exposes capability revoke, explicit data export, compatible rollback and uninstall with separate data retention. Settings distinguishes an app session from provider authorization. Synthetic success is allowed only when the runtime actually returns demo mode. Real-mode authorization opens the runtime-issued OpenAI authorization URL; it does not manufacture account or inference success. Contextual Home Screen guidance uses a real browser install event or Safari instructions.

The TypeScript service worker precaches built shell and trusted guest assets, including exact versioned Worker URLs. API requests and connectivity checks stay outside the offline cache. Applying an update refuses dirty drafts and running or partial task checkpoints. The update test publishes a new version of the actual built service worker through an isolated HTTP listener and exercises genuine waiting, activation and reload behavior.

## Observed checks

- `pnpm typecheck`: exit 0; `typecheck-source-final.log` and `typecheck-integrated-final.log` retain the local output.
- `pnpm build`: exit 0; `build-complete-shell.log` records production shell revision `917ba79b6cb1afab`, real Rust guest compilation and fixture digests. Critical shell JS was 384.91 kB gzip in this build. Later integration rebuilds must be bound to their own result.
- The last owned 20-case Chromium/WebKit app run passed all navigation, storage, offline relaunch and accessibility checks. Its one failure was the WebKit activation measurement described in M9. Raw result: `../M9/owned-shell-full-results.json`; output: `../M9/browser-app-complete-shell.log`.
- Offline relaunch waits for the actual service-worker controller, stops the isolated origin listener, asserts the navigation response came from the service worker, and verifies the saved note and dark enlarged appearance survived without page errors. This avoids Playwright's WebKit offline-emulation/navigation issue without skipping the offline assertion. Primary report: <https://github.com/microsoft/playwright/issues/42775>.
- `chromium-360-offline.png` and `webkit-360-offline.png` show the tested 360-pixel production layout. M9 contains the 200-percent frame and Settings screenshots.

The final app specification also includes the real waiting-service-worker update case, the explicit real-mode/demo boundary case and an immediate New-note draft durability assertion. Those additions and the corrected readiness instrumentation require the root's final build and browser suite; they are not claimed passed by the earlier 20-case record.

This is Windows Playwright evidence. It does not prove physical phone installation, software keyboard behavior, edge gestures, screen-reader operation, an eligible ChatGPT account, or hosted authorization. The final integration commit and authoritative case dispositions belong to the root progress and release evidence records.
