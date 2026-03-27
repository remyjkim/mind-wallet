// ABOUTME: Black-box tests for binary config resolution and config-backed CLI flows
// ABOUTME: Verifies the compiled CLI works with env-only and file-backed configuration

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { TestServerHandle } from '@mindpass/test-server';
import { buildCliOnce, runMindpass, makeTempConfigHome, writeRawConfig } from './cli-binary-test-helpers.js';
import {
  createTempOwsFixture,
  startLocalPaymentTestServer,
  startSiwxTestServer,
  TEST_PRIVATE_KEY,
  type SiwxTestServer,
} from './test-helpers.js';

describe('mindpass binary config resolution', () => {
  let server: TestServerHandle;
  let siwxServer: SiwxTestServer;

  beforeAll(async () => {
    await buildCliOnce();
    server = await startLocalPaymentTestServer();
    siwxServer = await startSiwxTestServer();
  }, 60_000);

  afterAll(async () => {
    if (server) await server.close();
    if (siwxServer) await siwxServer.close();
  });

  it('accepts MINDPASS_PRIVATE_KEY without a config file for pay flows', async () => {
    const home = makeTempConfigHome();
    const result = await runMindpass({
      args: ['pay', `${server.url}/x402/data`],
      env: {
        ...process.env,
        HOME: home,
        MINDPASS_PRIVATE_KEY: TEST_PRIVATE_KEY,
        MINDPASS_CHAIN_IDS: 'eip155:84532',
      },
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('paid x402 content');
  });

  it('accepts MINDPASS_PRIVATE_KEY without a config file for pay flows', async () => {
    const home = makeTempConfigHome();
    const result = await runMindpass({
      args: ['pay', `${server.url}/x402/data`],
      env: {
        ...process.env,
        HOME: home,
        MINDPASS_PRIVATE_KEY: TEST_PRIVATE_KEY,
        MINDPASS_CHAIN_IDS: 'eip155:84532',
      },
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('paid x402 content');
  });

  it('fails clearly when config JSON is malformed', async () => {
    const home = makeTempConfigHome();
    writeRawConfig(home, '{not-json');

    const result = await runMindpass({
      args: ['wallet'],
      env: {
        ...process.env,
        HOME: home,
      },
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Expected property name');
  });

  it('uses a file-backed OWS config for wallet and key flows', async () => {
    const fixture = createTempOwsFixture();

    const walletResult = await runMindpass({
      args: ['wallet'],
      env: {
        ...process.env,
        HOME: fixture.home,
      },
    });
    expect(walletResult.code).toBe(0);
    expect(walletResult.stdout).toContain('Wallet: default');
    expect(walletResult.stdout).toContain('Accounts (');

    const createResult = await runMindpass({
      args: ['key', 'create', 'binary-test-key'],
      env: {
        ...process.env,
        HOME: fixture.home,
        OWS_PASSPHRASE: '',
      },
    });
    expect(createResult.code).toBe(0);
    expect(createResult.stdout).toContain('Key created:');
    expect(createResult.stdout).toContain('Token:');

    const listResult = await runMindpass({
      args: ['key', 'list'],
      env: {
        ...process.env,
        HOME: fixture.home,
      },
    });
    expect(listResult.code).toBe(0);
    expect(listResult.stdout).toContain('binary-test-key');

    const keyId = createResult.stdout.match(/ID:\s+([^\n]+)/)?.[1];
    expect(keyId).toBeTruthy();

    const revokeResult = await runMindpass({
      args: ['key', 'revoke', keyId!],
      env: {
        ...process.env,
        HOME: fixture.home,
      },
    });
    expect(revokeResult.code).toBe(0);
    expect(revokeResult.stdout).toContain(`Key ${keyId} revoked.`);
  });

  it('supports local OWS SIWX fetch and pay flows through the binary', async () => {
    const fixture = createTempOwsFixture({ walletId: 'test-wallet' });

    const fetchResult = await runMindpass({
      args: ['fetch', `${siwxServer.url}/resource`],
      env: {
        ...process.env,
        HOME: fixture.home,
      },
    });
    expect(fetchResult.code).toBe(0);
    expect(fetchResult.stdout).toContain('protected content');

    const payResult = await runMindpass({
      args: ['pay', `${siwxServer.url}/resource`, '--verbose'],
      env: {
        ...process.env,
        HOME: fixture.home,
      },
    });
    expect(payResult.code).toBe(0);
    expect(payResult.stdout).toContain('protected content');
    expect(payResult.stderr).toContain('payment candidate');
    expect(payResult.stderr).toContain('HTTP 200');
  });

  it('supports local private-key x402 fetch and pay flows through the binary', async () => {
    const home = makeTempConfigHome();

    const fetchResult = await runMindpass({
      args: ['fetch', `${server.url}/x402/data`],
      env: {
        ...process.env,
        HOME: home,
        MINDPASS_PRIVATE_KEY: TEST_PRIVATE_KEY,
        MINDPASS_CHAIN_IDS: 'eip155:84532',
      },
    });
    expect(fetchResult.code).toBe(0);
    expect(fetchResult.stdout).toContain('paid x402 content');

    const payResult = await runMindpass({
      args: ['pay', `${server.url}/x402/data`, '--verbose'],
      env: {
        ...process.env,
        HOME: home,
        MINDPASS_PRIVATE_KEY: TEST_PRIVATE_KEY,
        MINDPASS_CHAIN_IDS: 'eip155:84532',
      },
    });
    expect(payResult.code).toBe(0);
    expect(payResult.stdout).toContain('paid x402 content');
    expect(payResult.stderr).toContain('x402');
    expect(payResult.stderr).toContain('HTTP 200');
  });

  it('reports local tempo candidates in verbose pay output through the binary', async () => {
    const home = makeTempConfigHome();

    const result = await runMindpass({
      args: ['pay', `${server.url}/mpp/data`, '--verbose'],
      env: {
        ...process.env,
        HOME: home,
        MINDPASS_PRIVATE_KEY: TEST_PRIVATE_KEY,
        MINDPASS_CHAIN_IDS: 'eip155:8453',
      },
    });

    expect(result.code).toBe(0);
    expect(result.stderr).toContain('tempo');
  });

  it('discovers SIWX payment requirements through the binary', async () => {
    const result = await runMindpass({
      args: ['discover', `${siwxServer.url}/resource`],
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('payment candidate');
    expect(result.stdout).toContain('protocol=siwx');
  });

  it('prints discover results as JSON with --json', async () => {
    const result = await runMindpass({
      args: ['discover', `${siwxServer.url}/resource`, '--json'],
    });

    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.requires402).toBe(true);
    expect(parsed.candidates[0].protocol).toBe('siwx');
  });

  it('discovers x402 payment requirements through the binary in private-key mode', async () => {
    const result = await runMindpass({
      args: ['discover', `${server.url}/x402/data`],
      env: {
        ...process.env,
        HOME: makeTempConfigHome(),
        MINDPASS_PRIVATE_KEY: TEST_PRIVATE_KEY,
        MINDPASS_CHAIN_IDS: 'eip155:84532',
      },
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('protocol=x402');
  });

  it('discovers tempo payment requirements through the binary in private-key mode', async () => {
    const result = await runMindpass({
      args: ['discover', `${server.url}/mpp/data`],
      env: {
        ...process.env,
        HOME: makeTempConfigHome(),
        MINDPASS_PRIVATE_KEY: TEST_PRIVATE_KEY,
        MINDPASS_CHAIN_IDS: 'eip155:8453',
      },
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('method=tempo');
  });

  it('searches a local registry through the binary', async () => {
    const registry = createServer((req, res) => {
      if (req.url?.startsWith('/origins')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([
          {
            origin: 'https://registry.example.test',
            protocols: ['x402'],
            description: 'Binary test registry entry',
          },
        ]));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => registry.listen(0, '127.0.0.1', () => resolve()));
    const address = registry.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const result = await runMindpass({
        args: ['search', 'registry', '--protocol', 'x402'],
        env: {
          ...process.env,
          MINDPASS_REGISTRY_URL: `http://127.0.0.1:${port}`,
        },
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('https://registry.example.test');
      expect(result.stdout).toContain('x402');

      const jsonResult = await runMindpass({
        args: ['search', 'registry', '--protocol', 'x402', '--json'],
        env: {
          ...process.env,
          MINDPASS_REGISTRY_URL: `http://127.0.0.1:${port}`,
        },
      });

      expect(jsonResult.code).toBe(0);
      const parsed = JSON.parse(jsonResult.stdout);
      expect(parsed[0].origin).toBe('https://registry.example.test');
      expect(parsed[0].protocols).toContain('x402');
    } finally {
      await new Promise<void>((resolve, reject) =>
        registry.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('uses MINDPASS_REGISTRY_URL through the binary', async () => {
    const registry = createServer((req, res) => {
      if (req.url?.startsWith('/origins')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ origin: 'https://mindpass-registry.example.test', protocols: ['x402'] }]));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => registry.listen(0, '127.0.0.1', () => resolve()));
    const address = registry.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const result = await runMindpass({
        args: ['search', 'registry', '--protocol', 'x402'],
        env: {
          ...process.env,
          MINDPASS_REGISTRY_URL: `http://127.0.0.1:${port}`,
        },
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('https://mindpass-registry.example.test');
    } finally {
      await new Promise<void>((resolve, reject) =>
        registry.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
