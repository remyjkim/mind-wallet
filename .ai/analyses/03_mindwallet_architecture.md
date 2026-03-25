# mindwallet — Target Architecture Design

## Executive Summary

mindwallet is a full-stack agent payment SDK for the multi-protocol payment economy. It combines the intelligent multi-challenge selection of mpp-router, the protocol coverage of agentcash (x402 + MPP + SIWX), and the secure local wallet custody of the Open Wallet Standard (OWS) into a unified, layered system.

The system ships as four npm packages in a monorepo:

| Package | Role |
|---|---|
| `@mindwallet/core` | Protocol-agnostic selection pipeline, wallet interface, state, telemetry, HTTP/MCP adapters |
| `@mindwallet/protocols` | Concrete x402, MPP/Tempo, and SIWX `RouterMethod` implementations |
| `@mindwallet/discovery` | Pre-flight registry search, origin probing, compliance audit |
| `mindwallet` | CLI + MCP server; wires all above with OWS as default wallet |

Library consumers depend on `@mindwallet/core` + `@mindwallet/protocols`. CLI/MCP consumers install `mindwallet`. The layers compose cleanly — each package is independently usable and independently versioned.

---

## Motivation and Prior Art

### What agentcash does well
agentcash (`agentcash` CLI + `@agentcash/router` + `@agentcash/discovery`) is a complete user-facing product covering wallet management, x402 payment, MPP payment, SIWX authentication, registry search, and origin discovery. Its server-side router (`@agentcash/router`) is production-proven across multiple services.

### Where agentcash falls short on the client side
- Protocol selection is primitive: `pickByBalance` compares raw USDC balances across networks and picks whichever is larger. No scoring, no history, no policy enforcement.
- MPP support is charge-only (`Methods.charge`). No session/voucher channels. No warm channel preference.
- No outcome recording. The scoring infrastructure never has data to work with.
- No SIWX entitlement caching. The pay-once-then-SIWX pattern requires re-payment on every call.
- 402 response body is never read. Bazaar schemas and SIWX challenges embedded in the body are silently dropped.

### What mpp-router does well
mpp-router provides a rigorous multi-challenge selection pipeline: normalize → filter → score → select. Policy engine with budget caps, allow/deny lists, and delegated approval. Session/voucher state with monotonic enforcement. Pluggable `RouterMethod` interface. Structured `SelectionDecision` with full audit trail.

### Where mpp-router falls short
- MPP-only. Ignores `PAYMENT-REQUIRED` (x402) entirely.
- No concrete `RouterMethod` implementations shipped. Consumers must build their own.
- Outcome recording is unwired. The adapter never calls `parseReceipt` or `recordOutcome`.
- No SIWX awareness.
- No wallet layer. Consumers provide their own signing.
- No discovery integration.

### What OWS provides
The Open Wallet Standard (v1.0.0, launched March 23 2026) provides exactly the wallet substrate mindwallet needs: local-first encrypted vault (`AES-256-GCM`), multi-chain signing via CAIP identifiers (EVM, Solana, Bitcoin, Cosmos, Tron, TON, Sui, Filecoin, Spark), two-tier credential model (owner passphrase vs scoped agent token), policy-gated signing, and native Node.js bindings (`@open-wallet-standard/core`) with a custom `vaultPath` parameter on every operation.

### mindwallet's synthesis
mindwallet is the agent payment SDK that emerges when you take mpp-router's selection rigor, extend it to all protocols (x402 + MPP + SIWX), add concrete protocol implementations, wire in OWS for wallet custody, and build a CLI/MCP server on top.

---

## Package Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    mindwallet  (CLI + MCP server)                │
│  fetch · discover · search · wallet · key · settings            │
│  ~/.minds/wallet/config.json                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ depends on all below
         ┌─────────────────┼──────────────────────┐
         ▼                 ▼                       ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ @mindwallet/    │ │ @mindwallet/    │ │ @mindwallet/         │
│    core         │ │   protocols     │ │    discovery         │
│                 │ │                 │ │                      │
│ WalletAdapter   │ │ x402 method     │ │ RegistryClient       │
│ PaymentCandidate│ │ MPP/Tempo method│ │ OriginProber         │
│ SelectionPipe   │ │ SIWX handler    │ │ ComplianceAuditor    │
│ PolicyEngine    │ │                 │ │                      │
│ StateStore      │ └────────┬────────┘ └──────────────────────┘
│ HTTP adapter    │          │ implements RouterMethod
│ MCP adapter     │◄─────────┘
│ Telemetry       │
└────────┬────────┘
         │ default impl
┌────────▼────────┐
│   OWS adapter   │  @open-wallet-standard/core (native Node bindings)
│  (+ pluggable)  │  custom WalletAdapter for hardware wallets, hosted keys, etc.
└─────────────────┘
```

---

## `@mindwallet/core`

The heart of the system. Defines all interfaces and the selection pipeline. Has zero payment protocol logic and zero wallet logic — it deals only in abstract types.

### WalletAdapter

OWS-compatible interface. OWS satisfies it out of the box; any other signer (hardware wallet, hosted key service, test fixture) implements the same interface.

```typescript
interface WalletAccount {
  chainId: string;       // CAIP-2: "eip155:8453", "solana:5eykt4...", etc.
  address: string;       // CAIP-10 address
}

interface SignRequest {
  walletId: string;
  chainId: string;
  transaction: unknown;  // chain-specific tx object
}

interface MessageRequest {
  walletId: string;
  chainId: string;
  message: string;
  encoding?: 'utf8' | 'hex';
  accountIndex?: number;
}

interface WalletAdapter {
  sign(request: SignRequest): Promise<string>;
  signMessage(request: MessageRequest): Promise<string>;
  getAccount(walletId: string, chainId: string): Promise<WalletAccount>;
  canSign(chainId: string): Promise<boolean>;
}
```

The **OWS adapter** (default, ships in `@mindwallet/core`):

```typescript
import { signMessage, signTransaction, getWallet } from '@open-wallet-standard/core';

class OwsWalletAdapter implements WalletAdapter {
  constructor(
    private readonly walletId: string,
    private readonly agentToken: string,     // ows_key_* scoped token
    private readonly vaultPath: string,      // ~/.minds/wallet/vault
  ) {}

  async signMessage(req: MessageRequest): Promise<string> {
    const result = signMessage(
      req.walletId, req.chainId, req.message,
      this.agentToken, req.encoding ?? 'utf8', req.accountIndex ?? 0,
      this.vaultPath,
    );
    return result.signature;
  }
  // ...
}
```

The agent token is a scoped OWS API key stored in `~/.minds/wallet/config.json`, created with payment-focused policy defaults (chain allowlist: Base + Solana + Tempo; `expires_at` enforced). Owner passphrase is break-glass only and never stored.

### PaymentCandidate

A unified representation of any payment challenge, regardless of protocol. All three protocols normalize into this shape before entering the pipeline.

```typescript
type Protocol = 'x402' | 'mpp' | 'siwx';

interface NormalizedPayment {
  realm: string;
  protocol: Protocol;
  method: string;          // e.g. 'tempo', 'exact', 'evm-usdc'
  intent: string;          // 'charge' | 'session' for MPP; 'payment' for x402; 'identity' for SIWX
  amount?: bigint;         // SIWX is zero-cost
  currency?: string;
  recipient?: string;
  expiresAt?: number;
  hasDigestBinding: boolean;
  inputSchema?: unknown;   // Bazaar extension, if present
  outputSchema?: unknown;  // Bazaar extension, if present
}

interface PaymentCandidate {
  id: string;
  protocol: Protocol;
  method: RouterMethod;
  normalized: NormalizedPayment;
  raw: unknown;            // original parsed challenge
  eligible: boolean;
  rejectionReason?: string;
  score?: number;
}
```

### RouterMethod

The interface every protocol implementation satisfies:

```typescript
interface RouterMethod {
  id: string;
  protocol: Protocol;
  canHandle(candidate: PaymentCandidate): boolean;
  normalize(raw: unknown): NormalizedPayment;
  createCredential(args: { candidate: PaymentCandidate; wallet: WalletAdapter }): Promise<string>;
}
```

### SelectionPipeline

Five deterministic stages. Runs synchronously after candidate parsing.

```
Stage 1 — Parse
  Read PAYMENT-REQUIRED header → x402 candidates
  Read WWW-Authenticate: Payment headers → MPP candidates
  Read 402 body extensions['sign-in-with-x'] → SIWX candidate
  Read 402 body extensions['bazaar'] → attach inputSchema/outputSchema to all candidates

Stage 2 — Normalize
  Each candidate's RouterMethod.normalize(raw) → NormalizedPayment
  Candidates whose method.canHandle() returns false → drop

Stage 3 — Hard filter
  Expired (expiresAt < now) → ineligible, reason: EXPIRED
  WalletAdapter.canSign(chainId) returns false → ineligible, reason: UNSUPPORTED_CHAIN
  PolicyEngine.evaluate(candidate) returns deny → ineligible, reason: POLICY_DENIED

Stage 4 — Score
  For each eligible candidate, compute weighted composite score:
    cost_score       (weight: 0.4) — lower amount = higher score; neutral if cross-currency
    latency_score    (weight: 0.15) — median duration from StateStore.getOutcomes(), last 1h
    success_score    (weight: 0.3)  — success rate from StateStore.getOutcomes(), last 24h
    warm_score       (weight: 0.15) — 1.0 if MPP session channel exists; SIWX entitlement = 1.0
  Weights configurable via ScoringWeights in config

Stage 5 — Select
  Pick highest-scoring eligible candidate
  If tie → prefer lower cost, then prefer warmer channel
  Emit SelectionDecision with full considered[] audit trail
```

### PolicyEngine

Protocol-aware rules. Protocol preference is expressed here, not in hardcoded logic.

```typescript
type PolicyRule =
  | { type: 'budget'; currency: string; maxAmount: bigint; window: 'daily' | 'weekly' | 'monthly' }
  | { type: 'allow-realm'; realms: string[] }
  | { type: 'deny-realm'; realms: string[] }
  | { type: 'allow-protocol'; protocols: Protocol[] }
  | { type: 'deny-protocol'; protocols: Protocol[] }
  | { type: 'prefer-protocol'; protocol: Protocol; boost: number }  // adds to score
  | { type: 'max-amount'; currency: string; amount: bigint }
  | { type: 'require-digest-binding' }
  | { type: 'delegate'; provider: ApprovalProvider }               // human-in-the-loop
```

Rules are evaluated in order; first `deny` match short-circuits. `prefer-protocol` is additive to the score rather than a hard filter — a preferred protocol scores higher but can still lose to a significantly cheaper or warmer alternative.

### StateStore

Extended from mpp-router to include SIWX entitlement caching:

```typescript
interface EntitlementRecord {
  realm: string;
  token: string;
  expiresAt: number;
  walletAddress: string;
}

interface RouterStateStore {
  // MPP session channels
  getSessionChannel(scopeKey: string): Promise<SessionChannelState | undefined>;
  putSessionChannel(state: SessionChannelState): Promise<void>;
  deleteSessionChannel(scopeKey: string): Promise<void>;

  // Outcome history (feeds scorer)
  recordOutcome(event: OutcomeRecord): Promise<void>;
  getOutcomes(filter: OutcomeFilter): Promise<OutcomeRecord[]>;

  // SIWX entitlement cache
  getEntitlement(realm: string): Promise<EntitlementRecord | undefined>;
  putEntitlement(record: EntitlementRecord): Promise<void>;
  deleteEntitlement(realm: string): Promise<void>;
}
```

Default in-memory implementation ships in `@mindwallet/core`. Persistent (SQLite or filesystem) implementation is opt-in.

### Telemetry

Fire-and-forget hooks. Errors in hooks never affect request flow. Credential material must never reach these hooks.

```typescript
interface Telemetry {
  onChallengeSeen?(args: { transport: string; realm: string; candidates: CandidateSummary[]; ctx: RouterContext }): void;
  onDecision?(decision: SelectionDecision, ctx: RouterContext): void;
  onAttempt?(args: { candidateId: string; protocol: Protocol; method: string; phase: 'createCredential' | 'sendPaidRequest'; ctx: RouterContext }): void;
  onReceipt?(args: { receipt: PaymentReceipt; transport: string; realm?: string; ctx: RouterContext }): void;
  onEntitlementCached?(args: { realm: string; expiresAt: number; ctx: RouterContext }): void;
  onError?(args: { code: string; message: string; transport: string; ctx: RouterContext }): void;
  onAlert?(args: { severity: 'info' | 'warn' | 'error'; code: string; message: string; ctx: RouterContext }): void;
}
```

### HTTP Adapter (`wrapFetch`)

Wraps the standard `fetch`. Handles the full paid request lifecycle including entitlement check, body parsing, outcome recording, and receipt parsing — all the gaps present in mpp-router today.

```typescript
interface WrapFetchOptions {
  fetch: typeof fetch;
  router: MindRouter;
  wallet: WalletAdapter;
  state: RouterStateStore;
  discovery?: DiscoveryResult;  // pre-seeded from @mindwallet/discovery
  maxRetries?: number;
  telemetry?: Telemetry;
}
```

### MCP Adapter (`wrapMcp`)

Intercepts `-32042` JSON-RPC errors. Parses `error.data.challenges[]` — all challenges, not just index 0. Attaches `org.paymentauth/credential` to `_meta` on retry. Reads `org.paymentauth/receipt` from successful responses.

---

## `@mindwallet/protocols`

Concrete `RouterMethod` implementations for each payment protocol. Depends on `@mindwallet/core` for interfaces, and on `@coinbase/x402`, `mppx`, and the `WalletAdapter` for protocol logic.

### x402 RouterMethod

```
Challenge source: PAYMENT-REQUIRED response header (JSON body)
Chains supported: EVM (Base USDC via eip155:8453), Solana (via solana:5eykt4...)
Normalization: parse amount/currency/recipient/maxTimeoutSeconds from x402 body
Credential: wallet.sign(evm tx OR solana tx) → encode as x402 Payment header value
```

Two sub-implementations selected by `chainId` in the challenge body — EVM and Solana — both satisfying the same `RouterMethod` interface. Uses `@coinbase/x402` for encoding and scheme validation. The `PAYMENT-REQUIRED` header value is decoded to extract the payment requirements object.

### MPP/Tempo RouterMethod

```
Challenge source: WWW-Authenticate: Payment header (base64url-decoded request field)
Intent variants:
  charge  → wallet.signMessage(JCS-serialized request) → MPP Authorization header
  session → check StateStore.getSessionChannel() → if warm, issue voucher
                                                  → if cold, open Tempo channel + deposit
Credential: mppx under the hood for signing and serialization
```

Warm channel detection is native — the scorer's `warm_score` already rewards session candidates with existing channels. The `RouterMethod.createCredential()` reads session state from `RouterStateStore` directly.

### SIWX Handler

SIWX is modeled as a zero-cost `PaymentCandidate`. It scores highest (warm_score = 1.0) when a valid entitlement exists in the state store. It enters the pipeline like any other candidate — the selection algorithm naturally picks it when available.

```
Challenge source: 402 body extensions['sign-in-with-x'] (domain, uri, chainId, nonce, issuedAt)
No-entitlement path:
  1. Build SIWE message from challenge fields
  2. wallet.signMessage(siwe message) → SIWX credential
  3. Attach as Authorization header on retry
  4. On 200: check response for entitlement token header
  5. StateStore.putEntitlement(realm, token, expiresAt)
Entitlement-cached path:
  1. StateStore.getEntitlement(realm) → valid token exists
  2. Inject as Authorization: Bearer <token> on initial request (no 402 needed)
  3. On 401/402: evict entitlement, fall back to SIWX sign or payment
```

### Protocol Detection

Exported from `@mindwallet/protocols`, used by the HTTP adapter:

```typescript
function detectCandidates(
  response: Response,
  body: unknown,
  methods: RouterMethod[],
): PaymentCandidate[]
```

Reads both `PAYMENT-REQUIRED` (x402) and `WWW-Authenticate: Payment` (MPP) headers plus the 402 body for SIWX and Bazaar extensions. Returns all parseable candidates; unrecognized methods are dropped with a warning.

---

## `@mindwallet/discovery`

Optional pre-flight package. When wired into `wrapFetch` via `WrapFetchOptions.discovery`, the selection pipeline has richer context before the first request is made.

### RegistryClient

Pluggable. Default implementation queries the agentcash registry.

```typescript
interface RegistryResult {
  origin: string;
  description: string;
  protocols: Protocol[];
  pricing?: { from: string; currency: string };
}

interface RegistryClient {
  search(query: string): Promise<RegistryResult[]>;
}
```

### OriginProber

Two-level probe per origin:

```
Level 1: GET /.well-known/x402
  → endpoint catalog: paths, auth modes, payment protocols, pricing

Level 2: GET /openapi.json (if present)
  → full input/output schemas per endpoint
  → merged into EndpointDescriptor.inputSchema / outputSchema
```

### ComplianceAuditor

Validates that a server's 402 implementation is spec-compliant. Produces `AuditWarning[]`, not hard errors. Surfaces to the CLI as output of `mindwallet discover`; surfaces to library consumers via `DiscoveryResult.auditWarnings`.

Audit checks include:
- `MISSING_RECEIPT_HEADER` — successful paid response has no `Payment-Receipt`
- `MALFORMED_WWW_AUTHENTICATE` — Payment challenge missing required parameters
- `EXPIRED_CHALLENGE` — challenge `expires` is in the past at time of probe
- `MISSING_BAZAAR_SCHEMA` — paid route returns no `inputSchema`/`outputSchema`
- `SIWX_NO_NONCE` — SIWX challenge missing `nonce` field
- `X402_MISSING_RECIPIENT` — x402 body has no `recipient` field

### DiscoveryResult → RouterContext seeding

```typescript
interface DiscoveryResult {
  origin: string;
  endpoints: EndpointDescriptor[];
  protocols: Protocol[];
  auditWarnings: AuditWarning[];
}

interface EndpointDescriptor {
  path: string;
  method: string;
  authMode: 'paid' | 'siwx' | 'apiKey' | 'unprotected';
  protocols: Protocol[];
  pricing?: NormalizedPricing;
  inputSchema?: unknown;
  outputSchema?: unknown;
}
```

When a `DiscoveryResult` is available in `WrapFetchOptions`:
- **Cost scoring is pre-seeded** — scorer has real pricing data before the first 402 hits, not just neutral 0.5
- **Incompatible protocols are filtered early** — if discovery says the endpoint only supports MPP and the wallet can't sign Tempo, the adapter skips the request entirely with a clear error before making any network call
- **Channel pre-warming** — if the endpoint uses `session` intent and no channel exists, the adapter can open a Tempo channel proactively (opt-in via config)
- **Operation binding** — `inputSchema` available to policy rules for Bazaar-style "confused deputy" checks before any payment is authorized

---

## `mindwallet` CLI + MCP Server

The top-level package. Wires all three `@mindwallet/*` packages together with OWS as the default wallet.

### Configuration

```json
// ~/.minds/wallet/config.json
{
  "wallet": {
    "adapter": "ows",
    "owsVaultPath": "~/.minds/wallet/vault",
    "walletId": "default",
    "owsAgentToken": "ows_key_..."
  },
  "policy": [
    { "type": "allow-protocol", "protocols": ["mpp", "x402", "siwx"] },
    { "type": "budget", "currency": "USDC", "maxAmount": "10000000", "window": "daily" }
  ],
  "scoring": {
    "cost": 0.4,
    "latency": 0.15,
    "success": 0.3,
    "warm": 0.15
  },
  "registry": {
    "url": "https://registry.agentcash.dev"
  },
  "rpc": {
    "tempo": "https://rpc.mainnet.tempo.xyz",
    "base": "https://mainnet.base.org",
    "solana": "https://api.mainnet-beta.solana.com"
  },
  "telemetry": {
    "sink": "console"
  }
}
```

OWS vault lives at `~/.minds/wallet/vault/` by default. Users who share a vault with other OWS-aware tools can point `owsVaultPath` at `~/.ows`.

### CLI Commands

```
mindwallet fetch <url> [options]
  --method GET|POST|...        HTTP method (default: GET)
  --body <json>                Request body
  --protocol mpp|x402|siwx    Force a specific protocol (overrides policy)
  --dry-run                    Show selection decision without paying

mindwallet discover <origin>
  Probes /.well-known/x402 and OpenAPI. Prints endpoint catalog + audit warnings.

mindwallet search <query>
  Queries the registry. Returns matching origins with protocol/pricing info.

mindwallet wallet create [--name <name>] [--words 12|24]
  Wraps OWS wallet creation. Stores in owsVaultPath.

mindwallet wallet list
  Lists wallets and accounts across chains.

mindwallet wallet import [--mnemonic | --private-key]
  Imports from stdin. Passphrase prompt is interactive.

mindwallet key create [--name <name>] [--expires <iso-date>] [--chains <caip2,...>]
  Creates OWS agent token with payment-focused policy defaults.
  Stores token in ~/.minds/wallet/config.json (shown once, then only hash stored in vault).

mindwallet key revoke <id>
  Revokes OWS agent token. Token becomes unusable immediately.

mindwallet settings [--get <key>] [--set <key>=<value>]
  View or update ~/.minds/wallet/config.json.

mindwallet serve [--transport stdio|sse] [--port <port>]
  Starts MCP server. All CLI operations exposed as MCP tools.
```

### MCP Server

All CLI commands are exposed as MCP tools. Tool input schemas are derived from the same typed option structs as the CLI — no duplication.

Key MCP tools:
```
mindwallet_fetch         — paid/authenticated HTTP request
mindwallet_discover      — probe an origin
mindwallet_search        — query registry
mindwallet_wallet_list   — list accounts
mindwallet_get_balance   — balance across chains
```

### OWS Integration Details

`mindwallet key create` wraps `ows key create` with payment-focused policy defaults:

```json
{
  "id": "mindwallet-agent",
  "rules": [
    { "type": "allowed_chains", "chain_ids": ["eip155:8453", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "eip155:65536"] },
    { "type": "expires_at", "timestamp": "<90 days from now>" }
  ],
  "action": "deny"
}
```

Tempo chain (`eip155:65536`) is included for MPP/Tempo signing. Token is stored in `config.json` and passed as `agentToken` to the OWS adapter on every signing call.

---

## End-to-End Request Lifecycle

### HTTP (wrapFetch)

```
1.  caller → wrapFetch(url, init)
2.  adapter → innerFetch(url, init)
3.  response.status === 200 → return (no payment needed)
4.  response.status === 402 →
    a. parse 402 body (JSON) for SIWX challenge + Bazaar schemas
    b. detectCandidates(response, body, methods) → PaymentCandidate[]
    c. check StateStore.getEntitlement(realm)
       → if valid → inject Authorization: Bearer <token> → retry → goto 3
    d. if DiscoveryResult available → seed RouterContext with known pricing/schemas
    e. pipeline: normalize → hard filter → score → select
    f. if SelectionOutcome.ok === false → return original 402 + structured error
    g. method.createCredential({ candidate, wallet }) → authorization header value
    h. innerFetch(url, { ...init, headers: { Authorization: authHeader } })
    i. recordOutcome({ realm, method, protocol, ok, durationMs, amount })
    j. parseReceipt(response) → telemetry.onReceipt()
    k. if response includes entitlement header → StateStore.putEntitlement()
                                              → telemetry.onEntitlementCached()
    l. return response
5.  response.status !== 200 and !== 402 → return as-is
```

### MCP (wrapMcp)

```
1.  caller → mcp.callTool(name, args)
2.  adapter → innerMcp.callTool(name, args)
3.  success response → return
4.  error.code === -32042 →
    a. parse error.data.challenges[] — all challenges, not just [0]
    b. detectCandidates from challenges array
    c. check entitlement cache
    d. pipeline: normalize → filter → score → select
    e. createCredential → attach to args._meta['org.paymentauth/credential']
    f. innerMcp.callTool(name, { ...args, _meta: { 'org.paymentauth/credential': credential } })
    g. recordOutcome
    h. parse result._meta['org.paymentauth/receipt'] → telemetry.onReceipt()
    i. return result
```

---

## Error Model

All errors produce a structured `PaymentError` — no silent swallowing:

```typescript
type PaymentErrorCode =
  | 'NO_COMPATIBLE_METHOD'    // no RouterMethod can handle any candidate
  | 'ALL_EXPIRED'             // all candidates past their expiry
  | 'POLICY_DENIED'           // all candidates denied by policy rules
  | 'WALLET_ERROR'            // WalletAdapter threw (never retry)
  | 'CREDENTIAL_ERROR'        // createCredential failed (never retry)
  | 'INVALID_CHALLENGES'      // 402 but no parseable challenges

interface PaymentError {
  code: PaymentErrorCode;
  detail: string;
  considered: CandidateSummary[];  // audit trail of what was evaluated
}
```

On unrecoverable errors (anything except `INVALID_CHALLENGES`), the adapter returns the original 402 response alongside the `PaymentError` so the caller has full context. No retries on errors — retry logic belongs in the caller.

---

## Testing Strategy

### `@mindwallet/core`

Unit tests only. Zero network. The pipeline is fully testable with mock `RouterMethod` and `WalletAdapter` implementations. Property-based tests for scorer edge cases (all expired, mixed currencies, single candidate, all neutral).

Critical test cases:
- SIWX entitlement hit → no payment, no 402 retry
- SIWX entitlement miss → sign → cache entitlement on success
- MPP session warm → high warm_score → wins over cheaper charge option
- Policy deny-protocol blocks all x402 candidates → POLICY_DENIED
- Bazaar inputSchema attached to candidates for policy inspection

### `@mindwallet/protocols`

Integration tests against real RPCs gated behind CI flag. Unit tests for challenge parsing and credential serialization with recorded fixtures. No mocking of the chain layer — the lesson from agentcash: mock/prod divergence has caused real incidents.

### `@mindwallet/discovery`

Integration tests against real origins (stableenrich.dev, etc.) gated behind a flag. Unit tests for audit logic with fixture 402 responses covering all known compliance failure codes.

### `mindwallet` CLI + MCP server

End-to-end tests using a local test server that issues real 402 challenges (both x402 and MPP headers). MCP server tested via MCP test client. Config loading, OWS adapter wiring, and vault path handling tested as a black box.

---

## Key Design Invariants

1. **`@mindwallet/core` has no protocol dependencies.** It never imports `@coinbase/x402` or `mppx`. All protocol logic lives in `@mindwallet/protocols`.
2. **`@mindwallet/core` has no wallet dependencies.** It never imports `@open-wallet-standard/core`. All signing goes through `WalletAdapter`.
3. **Protocol preference is a policy rule, not a code branch.** `prefer-protocol` adds a score boost. No `if (protocol === 'mpp')` in the pipeline.
4. **SIWX is a zero-cost candidate, not a special case.** It enters the same pipeline as x402 and MPP. It wins when it scores highest — which happens naturally when an entitlement exists.
5. **Outcomes are always recorded.** Every paid response (success or failure) results in a `recordOutcome` call. The scorer always has data after the first call.
6. **Telemetry hooks are fire-and-forget.** Hook errors are caught and discarded. A broken telemetry hook never affects request flow.
7. **Credential material never reaches telemetry.** `onAttempt` carries only `candidateId`, `method`, `phase` — not the credential value.
8. **The 402 body is always read.** The adapter clones the response before consuming the body so the original response is still returnable.
9. **OWS agent tokens own only the chains they need.** `mindwallet key create` defaults to Base + Solana + Tempo. No over-permissioned tokens.
10. **Config lives at `~/.minds/wallet/`.** All mindwallet state (config, OWS vault, entitlement cache, outcome history) is co-located under this directory for easy backup and isolation.
