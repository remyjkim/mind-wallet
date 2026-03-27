# @mindpass/discovery

Utilities for probing payment-gated origins and searching a registry of supported origins.

## Install

```bash
npm install @mindpass/discovery
```

## Main APIs

- `probeOrigin(url, methods)`
- `searchRegistry(options)`

## Minimal Example

```ts
import { probeOrigin } from '@mindpass/discovery';
import { createSiwxMethod } from '@mindpass/protocols';

const result = await probeOrigin('https://api.example.com/data', [createSiwxMethod()]);
console.log(result.requires402, result.candidates);
```

See the root repo for CLI and MCP usage:
https://github.com/remyjkim/mindpass
