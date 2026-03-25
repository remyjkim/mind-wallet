// ABOUTME: MCP server that exposes mindwallet as a tool for AI agents
// ABOUTME: Provides fetch_with_payment and probe_origin tools over stdio transport

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { wrapFetch, createMemoryStore, createRouter, OwsWalletAdapter } from '@mindwallet/core';
import { createSiwxMethod } from '@mindwallet/protocols';
import { probeOrigin } from '@mindwallet/discovery';
import type { MindwalletConfig } from './config.js';

/**
 * Creates and starts an MCP server that exposes mindwallet tools over stdio.
 */
export async function startMcpServer(config: MindwalletConfig): Promise<void> {
  const passphrase = config.passphrase ?? process.env['OWS_PASSPHRASE'];
  const wallet = new OwsWalletAdapter({
    walletId: config.walletId,
    vaultPath: config.vaultPath,
    passphrase,
  });

  const methods = [createSiwxMethod()];
  const state = createMemoryStore();
  const router = createRouter({ methods, state, policy: [] });
  const fetch = wrapFetch({ fetch: globalThis.fetch, router, state, wallet });

  const server = new McpServer({
    name: 'mindwallet',
    version: '0.1.0',
  });

  server.tool(
    'fetch_with_payment',
    'Fetch a URL, automatically handling HTTP 402 payment challenges',
    {
      url: z.string().url().describe('The URL to fetch'),
      method: z.string().optional().default('GET').describe('HTTP method'),
      headers: z.record(z.string()).optional().describe('Additional request headers'),
      body: z.string().optional().describe('Request body for POST/PUT requests'),
    },
    async ({ url, method, headers, body }) => {
      const response = await fetch(url, {
        method: method ?? 'GET',
        headers,
        body,
      });

      const responseBody = await response.text();
      const contentType = response.headers.get('content-type') ?? '';

      if (!response.ok) {
        return {
          content: [{
            type: 'text' as const,
            text: `HTTP ${response.status} ${response.statusText}\n${responseBody}`,
          }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: responseBody,
          mimeType: contentType || undefined,
        }],
      };
    },
  );

  server.tool(
    'probe_origin',
    'Probe an HTTP origin to discover its payment protocol requirements',
    {
      url: z.string().url().describe('The URL to probe'),
    },
    async ({ url }) => {
      const result = await probeOrigin(url, methods);

      if (!result.reachable) {
        return {
          content: [{ type: 'text' as const, text: `Unreachable: ${result.error}` }],
          isError: true,
        };
      }

      const summary = {
        url: result.url,
        requires402: result.requires402,
        candidates: result.candidates.map((c) => ({
          protocol: c.protocol,
          method: c.normalized.method,
          intent: c.normalized.intent,
          amount: c.normalized.amount?.toString(),
          currency: c.normalized.currency,
        })),
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
