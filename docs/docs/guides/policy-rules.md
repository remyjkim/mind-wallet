---
sidebar_position: 3
---

# Policy Rules

Policy rules control which payment protocols and amounts mindwallet will accept. They are evaluated during the selection pipeline's filter stage.

## Configuration

Add policy rules to your config file:

```json
{
  "policy": [
    { "type": "budget", "currency": "USDC", "limit": "10000000", "window": "daily" },
    { "type": "deny-protocol", "protocol": "mpp" },
    { "type": "prefer-protocol", "protocol": "x402", "boost": 0.2 }
  ]
}
```

## Rule Types

### budget

Caps spending within a time window.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `currency` | string | `"USDC"` | Currency to track |
| `limit` | string | `"0"` | Maximum amount (in smallest unit) |
| `window` | string | `"daily"` | Time window: `daily`, `weekly`, `monthly` |

### deny-protocol

Blocks a specific payment protocol entirely.

| Field | Type | Description |
|-------|------|-------------|
| `protocol` | string | Protocol to deny: `x402`, `mpp`, `siwx` |

### prefer-protocol

Adds a score boost to candidates of a specific protocol, making it more likely to be selected.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `protocol` | string | — | Protocol to prefer |
| `boost` | number | `0.1` | Score boost (0.0 to 1.0) |

## Implicit Rules

In private key mode, an implicit `prefer-protocol: x402` rule with boost `0.1` is added automatically. This makes x402 the default when multiple protocols can handle a challenge.

## Examples

### Allow only SIWX (no payments)

```json
{
  "policy": [
    { "type": "deny-protocol", "protocol": "x402" },
    { "type": "deny-protocol", "protocol": "mpp" }
  ]
}
```

### Daily budget of 1 USDC

```json
{
  "policy": [
    { "type": "budget", "currency": "USDC", "limit": "1000000", "window": "daily" }
  ]
}
```

### Prefer Tempo over x402

```json
{
  "policy": [
    { "type": "prefer-protocol", "protocol": "mpp", "boost": 0.3 }
  ]
}
```
