# @mindwallet/protocols

Concrete `RouterMethod` implementations for the payment protocols supported by `mindwallet`.

## Install

```bash
npm install @mindwallet/protocols
```

## Included Methods

- `createSiwxMethod()`
- `createX402Method()`
- `createTempoMethod()`

## Minimal Example

```ts
import { createSiwxMethod, createTempoMethod, createX402Method } from '@mindwallet/protocols';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');

const methods = [
  createSiwxMethod(),
  createX402Method({ account }),
  createTempoMethod({ account }),
];
```

See the root repo for end-to-end router examples:
https://github.com/remyjkim/mind-wallet
