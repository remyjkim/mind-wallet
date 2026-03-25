// ABOUTME: Unit tests for the compliance auditor
// ABOUTME: Covers all AuditWarningCode values across the three audit functions

import { describe, it, expect } from 'vitest';
import { auditPaidResponse, auditWwwAuthenticate, auditX402Challenge } from './audit.js';

describe('auditPaidResponse', () => {
  it('returns ok when Payment-Receipt header is present', () => {
    const response = new Response('ok', {
      status: 200,
      headers: { 'Payment-Receipt': 'dGVzdA' },
    });
    const result = auditPaidResponse(response);
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns MISSING_RECEIPT_HEADER when Payment-Receipt is absent', () => {
    const response = new Response('ok', { status: 200 });
    const result = auditPaidResponse(response);
    expect(result.ok).toBe(false);
    expect(result.warnings[0]?.code).toBe('MISSING_RECEIPT_HEADER');
  });
});

describe('auditWwwAuthenticate', () => {
  it('returns ok for a well-formed Payment challenge', () => {
    const result = auditWwwAuthenticate('Payment realm="https://api.example.com" method="tempo" intent="charge"');
    expect(result.ok).toBe(true);
  });

  it('warns MALFORMED_WWW_AUTHENTICATE for a bare scheme name', () => {
    const result = auditWwwAuthenticate('Bearer');
    expect(result.warnings[0]?.code).toBe('MALFORMED_WWW_AUTHENTICATE');
  });

  it('warns EXPIRED_CHALLENGE when expires is in the past', () => {
    const past = new Date(Date.now() - 10_000).toISOString();
    const result = auditWwwAuthenticate(`SIWX realm="x" expires="${past}" nonce="abc"`);
    const codes = result.warnings.map(w => w.code);
    expect(codes).toContain('EXPIRED_CHALLENGE');
  });

  it('does not warn EXPIRED_CHALLENGE when expires is in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const result = auditWwwAuthenticate(`Payment realm="x" method="m" intent="i" expires="${future}"`);
    const codes = result.warnings.map(w => w.code);
    expect(codes).not.toContain('EXPIRED_CHALLENGE');
  });

  it('warns SIWX_NO_NONCE when SIWX challenge lacks nonce', () => {
    const result = auditWwwAuthenticate('SIWX domain="api.example.com" realm="https://api.example.com"');
    const codes = result.warnings.map(w => w.code);
    expect(codes).toContain('SIWX_NO_NONCE');
  });

  it('does not warn SIWX_NO_NONCE when nonce is present', () => {
    const result = auditWwwAuthenticate('SIWX domain="api.example.com" realm="https://api.example.com" nonce="abc123"');
    expect(result.ok).toBe(true);
  });
});

describe('auditX402Challenge', () => {
  it('returns ok when payTo is present', () => {
    const result = auditX402Challenge({
      accepts: [{ payTo: '0xabc', network: 'base', maxAmountRequired: '100', asset: 'USDC' }],
    });
    expect(result.ok).toBe(true);
  });

  it('warns X402_MISSING_RECIPIENT when payTo is absent', () => {
    const result = auditX402Challenge({
      accepts: [{ network: 'base', maxAmountRequired: '100', asset: 'USDC' }],
    });
    expect(result.warnings[0]?.code).toBe('X402_MISSING_RECIPIENT');
  });

  it('returns ok when accepts is empty (no entry to validate)', () => {
    const result = auditX402Challenge({ accepts: [] });
    expect(result.ok).toBe(true);
  });
});
