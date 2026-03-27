// ABOUTME: Live-gated black-box integration tests for the compiled mindpass binary
// ABOUTME: Verifies private-key x402 and Tempo flows through the real executable

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestServerHandle } from '@mindpass/test-server';
import { makeTempConfigHome, runMindpass } from './cli-binary-test-helpers.js';
import { startLocalPaymentTestServer } from './test-helpers.js';

const skip =
  !process.env['RUN_INTEGRATION_TESTS'] ||
  !process.env['TEST_PRIVATE_KEY'] ||
  !process.env['TEMPO_RPC_URL'];

describe.skipIf(skip)('mindpass binary live integrations', () => {
  let server: TestServerHandle;

  beforeAll(async () => {
    server = await startLocalPaymentTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('fetches a local x402 endpoint through the real binary with a live private key', async () => {
    const result = await runMindpass({
      args: ['fetch', `${server.url}/x402/data`],
      env: {
        ...process.env,
        HOME: makeTempConfigHome(),
        MINDPASS_PRIVATE_KEY: process.env['TEST_PRIVATE_KEY']!,
        MINDPASS_CHAIN_IDS: 'eip155:84532',
      },
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('paid x402 content');
  });

  it('pays a local Tempo challenge through the real binary', async () => {
    const result = await runMindpass({
      args: ['pay', `${server.url}/mpp/data`],
      env: {
        ...process.env,
        HOME: makeTempConfigHome(),
        MINDPASS_PRIVATE_KEY: process.env['TEST_PRIVATE_KEY']!,
        MINDPASS_CHAIN_IDS: 'eip155:42431',
        MINDPASS_RPC_TEMPO: process.env['TEMPO_RPC_URL']!,
        MINDPASS_TEMPO_GAS: '200000',
      },
      timeoutMs: 20_000,
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('paid mpp content');
  });
});
