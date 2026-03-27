# @mindwallet/discovery

Utilities for probing payment-gated origins and searching a registry of supported origins.

## Install

```bash
npm install @mindwallet/discovery
```

## Main APIs

- `probeOrigin(url, methods)`
- `searchRegistry(options)`

## Minimal Example

```ts
import { probeOrigin } from '@mindwallet/discovery';
import { createSiwxMethod } from '@mindwallet/protocols';

const result = await probeOrigin('https://api.example.com/data', [createSiwxMethod()]);
console.log(result.requires402, result.candidates);
```

See the root repo for CLI and MCP usage:
https://github.com/remyjkim/mind-wallet
