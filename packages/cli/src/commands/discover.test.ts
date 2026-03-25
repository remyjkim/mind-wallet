// ABOUTME: Unit tests for the discover command
// ABOUTME: Tests output formatting — fetch and methods are injected so no I/O occurs

import { describe, it, expect, vi } from 'vitest';
import { discoverCommand } from './discover.js';
import { createSiwxMethod } from '@mindwallet/protocols';

function makeFetch(status: number, body = '', headers: Record<string, string> = {}) {
  return vi.fn().mockResolvedValue(
    new Response(body, { status, headers }),
  );
}

const methods = [createSiwxMethod()];

describe('discoverCommand', () => {
  it('reports unreachable when fetch throws', async () => {
    const lines: string[] = [];
    const fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await discoverCommand('https://api.example.com', { methods, fetch, output: l => lines.push(l) });
    expect(lines.some(l => l.includes('Unreachable'))).toBe(true);
  });

  it('reports no payment required for a 200 response', async () => {
    const lines: string[] = [];
    await discoverCommand('https://api.example.com', {
      methods,
      fetch: makeFetch(200),
      output: l => lines.push(l),
    });
    expect(lines.some(l => /no payment required/i.test(l))).toBe(true);
  });

  it('reports no payment required for a non-402 response', async () => {
    const lines: string[] = [];
    await discoverCommand('https://api.example.com', {
      methods,
      fetch: makeFetch(403),
      output: l => lines.push(l),
    });
    expect(lines.some(l => /no payment required/i.test(l))).toBe(true);
  });

  it('lists SIWX candidate from body extensions on 402', async () => {
    const body = JSON.stringify({
      extensions: {
        'sign-in-with-x': {
          domain: 'api.example.com',
          nonce: 'test-nonce-123',
          chainId: 'eip155:8453',
        },
      },
    });
    const lines: string[] = [];
    await discoverCommand('https://api.example.com', {
      methods,
      fetch: makeFetch(402, body, { 'Content-Type': 'application/json' }),
      output: l => lines.push(l),
    });
    const all = lines.join('\n');
    expect(all).toContain('siwx');
  });

  it('reports no candidates found when 402 has no recognised challenges', async () => {
    const lines: string[] = [];
    await discoverCommand('https://api.example.com', {
      methods,
      fetch: makeFetch(402, '{}', { 'Content-Type': 'application/json' }),
      output: l => lines.push(l),
    });
    expect(lines.some(l => /no (payment )?candidates/i.test(l))).toBe(true);
  });
});
