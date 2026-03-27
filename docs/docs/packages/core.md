---
sidebar_position: 1
---

# @mindwallet/core

Protocol-agnostic selection pipeline, wallet interface, state management, and HTTP adapter.

## Key Exports

| Export | Description |
|--------|-------------|
| `WalletAdapter` | Interface for signing operations |
| `OwsWalletAdapter` | OWS vault-backed wallet |
| `PrivateKeyWalletAdapter` | Raw private key wallet (viem) |
| `createRouter` | Creates a `MindRouter` from methods + state + policy |
| `createMemoryStore` | In-memory `RouterStateStore` |
| `wrapFetch` | Wraps `fetch()` with automatic 402 handling |
| `createPolicyEngine` | Evaluates policy rules against candidates |

## WalletAdapter Interface

```typescript
interface WalletAdapter {
  sign(request: SignRequest): Promise<string>;
  signMessage(request: MessageRequest): Promise<string>;
  getAccount(walletId: string, chainId: string): Promise<WalletAccount>;
  canSign(chainId: string): Promise<boolean>;
}
```

## wrapFetch

```typescript
const paidFetch = wrapFetch({
  fetch: globalThis.fetch,
  router,
  state,
  wallet,
});

// Automatically handles 402 responses
const response = await paidFetch('https://paid-api.example.com/data');
```
