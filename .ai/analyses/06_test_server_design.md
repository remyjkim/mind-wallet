# Test Server Design: Local Payment-Gated Endpoints

## Problem

Two e2e tests are permanently skipped because they require live payment-gated servers:

- `packages/core/src/http/adapter.e2e.test.ts` — gated on `E2E_PAYMENT_URL` (uses mockFetch, never hits a real server)
- `packages/cli/src/x402.mainnet.e2e.test.ts` — gated on `E2E_X402_URL` + `TEST_PRIVATE_KEY` (needs a live x402 endpoint)

## Solution

A new `packages/test-server/` package: a Hono app serving two payment-gated endpoints and an embedded x402 facilitator, run via `@hono/node-server` on a random port.

```
┌─────────────────────────────────────────────────┐
│  packages/test-server (Hono + @hono/node-server) │
│                                                  │
│  GET /x402/data   ← custom x402 middleware       │
│    ├─ 402: PAYMENT-REQUIRED header (base64 JSON) │
│    └─ retry: verify + settle via embedded facil. │
│                                                  │
│  GET /mpp/data    ← mppx/hono middleware         │
│    ├─ 402: WWW-Authenticate: Payment header      │
│    └─ retry: verify + broadcast to Moderato      │
│                                                  │
│  POST /facilitator/verify   ← embedded x402 fac. │
│  POST /facilitator/settle                        │
│  GET  /facilitator/supported                     │
│                                                  │
│  GET /health      ← readiness check              │
└─────────────────────────────────────────────────┘
```

## x402 Endpoint (`GET /x402/data`)

### Challenge (no payment header)

Returns 402 with `PAYMENT-REQUIRED` header containing base64-encoded JSON:

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:84532",
    "maxAmountRequired": "100",
    "payTo": "<recipient address>",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "resource": "http://127.0.0.1:<port>/x402/data",
    "description": "Test x402 endpoint",
    "mimeType": "application/json",
    "maxTimeoutSeconds": 300,
    "outputSchema": null,
    "extra": null
  }]
}
```

- Network: `eip155:84532` (Base Sepolia testnet)
- Asset: Base Sepolia USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`)

### Retry (with `X-PAYMENT` or `PAYMENT-SIGNATURE` header)

1. Decode payment header via `decodePaymentSignatureHeader()` from `@x402/core/http`
2. Call embedded facilitator `POST /facilitator/verify` with `{ x402Version: 2, paymentPayload, paymentRequirements }`
3. If valid, call `POST /facilitator/settle`
4. Return 200 with `Payment-Receipt` header (base64-encoded settle response) and JSON body

### Encoding/Decoding

Uses `@x402/core/http` functions:
- `encodePaymentRequiredHeader()` — encode the 402 challenge
- `decodePaymentSignatureHeader()` — decode the client's X-PAYMENT header
- `encodePaymentResponseHeader()` — encode the Payment-Receipt response

## Embedded x402 Facilitator

Same pattern as `carto-mindspace-v1/workers/hub/src/routes/x402-facilitator.ts` lines 13-40, without the marketplace-specific escrow validation:

```typescript
function createExactMechanism(network: string): FacilitatorMechanism {
  return {
    scheme: 'exact',
    network,
    async verify({ paymentPayload }) {
      const signature = paymentPayload.payload?.signature;
      return { isValid: typeof signature === 'string' && signature.length > 0 };
    },
    async settle() {
      return { success: true, network, transaction: '0xtestsettle' };
    },
  };
}
```

No `@iminds/hub` dependency — the ~20-line mechanism is replicated directly.

Facilitator service uses in-memory verification store with `requireVerifyBeforeSettle: true`.

**Note:** We cannot directly import `createX402FacilitatorService` from `@iminds/hub/x402` (different repo). We will implement the three endpoints (`/verify`, `/settle`, `/supported`) with equivalent logic inline: verify delegates to the mechanism, settle requires prior verification, supported returns the registered scheme+network.

## MPP/Tempo Endpoint (`GET /mpp/data`)

Uses `mppx/hono` middleware directly:

```typescript
import { Mppx, tempo } from 'mppx/hono';

const mppx = Mppx.create({
  methods: [tempo({
    testnet: true,
    recipient: RECIPIENT_ADDRESS,
    waitForConfirmation: true,
  })],
  secretKey: 'test-secret-key',
});

app.get('/mpp/data', mppx.charge({ amount: '1' }), (c) =>
  c.json({ data: 'paid mpp content' })
);
```

### Tempo Configuration

| Parameter | Value | Source |
|-----------|-------|--------|
| Chain | Moderato testnet (42431) | `testnet: true` |
| RPC | `https://rpc.moderato.tempo.xyz` | mppx default for testnet |
| Currency | pathUSD `0x20c0000000000000000000000000000000000000` | mppx default for testnet |
| Recipient | Test wallet address (from `TEST_PRIVATE_KEY` or dedicated) | Config |
| `waitForConfirmation` | `true` | Real on-chain confirmation |
| `secretKey` | `'test-secret-key'` | HMAC for stateless challenge binding |

### Wallet Funding

The test wallet needs pathUSD on Moderato for both gas and the charge transfer. Fund via viem's faucet action in test `beforeAll`:

```typescript
import { Actions } from 'viem/tempo';

await Actions.faucet.fundSync(client, { account: walletAddress });
```

Or via cast CLI: `cast rpc tempo_fundAddress $ADDRESS --rpc-url https://rpc.moderato.tempo.xyz`

See `.ai/analyses/05_foundry_tempo.md` for full Moderato setup reference.

## Server Factory

```typescript
export interface TestServerHandle {
  url: string;       // e.g. "http://127.0.0.1:54321"
  close(): Promise<void>;
}

export async function startTestServer(config?: {
  facilitatorUrl?: string;  // override facilitator base URL
  mppRecipient?: string;    // Tempo recipient address
  x402PayTo?: string;       // x402 recipient address
}): Promise<TestServerHandle>;
```

Starts on `127.0.0.1` with port 0 (random), returns URL and close handle.

## Client-Side Flow (what tests exercise)

### x402

```
wrapFetch(url/x402/data)
  → 402 + PAYMENT-REQUIRED header (base64 JSON)
  → parseHttpChallenges reads PAYMENT-REQUIRED header (parse.ts:38-59)
  → createX402Method.createCredential signs EIP-712 TransferWithAuthorization
  → retry with X-PAYMENT header
  → server verifies via facilitator/verify, settles via facilitator/settle
  → 200 + Payment-Receipt header (base64 settle response)
```

### MPP/Tempo

```
wrapFetch(url/mpp/data)
  → 402 + WWW-Authenticate: Payment header
  → parseHttpChallenges reads WWW-Authenticate (parse.ts:15-35)
  → createTempoMethod.createCredential signs Tempo transaction
  → retry with credential headers
  → mppx server deserializes tx, broadcasts to Moderato, waits for confirmation
  → 200 + Payment-Receipt header
```

## Test Modifications

### `adapter.e2e.test.ts` (rewrite)

- Drop mockFetch — use real `globalThis.fetch`
- Import `startTestServer` from `@mindwallet/test-server`
- Start server in `beforeAll`, close in `afterAll`
- Test both x402 and MPP endpoints through `wrapFetch`
- Gate on `RUN_INTEGRATION_TESTS=1` + `TEST_PRIVATE_KEY`

### `x402.mainnet.e2e.test.ts` (rewrite + rename)

- Rename to `x402.e2e.test.ts` (no longer mainnet-specific)
- Point at local test server instead of `E2E_X402_URL`
- Keep `TEST_PRIVATE_KEY` requirement (for EIP-712 signing)
- Verify full 402 → sign → verify → settle → 200 flow

## Package Structure

```
packages/test-server/
├── src/
│   ├── index.ts          # exports startTestServer()
│   ├── server.ts         # Hono app: mounts all routes
│   ├── x402.ts           # x402 middleware (challenge + verify/settle)
│   ├── facilitator.ts    # embedded x402 facilitator routes
│   └── mpp.ts            # mppx/hono setup with tempo
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Dependencies

```json
{
  "name": "@mindwallet/test-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.12.0",
    "@hono/node-server": "^1.19.0",
    "@x402/core": "^2.8.0",
    "mppx": "^0.4.9",
    "viem": "^2.47.6"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0"
  }
}
```

## Environment Requirements

| Variable | Purpose | Required by |
|----------|---------|-------------|
| `TEST_PRIVATE_KEY` | Client wallet for EIP-712 + Tempo signing | x402 + MPP tests |
| `RUN_INTEGRATION_TESTS=1` | Gate flag | All integration tests |

No external services required — facilitator is embedded, Moderato testnet is public.

## Known Considerations

1. **`x402.ts` client RPC URL**: The existing `createX402Method` (protocols/src/x402.ts:81) hardcodes `https://mainnet.base.org` as the public client RPC. `signTypedData` is pure crypto and doesn't actually need an RPC call, so this works for Base Sepolia signing despite the URL mismatch. However, if future x402 code adds on-chain lookups, this will need a chain-aware RPC resolver.

2. **Facilitator fidelity**: The embedded facilitator is a stub — it checks signature existence, not cryptographic validity. This is identical to the hub's mechanism. For testing the mind-wallet client flow, this is sufficient: the client still does real EIP-712 signing, the server verifies the credential format, and the full verify→settle lifecycle executes.

3. **Moderato funding**: The viem faucet action (`Actions.faucet.fundSync`) provides testnet pathUSD. This is called once in test setup. If the faucet is down, tests will skip gracefully.
