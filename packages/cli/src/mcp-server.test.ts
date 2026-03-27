// ABOUTME: Integration tests for MCP server tools using in-memory transport
// ABOUTME: Exercises fetch_with_payment and probe_origin tools against a local SIWX test server

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWallet } from '@open-wallet-standard/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { TestServerHandle } from '@mindpass/test-server';
import { createMcpServer } from './mcp-server.js';
import type { MindpassConfig } from './config.js';
import {
  makePrivateKeyConfig,
  startLocalPaymentTestServer,
  startSiwxTestServer,
  type SiwxTestServer,
} from './test-helpers.js';

describe('createMcpServer metadata', () => {
  it('registers the server as mindpass', () => {
    const server = createMcpServer(makePrivateKeyConfig());
    expect(((server.server as unknown) as { _serverInfo?: { name?: string } })._serverInfo?.name).toBe('mindpass');
  });
});

const skip = !process.env['RUN_INTEGRATION_TESTS'] || !process.env['OWS_PASSPHRASE'];
const pkSkip = !process.env['RUN_INTEGRATION_TESTS'];
const tempoSkip =
  !process.env['RUN_INTEGRATION_TESTS'] ||
  !process.env['TEST_PRIVATE_KEY'] ||
  !process.env['TEMPO_RPC_URL'];

// ---------------------------------------------------------------------------
// Error server (unique to this test file)
// ---------------------------------------------------------------------------

interface ErrorServerState {
  port: number;
  close: () => Promise<void>;
}

function startErrorServer(): Promise<ErrorServerState> {
  const server = createServer((_req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(skip)('MCP server tools: SIWX 402 integration (local server)', () => {
  let srv: SiwxTestServer;
  let errSrv: ErrorServerState;
  let vaultPath: string;
  let client: Client;

  beforeAll(async () => {
    srv = await startSiwxTestServer();
    errSrv = await startErrorServer();

    vaultPath = mkdtempSync(join(tmpdir(), 'mw-mcp-test-'));
    createWallet('test-wallet', undefined, 12, vaultPath);

    const config: MindpassConfig = {
      walletId: 'test-wallet',
      vaultPath,
    };

    const mcpServer = createMcpServer(config);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await Promise.all([
      client.connect(clientTransport),
      mcpServer.connect(serverTransport),
    ]);
  });

  afterAll(async () => {
    await srv.close();
    await errSrv.close();
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('fetch_with_payment resolves SIWX 402 and returns response', async () => {
    const result = await client.callTool({
      name: 'fetch_with_payment',
      arguments: { url: `${srv.url}/data` },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('protected content');
    expect(result.isError).toBeFalsy();
  });

  it('fetch_with_payment returns error for failed request', async () => {
    const result = await client.callTool({
      name: 'fetch_with_payment',
      arguments: { url: `http://127.0.0.1:${errSrv.port}/fail` },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('500');
  });

  it('probe_origin detects SIWX payment requirement', async () => {
    const result = await client.callTool({
      name: 'probe_origin',
      arguments: { url: `${srv.url}/data` },
    });
    const parsed = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
    expect(parsed.requires402).toBe(true);
    expect(parsed.candidates[0].protocol).toBe('siwx');
  });

  it('probe_origin reports unreachable for bad URL', async () => {
    const result = await client.callTool({
      name: 'probe_origin',
      arguments: { url: 'http://127.0.0.1:1/unreachable' },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('Unreachable');
  });
});

describe.skipIf(pkSkip)('MCP server tools: private key x402 integration', () => {
  let server: TestServerHandle;
  let client: Client;

  beforeAll(async () => {
    server = await startLocalPaymentTestServer();
    const mcpServer = createMcpServer(makePrivateKeyConfig({ chainIds: ['eip155:84532'] }));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)]);
  });

  afterAll(async () => {
    await server.close();
  });

  it('fetch_with_payment resolves x402 and returns paid content', async () => {
    const result = await client.callTool({
      name: 'fetch_with_payment',
      arguments: { url: `${server.url}/x402/data` },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('paid x402 content');
    expect(result.isError).toBeFalsy();
  });

  it('probe_origin detects x402 candidates', async () => {
    const result = await client.callTool({
      name: 'probe_origin',
      arguments: { url: `${server.url}/x402/data` },
    });
    const parsed = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
    expect(parsed.requires402).toBe(true);
    expect(parsed.candidates[0].protocol).toBe('x402');
  });
});

describe.skipIf(pkSkip)('MCP server tools: local Tempo challenge discovery', () => {
  let server: TestServerHandle;
  let client: Client;

  beforeAll(async () => {
    server = await startLocalPaymentTestServer();
    const mcpServer = createMcpServer(makePrivateKeyConfig());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)]);
  });

  afterAll(async () => {
    await server.close();
  });

  it('probe_origin detects tempo candidates from local MPP challenge', async () => {
    const result = await client.callTool({
      name: 'probe_origin',
      arguments: { url: `${server.url}/mpp/data` },
    });
    const parsed = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
    expect(parsed.requires402).toBe(true);
    expect(parsed.candidates.some((c: { method: string }) => c.method === 'tempo')).toBe(true);
  });
});

describe.skipIf(tempoSkip)('MCP server tools: live Tempo integration', () => {
  let server: TestServerHandle;
  let client: Client;

  beforeAll(async () => {
    server = await startLocalPaymentTestServer();
    const mcpServer = createMcpServer({
      privateKey: process.env['TEST_PRIVATE_KEY'] as `0x${string}`,
      chainIds: ['eip155:42431'],
      rpcUrls: { tempo: process.env['TEMPO_RPC_URL']! },
      tempoGas: '200000',
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '0.0.1' });
    await Promise.all([client.connect(clientTransport), mcpServer.connect(serverTransport)]);
  });

  afterAll(async () => {
    await server.close();
  });

  it('fetch_with_payment resolves a local Tempo challenge and returns paid content', async () => {
    const result = await client.callTool({
      name: 'fetch_with_payment',
      arguments: { url: `${server.url}/mpp/data` },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('paid mpp content');
    expect(result.isError).toBeFalsy();
  });
});
