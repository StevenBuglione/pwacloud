# Agent implementation contract

The user wants a working, tested mobile-first platform, not a prototype screenshot or more planning.
Use `CODEX_START.md` as the execution order. Existing handoff tests are reference tests, not proof
that the target application is done.

## Non-negotiable rules

- Implement in small vertical slices. Every milestone includes runnable behavior, tests, and evidence.
- Phone layout comes first. Test 360 CSS-pixel width before enhancing tablet/desktop layouts.
- Never invent an OAuth client ID, provider scope, model entitlement, approval, signature, test result,
  deployment URL, Git commit, app-store availability, or real-device result.
- Never put OAuth credentials in browser storage, plugin packets, URLs, logs, telemetry, git, or examples.
- Use only supported OpenAI flows. No scraping ChatGPT, backend-api calls, borrowed client IDs,
  reading another tool's auth store, quota rotation, shared subscriptions, or public AI relay endpoints.
- Keep hosted plan-sharing and remote credential persistence disabled unless the applicable written
  authorization resolves the gates in `docs/06-OPENAI.md` and `docs/15-RISKS.md`.
- A denial, missing scope, exhausted allowance, or provider failure must not trigger paid API fallback.
- Fail closed on package verification, compatibility, identity binding, permission changes, or stale grants.
- A plugin's claimed ID, publisher, permissions, or role is not authoritative. Bind principal on transport creation.
- Do not load third-party UI or uploaded Jco JS glue into the shell's JavaScript realm.
- Never call a sandboxed iframe a complete outbound-network or CPU isolation boundary.
- Use a real Component Model artifact and a real Worker in integration tests; a fake JS function is not Wasm.
- Browser suspension is expected. Persist work and resume explicitly. No simulated always-on controller.
- Never weaken a test, delete a failing assertion, suppress errors, or rename skipped work to passed.
- Mock AI is acceptable for development and deterministic transport tests only. Visibly label it.
- Real ChatGPT integration requires an authorized human sign-in. A blocked integration remains blocked.
- No real secrets, user files, prompts, access tokens, or account identifiers in public evidence.
- Do not spend money, provision paid infrastructure, accept commercial terms, or buy domains.
- Publish only to `StevenBuglione/pwacloud`, public, using authorized credentials. Preserve any existing history.
  Do not convert another repository's visibility or force-push.

## Engineering style

All production host/SDK/server JavaScript is authored as strict TypeScript. Use Rust for the first
small guest. Schemas and generated bindings are versioned. Runtime input remains untrusted despite
TypeScript types. Use a maintained schema validator at every boundary. Avoid `any`, unchecked casts,
and handwritten cryptography. Pin tested dependencies and Actions to resolved versions/commit SHAs.
Keep comments focused on invariants and boundary assumptions. No framework shopping after M0 without
an ADR explaining an observed blocker.

## Work log

Update `planning/progress.json` after each slice. Record implemented behavior, changed files, commands,
exit codes, failures, blockers, commit SHA, and evidence paths. Add `evidence/<milestone>/summary.md`.
The progress file is a record, not acceptance evidence by itself. Retain raw test outputs and artifacts.

## Completion

A milestone is complete only if its acceptance cases pass against the actual implementation. Release
requires the exact gate list in `planning/acceptance-cases.json`, with physical-device tests where marked.
Summarize what works, what was tested, and what remains blocked. Never say the entire product is done
because the seed tests or mocked provider pass.
