# PWACloud

An implemented mobile PWA and reusable plugin host with independently bundled React and Lit apps, real Rust Component Model services, principal-bound UI ports, signed packages, and a local personal runtime.

**Development build. Product alpha release remains blocked by real ChatGPT and physical-device acceptance.** Synthetic AI is visibly labelled. Hosted credential storage and shared plan inference remain disabled. See [verification](evidence/VERIFICATION.md), [publication status](PUBLICATION_STATUS.md), and the unchanged [57 acceptance contracts](planning/acceptance-cases.json).

## Run the production build

Requires Node **24.19.0**, pnpm **11.19.0**, Rust **1.93.0**, and Git. Python with `requirements-dev.txt` is needed only for handoff schema audits.

```sh
pnpm install --frozen-lockfile
rustup target add --toolchain 1.93.0 wasm32-unknown-unknown
pnpm build
pnpm start
```

Open `http://127.0.0.1:4173`. `pnpm start` explicitly starts synthetic demo mode. Runtime data stays in `~/.pwacloud`; plugin documents stay in this browser's IndexedDB. On this Windows workspace, [Start-Demo.ps1](Start-Demo.ps1) selects the installed compatible Node runtime and checks the build before launching.

Install Notebook, Feed Reader, and Canvas Board from Discover. Review required storage and optional network, AI, and selected-note grants before activation. Notebook offers formatting, undo, durable saves, and real Wasm text counts. Feed Reader offers brokered requests, a bounded list and an offline snapshot. Canvas Board supports SVG cards, zoom, keyboard movement, and a one-use host-approved selected-note import. Library provides permission revocation, export, rollback, reset and explicit data deletion.

Discover also accepts `https://github.com/StevenBuglione/pwacloud`. The local verifier checks exact public release bytes, Sigstore publisher identity, source commit, provenance and TUF trust before issuing an expiring local receipt. The browser independently verifies that receipt. Local fixtures display **DEMO ONLY** identities and do not claim public publisher attestations.

`pnpm dev` serves Vite on 5173 with the runtime on 4173. Its local development proxy rewrites API Origin to loopback; production keeps exact Origin and CSRF checks. A separate non-Ionic embedding host is at `/minimal/`.

## Verify

```sh
pnpm exec playwright install chromium webkit
pnpm verify:all
pnpm audit
pnpm audit:handoff
pnpm validate:contracts
pnpm verify:release
```

Browser binaries use `.cache/browsers`. Clean-checkout CI builds the actual shell, packages and Wasm and retains reports tied to its commit. The release gate deliberately exits nonzero while mandatory provider and physical-device acceptance evidence is missing. Automated and synthetic checks cannot satisfy those gates.

## Personal ChatGPT runtime

The implemented supported flow uses fresh PKCE/state/nonce, callback-issued client IDs, protected local credentials, provider model catalogues, and direct Responses streaming. It never reads another application's credentials or falls back to paid API billing. The account owner must complete sign-in; installed-plugin inference additionally requires the applicable scope authorization. Hosted and VM modes cannot be enabled with a flag.

```powershell
$env:PWACLOUD_MODE = 'chatgpt-plan-local'
pnpm start:personal
```

Review [runtime setup](apps/personal-runtime/README.md) and [provider prerequisites](packages/provider-chatgpt/README.md). Phone pairing requires trusted HTTPS, a one-use invitation and an app session. Provider tokens never enter the browser, plugin, SQLite metadata or export.

## Author and embed

Workspace exports include `@pwacloud/contracts`, `sdk`, `sdk-react`, `sdk-lit`, `runtime-ui`, `runtime-web`, `storage`, `broker`, `controller`, `package-verifier`, `registry-client`, `provider-chatgpt`, `ui-kit` and `cli`. These are source workspace packages; no npm namespace is claimed or published. The minimal host uses the same exports without shell internals.

```sh
pnpm cli create-plugin ./my-plugin dev.example.my-plugin react
pnpm cli build ./my-plugin
pnpm cli validate ./my-plugin
pnpm cli pack ./my-plugin/package ./my-plugin/release
```

See [SDK and embedding](docs/SDK.md), [publication](docs/PACKAGE-PUBLISHING.md), and [recovery](docs/RECOVERY.md). Packing does not confer trust. Publisher JavaScript Worker glue never executes: the pinned trusted Jco pipeline prepares component loaders.

## Boundaries

Opaque `allow-scripts` frames cannot read host DOM or use direct fetch, image, or WebSocket egress under the tested CSP. Self-navigation can still send a request before teardown; iframe CPU is not reliably isolated. These residuals are demonstrated and recorded. Workers have declared finite memory maxima, bounded queues and wall-clock termination.

Offline editing requires a successfully installed production service worker. AI and new repository resolution need the runtime and network. Browser suspension and eviction are expected; export important documents to a file outside browser storage. No always-on execution or automatic multi-device document sync is promised.

License: MIT. Original handoff contracts and history are preserved.


The reproducible local delivery command is `pnpm exec tsx scripts/package-delivery.ts` after successful clean-source verification and evidence capture. It includes the prebuilt shell/plugins/Wasm and source, plus an integrity manifest and run instructions; it excludes dependencies, runtime databases and credentials. Install the pinned Node dependencies before starting. Demo install receipts expire after seven days; rebuild local fixtures from source before installing after expiry. This unsigned local development ZIP is separate from the signed public reference plugins.
