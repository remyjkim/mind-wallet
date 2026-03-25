// ABOUTME: Integration test for createX402Method.createCredential with a real viem account
// ABOUTME: Skipped unless RUN_INTEGRATION_TESTS=1 and TEST_PRIVATE_KEY are set

import { describe, it, expect, beforeAll } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { createX402Method } from './x402.js';

const skip = !process.env['RUN_INTEGRATION_TESTS'] || !process.env['TEST_PRIVATE_KEY'];

// Base mainnet USDC contract address
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

describe.skipIf(skip)('createX402Method — createCredential (integration)', () => {
  let method: ReturnType<typeof createX402Method>;

  beforeAll(() => {
    const account = privateKeyToAccount(process.env['TEST_PRIVATE_KEY'] as `0x${string}`);
    method = createX402Method({ account });
  });

  it('returns an X-PAYMENT header string', async () => {
    const candidate = {
      id: 'c1',
      protocol: 'x402' as const,
      method,
      normalized: {
        realm: 'https://api.example.com',
        protocol: 'x402' as const,
        method: 'x402',
        intent: 'charge' as const,
        amount: 100n,
        currency: 'USDC',
        hasDigestBinding: false,
      },
      raw: {
        x402Version: 2,
        accepts: [{
          scheme: 'exact',
          network: 'eip155:8453',
          maxAmountRequired: '100',
          payTo: '0x0000000000000000000000000000000000000001' as `0x${string}`,
          asset: USDC_BASE,
          resource: 'https://api.example.com/',
          description: 'Test payment',
          mimeType: 'application/json',
          maxTimeoutSeconds: 300,
          outputSchema: null,
          extra: null,
        }],
      },
      eligible: true,
    };

    const headers = await method.createCredential({ candidate, wallet: null as any });
    expect(headers['X-PAYMENT']).toBeDefined();
    expect(typeof headers['X-PAYMENT']).toBe('string');
    expect((headers['X-PAYMENT'] as string).length).toBeGreaterThan(10);
  });
});
