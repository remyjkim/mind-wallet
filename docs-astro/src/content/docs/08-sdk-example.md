---
title: "SDK Example"
description: "End-to-end example: make a paid API request using the mindpass SDK."
date: 2026-03-27
order: 5
---

A complete example wiring `@mindpass/core`, `@mindpass/protocols`, and `@mindpass/discovery` together to make a paid API request.

## Install

```bash
npm install @mindpass/core @mindpass/protocols @mindpass/discovery viem
```

## Probe and Pay

```typescript
import { createRouter, wrapFetch, PrivateKeyWalletAdapter, createMemoryStore } from '@mindpass/core';
import { createSiwxMethod, createX402Method, createTempoMethod } from '@mindpass/protocols';
import { probeOrigin } from '@mindpass/discovery';
import { privateKeyToAccount } from 'viem/accounts';

// 1. Set up wallet and account
const account = privateKeyToAccount('0x_YOUR_PRIVATE_KEY_HERE');
const wallet = new PrivateKeyWalletAdapter({ privateKey: '0x_YOUR_PRIVATE_KEY_HERE' });
const state = createMemoryStore();

// 2. Create protocol methods
const methods = [
  createSiwxMethod(),
  createX402Method({ account }),
  createTempoMethod({ account, store: state }),
];

// 3. Discover what the origin requires
const probe = await probeOrigin('https://api.example.com/data', methods);
console.log('Reachable:', probe.reachable);
console.log('Requires 402:', probe.requires402);
console.log('Candidates:', probe.candidates);

// 4. Create the router and wrapped fetch
const router = createRouter({ methods, state, policy: [] });
const paidFetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });

// 5. Make the paid request — 402 handling is automatic
const response = await paidFetch('https://api.example.com/data');
const data = await response.json();
console.log(data);
```

## What Happens

1. `probeOrigin` sends a preflight request to discover which payment protocols the origin supports
2. `createRouter` builds a selection pipeline from your protocol methods and policy rules
3. `wrapFetch` intercepts HTTP 402 responses, selects a payment method, signs the request, and retries automatically

## Adding Policy Rules

Restrict which protocols or amounts are allowed:

```typescript
const router = createRouter({
  methods,
  state,
  policy: [
    { type: 'allow', protocol: 'x402' },
    { type: 'deny', maxAmount: 1_000_000 }, // deny requests over 1 USDC
  ],
});
```

See [Setup Guides](/docs/02-guides) for the full policy rule reference.
