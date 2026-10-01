# Opt-in public release installation verification

Use an already built host and an already running personal runtime at a controlled local HTTPS origin.
Its mode must be `chatgpt-plan-local`; use an isolated runtime data directory and an absent or empty
public-root configuration, so no demo trust is loaded. `LocalReceiptAuthority` protects its local key
and issues a trusted receipt only after genuine GitHub/Sigstore release verification. This test does not create a
provider registration, sign into ChatGPT, submit inference or read another application's credentials.

The integration owner supplies the exact reviewed tag and commit from the successful release job.
Run from the repository root after that release is publicly available:

```powershell
$env:PWACLOUD_PUBLIC_RUNTIME_ORIGIN = 'https://127.0.0.1:4174'
$env:PWACLOUD_EXPECTED_PUBLIC_TAG = '<actual-successful-plugin-tag>'
$env:PWACLOUD_EXPECTED_PUBLIC_COMMIT = '<actual-reviewed-40-hex-source-commit>'
$env:PWACLOUD_EXPECTED_HOST_COMMIT = (git rev-parse HEAD).Trim()
$env:PWACLOUD_PUBLIC_ALLOW_SELF_SIGNED = '1'
pnpm exec playwright test -c scripts/public-release-playwright.config.ts
pnpm exec tsx scripts/redact-public-release-evidence.ts
```

The self-signed exception affects only these loopback browser contexts. It does not claim OS trust,
public HTTPS deployment, phone pairing, physical-device behavior or provider entitlement. The script
has no `webServer`, does not rebuild/start a host, does not inject demo roots, and is separate from the
default deterministic suite. Missing release/runtime inputs fail configuration rather than skip tests.

Both engines independently verify actual public archive/envelope Sigstore signatures and SLSA source
against official updated TUF trust material. They enter the real repository URL through the application,
check the genuine local receipt identity/commit/digest with no demo opt-in, reject an altered signature
at both verifier and runtime boundaries, install through the UI, register the signed packet for trusted
guest preparation, save/reopen an actual Notebook note and execute the actual Component Model analyzer.

Tracing, video and automatic failure screenshots are disabled to keep session cookies and CSRF out of
public artifacts. API helpers never return session/credential material to the runner. Only whitelist
public package metadata, synthetic note captures and a path-redacted report are evidence. The original
Playwright report remains under ignored `artifacts/private-evidence/M3`. Prepared commands are not a
successful installation observation; populate an observed summary only after the run completes.
Use the pinned Node 24.19.0 and pnpm 11.19.0 toolchain. The test also checks the existing host's
`/build-info.json` against the expected host commit and rejects builds containing changed source.
Per-engine completion hooks write `public-install-results.json` atomically; an aggregate succeeds
only when both observed results belong to the current invocation, preventing stale results from passing.
