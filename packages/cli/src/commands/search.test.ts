// ABOUTME: Unit tests for the search command
// ABOUTME: Tests output formatting with injected fetch — no network I/O occurs

import { describe, it, expect, vi } from 'vitest';
import { searchCommand } from './search.js';

describe('searchCommand', () => {
  it('prints each matching origin', async () => {
    const records = [
      { origin: 'https://api.example.com', protocols: ['siwx'], description: 'Example API' },
      { origin: 'https://other.dev', protocols: ['x402', 'mpp'] },
    ];
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(records), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const lines: string[] = [];
    await searchCommand('example', { fetch, output: l => lines.push(l) });
    const all = lines.join('\n');
    expect(all).toContain('https://api.example.com');
    expect(all).toContain('https://other.dev');
  });

  it('prints protocols alongside each origin', async () => {
    const records = [{ origin: 'https://api.example.com', protocols: ['x402', 'siwx'] }];
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(records), { status: 200 }),
    );
    const lines: string[] = [];
    await searchCommand('example', { fetch, output: l => lines.push(l) });
    const all = lines.join('\n');
    expect(all).toContain('x402');
    expect(all).toContain('siwx');
  });

  it('reports no results when registry returns empty array', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    const lines: string[] = [];
    await searchCommand('nothing', { fetch, output: l => lines.push(l) });
    expect(lines.some(l => /no results/i.test(l))).toBe(true);
  });

  it('reports no results when registry is unreachable', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const lines: string[] = [];
    await searchCommand('query', { fetch, output: l => lines.push(l) });
    expect(lines.some(l => /no results/i.test(l))).toBe(true);
  });

  it('passes the query string to the registry URL', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    await searchCommand('payments api', { fetch, output: () => {} });
    const calledUrl = fetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('payments+api');
  });
});
