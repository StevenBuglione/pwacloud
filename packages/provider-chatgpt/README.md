# ChatGPT provider boundary

All host code is strict TypeScript and validates runtime input using AJV. OAuth ID tokens are verified with jose against the fixed official issuer and JWKS; tests substitute a locally generated signing key and synthetic transport explicitly.

Exports include `LocalChatGptOAuth`, `ChatGptPlanProvider`, `ProtectedFileCredentialStore`, `DemoProvider`, `SseParser`, the text request shaper and typed errors. Provider credentials stay behind the runtime boundary. There is no API-key adapter, token-export endpoint, provider passthrough or paid fallback.

The synthetic provider is visibly labeled on status, model names, run metadata and response text. Fixture tests prove protocol behavior and include actual Windows DPAPI encryption with synthetic values. They do not prove an account's eligibility, live provider completion or permission to deploy hosted plan sharing.
