# Resolver transport boundary checks

Observed on 2026-10-01 with Windows x64 and pinned Node 24.19.0. Five dedicated hostile cases
passed, with zero failures, retries or skips. The package boundary regression run passed all 35
cases; whole-workspace TypeScript and dependency-boundary lint also passed.

`createSecureFetch` accepts trusted DNS/HTTPS transport dependencies for boundary testing. The
production export binds Node's maintained DNS lookup and HTTPS request implementations. This
does not expose an option to allow private destinations, disable TLS validation, ignore peer
matching or bypass redirect admission in the production fetcher.

Four cases use explicitly synthetic HTTP responses and synthetic socket addresses. They show
that redirects admit every next destination again, a private DNS answer after a same-origin
redirect prevents a second request, mixed public/private DNS answers fail, cross-origin redirects
drop credential headers, an unauthorized redirect origin fails, and a different public peer is
rejected even when the admitted DNS answer is public.

The fifth case opens an actual native TCP/TLS listener on random loopback port, using a known
synthetic PSK instead of committing a key or trusting a test certificate. A trusted test transport
deliberately routes the request there after a synthetic public DNS answer. It observes the real
response socket peer `127.0.0.1`, checks the production Agent's lookup remains pinned to the
admitted public address with automatic family selection disabled, and observes `blocked-peer`.
The response body is rejected. This is actual socket enforcement evidence; it does not represent
public DNS, public certificate qualification or an uncontrolled attacker.

Commands and retained outputs:

```text
pnpm exec tsx --test tests/hostile/package-ssrf.test.ts
pnpm exec tsx --test tests/production/package.test.ts tests/hostile/package.test.ts tests/hostile/package-ssrf.test.ts tests/integration/package.test.ts
pnpm typecheck
pnpm lint
```

`package-ssrf.log.txt` retains the five-case output. `package-boundary-regression.log.txt` retains
the complete 35-case output. The public GitHub install test is separate and awaits an actual
successful signed release plus the reviewed personal runtime build.
