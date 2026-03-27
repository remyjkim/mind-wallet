---
sidebar_position: 3
---

# @mindpass/discovery

Pre-flight origin probing and registry search.

## probeOrigin

Probes a URL to discover its payment protocol requirements before making a paid request.

```typescript
import { probeOrigin } from '@mindpass/discovery';
import { createSiwxMethod, createX402Method } from '@mindpass/protocols';

const methods = [createSiwxMethod(), createX402Method({ account })];
const result = await probeOrigin('https://api.example.com/data', methods);

if (result.reachable) {
  console.log('Requires 402:', result.requires402);
  console.log('Candidates:', result.candidates);
}
```

## CLI Usage

```bash
# Discover payment requirements for a URL
mindpass discover https://api.example.com

# Search the registry for paid APIs
mindpass search "weather data"
```
