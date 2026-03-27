---
sidebar_position: 2
---

# @mindwallet/protocols

Concrete `RouterMethod` implementations for each payment protocol.

## Methods

### createSiwxMethod

Zero-cost identity authentication via Sign-In with X (SIWE).

```typescript
import { createSiwxMethod } from '@mindwallet/protocols';

const siwx = createSiwxMethod();
```

No configuration required. Works with any `WalletAdapter`.

### createX402Method

EVM USDC payments via the x402 protocol (EIP-3009 `transferWithAuthorization`).

```typescript
import { createX402Method } from '@mindwallet/protocols';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');
const x402 = createX402Method({ account });
```

Requires a viem `Account` for EIP-712 typed-data signing.

### createTempoMethod

MPP/Tempo charge and session payment intents.

```typescript
import { createTempoMethod } from '@mindwallet/protocols';

const tempo = createTempoMethod({
  account,
  rpcUrl: 'https://rpc.testnet.tempo.xyz',  // optional
  gas: 200000n,                               // optional fixed gas limit
  store: state,                               // optional session state
});
```

Supports both pull mode (local account signs tx) and push mode (account broadcasts tx).
