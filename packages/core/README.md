# @mindpass/core

Protocol-agnostic payment routing, wallet adapters, policy evaluation, and `fetch()` wrapping for agent payment flows.

## Install

```bash
npm install @mindpass/core
```

## What It Provides

- `createRouter()` to evaluate and select payment candidates
- `wrapFetch()` to turn a normal `fetch` into a 402-aware fetch
- `PrivateKeyWalletAdapter` and `OwsWalletAdapter`
- in-memory router state and policy evaluation primitives

## Minimal Example

```ts
import { createMemoryStore, createRouter, wrapFetch, PrivateKeyWalletAdapter } from '@mindpass/core';

const wallet = new PrivateKeyWalletAdapter({
  privateKey: '0x...',
  chainIds: ['eip155:8453'],
});

const state = createMemoryStore();
const router = createRouter({ methods: [], state, policy: [] });
const paidFetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });
```

See the root repo for full protocol wiring examples and CLI usage:
https://github.com/remyjkim/mindpass
