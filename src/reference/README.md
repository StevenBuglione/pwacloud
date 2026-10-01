# Reference primitives, not the application
These modules are original, dependency-free examples with executed unit tests. Production implementation
belongs in the target packages described in the architecture. Preserve the tests, then add actual
browser/HTTP/Worker boundaries. Passing these tests does not prove isolation, OAuth, mobile UX or release readiness.

- `policy.ts` checks grant identity and conservative URL scope, not DNS rebinding/SSRF or browser CORS.
- `lifecycle.ts` computes a next action; the executor, journal, fencing and rollback are not implemented.
- `integrity.ts` checks metadata paths/digests and real P-256 signatures; it does not decode ZIP or verify Cosign.
- `ai.ts` shapes the smallest supported text request and catalog; it neither authenticates nor calls OpenAI.
- `sse.ts` handles byte-chunk framing; the live HTTP transport, deadlines and durable journal remain to implement.
- `budget.ts` is in-memory, single-process and keeps an unbounded idempotency set. Production must use bounded
  durable retention, transactional admission and stale-generation rejection. It is not a credit-metering system.
- `evidence.ts` validates a report's logical claims. Only actual captured artifacts and reviewers make them credible.

The test fixture model names, signatures and report entries are synthetic and explicitly labeled.
