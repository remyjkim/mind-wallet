# Mindpass Package API Guide

**Category**: Reference
**Tags**: packages, api, libraries, protocols, discovery
**Last Updated**: 2026-03-27
**References**: `packages/core/src/index.ts`, `packages/protocols/src/index.ts`, `packages/discovery/src/index.ts`, `packages/discovery/src/audit.ts`, `packages/discovery/src/hub-registry.ts`

---

## Overview

Mindpass exposes three public library packages:

- `@mindpass/core`
- `@mindpass/protocols`
- `@mindpass/discovery`

Use these when you want to embed mindpass behavior directly instead of shelling out to the CLI.

## `@mindpass/core`

Primary purpose:

- payment routing
- wallet adapters
- policy evaluation
- `fetch()` wrapping for HTTP 402 flows

Public exports include:

- `createRouter`
- `createMemoryStore`
- `createPolicyEngine`
- `wrapFetch`
- `parseHttpChallenges`
- `PrivateKeyWalletAdapter`
- `OwsWalletAdapter`
- `DEFAULT_WEIGHTS`
- exported types from `./types/index.ts`
- `MindRouter`, `MindRouterConfig`
- `WrapFetchOptions`
- wallet adapter config types
- scorer-weight types

Use `@mindpass/core` when:

- you need a 402-aware `fetch`
- you want to supply your own methods, policy, or state store
- you need wallet adapters without the CLI

## `@mindpass/protocols`

Primary purpose:

- concrete `RouterMethod` factories for the currently supported payment protocols

Public exports include:

- `createSiwxMethod`
- `createX402Method`
- `createTempoMethod`
- `X402MethodConfig`
- `TempoMethodConfig`

Use `@mindpass/protocols` when:

- you are assembling a router with real protocol support
- you want to selectively enable SIWX, x402, or Tempo

Typical pairing:

- `@mindpass/core` + `@mindpass/protocols`

## `@mindpass/discovery`

Primary purpose:

- probe payment-gated origins
- search payment registries
- audit payment responses and challenge formatting

Public exports include:

- `probeOrigin`
- `searchRegistry`
- `searchHubRegistry`
- `auditPaidResponse`
- `auditWwwAuthenticate`
- `auditX402Challenge`
- `ProbeResult`
- `OriginRecord`
- `RegistrySearchOptions`
- `HubRegistrySearchOptions`
- `AuditResult`
- `AuditWarning`
- `AuditWarningCode`

### Discovery APIs

#### `probeOrigin`

Use to inspect an origin for supported payment challenges without paying.

#### `searchRegistry`

Use to query the configured or explicit registry for origins matching protocol and keyword filters.

The default public registry is the Bazaar registry unless overridden through config or function arguments.

#### `searchHubRegistry`

Use to query a hub marketplace endpoint for Tier 1 self-hosted origin listings.

Options include:

- `hubUrl`
- `protocol`
- `query`
- `limit`

### Audit APIs

#### `auditPaidResponse`

Checks successful paid responses for expected receipt headers.

#### `auditWwwAuthenticate`

Checks `WWW-Authenticate` challenge strings for malformed structure, expired challenge timestamps, and missing SIWX nonce fields.

#### `auditX402Challenge`

Checks decoded x402 challenge objects for missing recipient information in the first `accepts` entry.

## When To Use Which Package

### Use the CLI when

- you want an operator tool
- you want a ready-made MCP server
- you do not want to assemble a router manually

### Use `@mindpass/core` when

- you need the selection pipeline or paid-fetch wrapper
- you want to plug routing into your own application

### Use `@mindpass/protocols` when

- you need concrete protocol method factories
- you are building a router with SIWX, x402, or Tempo support

### Use `@mindpass/discovery` when

- you only need probe/search/audit functionality
- you want to inspect payment compatibility without pulling in the CLI

## Minimal Composition Example

```ts
import { createMemoryStore, createRouter, PrivateKeyWalletAdapter, wrapFetch } from '@mindpass/core';
import { createSiwxMethod, createX402Method, createTempoMethod } from '@mindpass/protocols';
import { privateKeyToAccount } from 'viem/accounts';

const privateKey = process.env.MINDPASS_PRIVATE_KEY!;
const account = privateKeyToAccount(privateKey);
const state = createMemoryStore();
const wallet = new PrivateKeyWalletAdapter({ privateKey });

const router = createRouter({
  methods: [
    createSiwxMethod(),
    createX402Method({ account }),
    createTempoMethod({ account, store: state }),
  ],
  state,
  policy: [],
});

const paidFetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });
```
