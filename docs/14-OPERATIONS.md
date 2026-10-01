# 14. Repository bootstrap, environments and release operations

## Repository publication

The intended target is `StevenBuglione/pwacloud`, public. The authoring session could not create or push
it; `PUBLICATION_STATUS.md` records the observed limitation. The included publication script is executable
from a development environment with Git and authenticated GitHub CLI. It checks the login, refuses a
resolved existing target, stages only the handoff inventory, and never force-pushes or changes visibility.

```sh
# Review files, then run from this directory in the authenticated Codex environment.
node --experimental-strip-types scripts/publish-github.ts --publish
```

GitHub CLI's repository-create operation supports explicit owner and public visibility [S29]. The script
performs no authentication for the user and never requests a token in chat. If credentials or creation
permissions are missing, keep local development moving and report the exact missing permission.

If the target already exists, clone it through the authorized connection and inspect its history,
visibility and license. Do not run the creation script. Add the handoff on a new branch, preserve source
already present, and push/review through the normal workflow. If it is private, do not change visibility
without a separate explicit decision about its existing contents. A read 404 can mean inaccessible, so
never assume an arbitrary repo is empty based on that alone.

## Environment matrix

Development: loopback hosts, synthetic fixtures, mock AI explicitly labeled, no production signing keys.
Test: production-build shell, fixture release service, isolated temporary databases and test trust roots.
Personal: user's local runtime, legitimate protected credentials, own session origin, authorized pairing.
Hosted: disabled until the documented provider and custody gates are resolved. Public shell/catalogue
hosting can be independent of an inference backend and must not imply hosted AI is available.

Use `.env.example` only as documentation. No provider token is a `VITE_*` variable. Validate configuration
on startup, including origin allowlists, root keys and enabled mode. Reject contradictory combinations,
such as hosted plan use with no approved integration configuration. Production startup must not silently
select the mock provider. Display unmistakable mode indicators in development and diagnostic screens.

## Personal deployment

Provide a signed/reproducible local runtime package and a documented startup command by M6. Bind loopback
by default. Phone access requires explicit HTTPS configuration, authentication and pairing under user
control. Validate Host/Origin to resist DNS rebinding. Terminate TLS with the configured local service
or a user-controlled reverse proxy, preserving secure session semantics. Never expose a raw model relay
or unauthenticated port on the LAN. Do not require Kubernetes to run the first release.

Local OAuth must be completed on the computer hosting the loopback callback. Protect credential files
with restrictive permissions or OS vault APIs and atomic refresh replacement. Avoid logging authorization
URLs. Keep runtime identity stable across restarts. Revocation and deletion are documented user actions.
VM credential persistence remains disabled until the terms/documentation issue is resolved.

## Continuous integration

The supplied `handoff.yml` runs only reference tests and audits, not product acceptance. Replace/extend it
with pinned production workflows during M0-M3. Required application workflows: PR checks, hostile/browser
checks, example-package release, catalogue validation, and protected release verification. Pin third-party
Actions by immutable commit after verifying upstream identity. Never claim pinned security based on a
moving tag in a starter workflow.

Do not run privileged builds on `pull_request_target` while checking out untrusted contributor code.
Keep write/signing permissions at job scope. Allow only known release branches/tags. Keep CI artefacts
free of browser auth state, credentials and real prompts. Public cloud runners are not a place to store
long-lived end-user SIWC tokens.

## Operational signals

Expose local health for the runtime and structured status to the PWA. Track package verification failure,
worker crash, grant denial, migration failure, resumed/interrupted run and provider admission error.
Do not log contents by default. An unavailable model is distinct from runtime unhealthy. Provide a
safe-mode launch with plugins disabled, diagnostics export, backup export and a trust metadata refresh.

## Release checklist

Run from a clean clone. Record exact commit and toolchain. Install with frozen lockfiles, build, run all
required tests and validate real-device/provider evidence. Scan staged content for secrets and review
license/SBOM. Sign immutable artifacts and publish checksums. Confirm the public repo/release URLs by
reading them after publication. Update status badges only after real jobs exist. Publish documented
known limits and recovery instructions with the release.

A GitHub repository is not a deployed PWA. State separately whether source, signed plugins, catalogue,
web hosting, personal-runtime distribution, and hosted ChatGPT integration have each been delivered.

## Bootstrap CI status
The included `handoff.yml` executes reference checks only. It has not run on GitHub in the authoring
session. It uses floating major action references and a reproduction Node version from the authoring
container, with no provider/deployment/signing secrets. They are not a production security baseline.
M0 must verify maintained compatible dependencies, pin Actions to reviewed immutable commit SHAs,
select patched supported runtime versions, and preserve frozen lockfiles before expanding CI privileges.
No guessed or fabricated commit hashes were inserted into the bootstrap workflow.
