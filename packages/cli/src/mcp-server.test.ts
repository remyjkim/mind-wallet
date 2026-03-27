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
import { createMcpServer } from './mcp-server.js';
import type { MindwalletConfig } from './config.js';

const skip = !process.env['RUN_INTEGRATION_TESTS'] || !process.env['OWS_PASSPHRASE'];

// ---------------------------------------------------------------------------
// Local SIWX test server
// ---------------------------------------------------------------------------

interface ServerState {
  port: number;
  close: () => Promise<void>;
}

function startTestServer(): Promise<ServerState> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const authorization = req.headers['authorization'];

    if (!authorization) {
      const challenge = {
        domain: 'localhost',
        walletId: 'test-wallet',
        chainId: 'eip155:8453',
        nonce: `nonce-${Date.now()}`,
      };

      res.writeHead(402, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(
        JSON.stringify({
          error: 'payment_required',
          extensions: {
            'sign-in-with-x': challenge,
          },
        }),
      );
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({ data: 'protected content' }));
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

function startErrorServer(): Promise<ServerState> {
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
  let srv: ServerState;
  let errSrv: ServerState;
  let vaultPath: string;
  let client: Client;

  beforeAll(async () => {
    srv = await startTestServer();
    errSrv = await startErrorServer();

    vaultPath = mkdtempSync(join(tmpdir(), 'mw-mcp-test-'));
    createWallet('test-wallet', undefined, 12, vaultPath);

    const config: MindwalletConfig = {
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
      arguments: { url: `http://127.0.0.1:${srv.port}/data` },
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
      arguments: { url: `http://127.0.0.1:${srv.port}/data` },
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
