# ADR 0005: on-demand mobile reconciliation

Status: accepted. Installation is durable; execution is ephemeral. One rich UI and a small bounded Worker
pool run only when needed. The service worker manages offline/cache updates, not persistent plugins.
Consequences: checkpointing, run journals, idempotent effects and explicit personal-runtime background
consent are required. Browser suspension is normal and cannot be fixed with an infinite heartbeat.
