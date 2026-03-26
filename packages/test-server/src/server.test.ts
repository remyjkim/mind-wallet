// ABOUTME: Smoke test for the test server lifecycle and payment challenge responses
// ABOUTME: Verifies health endpoint, x402 402 challenge format, and MPP 402 challenge format

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, type TestServerHandle } from './index.js';

// Use a throwaway address as recipient — no real funds needed for smoke tests
const RECIPIENT = '0x0000000000000000000000000000000000000001' as `0x${string}`;

describe('test-server smoke', () => {
  let server: TestServerHandle;

  beforeAll(async () => {
    server = await startTestServer({
      x402PayTo: RECIPIENT,
      mppRecipient: RECIPIENT,
      mppWaitForConfirmation: false,
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it('GET /health returns 200', async () => {
    const res = await fetch(`${server.url}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /x402/data without payment returns 402 with PAYMENT-REQUIRED header', async () => {
    const res = await fetch(`${server.url}/x402/data`);
    expect(res.status).toBe(402);

    const header = res.headers.get('payment-required');
    expect(header).toBeTruthy();

    const decoded = JSON.parse(Buffer.from(header!, 'base64url').toString('utf8'));
    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0].scheme).toBe('exact');
    expect(decoded.accepts[0].network).toBe('eip155:84532');
    expect(decoded.accepts[0].payTo).toBe(RECIPIENT);
  });

  it('GET /mpp/data without payment returns 402 with WWW-Authenticate header', async () => {
    const res = await fetch(`${server.url}/mpp/data`);
    expect(res.status).toBe(402);

    const wwwAuth = res.headers.get('www-authenticate');
    expect(wwwAuth).toBeTruthy();
    expect(wwwAuth).toContain('Payment');
  });

  it('GET /facilitator/supported returns supported schemes', async () => {
    const res = await fetch(`${server.url}/facilitator/supported`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kinds: unknown[] };
    expect(body.kinds).toHaveLength(1);
  });
});
