// Explicit synthetic development mode; the personal runtime never infers a provider mode.
process.env.PWACLOUD_MODE='demo';
await import('../apps/personal-runtime/src/main.ts');
export {};
