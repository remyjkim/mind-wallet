// ABOUTME: Compliance auditor for HTTP 402 payment endpoints
// ABOUTME: Checks responses and challenges for common server-side misconfigurations

export type AuditWarningCode =
  | 'MISSING_RECEIPT_HEADER'
  | 'MALFORMED_WWW_AUTHENTICATE'
  | 'EXPIRED_CHALLENGE'
  | 'SIWX_NO_NONCE'
  | 'X402_MISSING_RECIPIENT';

export interface AuditWarning {
  code: AuditWarningCode;
  message: string;
}

export interface AuditResult {
  warnings: AuditWarning[];
  ok: boolean;
}

/**
 * Audits a paid (non-402) response for missing receipt headers.
 */
export function auditPaidResponse(response: Response): AuditResult {
  const warnings: AuditWarning[] = [];

  if (!response.headers.get('Payment-Receipt')) {
    warnings.push({
      code: 'MISSING_RECEIPT_HEADER',
      message: 'Paid response is missing a Payment-Receipt header',
    });
  }

  return { warnings, ok: warnings.length === 0 };
}

/**
 * Audits a WWW-Authenticate header value for structural issues.
 */
export function auditWwwAuthenticate(headerValue: string): AuditResult {
  const warnings: AuditWarning[] = [];

  // Must have at least a scheme name followed by parameters
  if (!/^\s*\w+\s+\w+/.test(headerValue)) {
    warnings.push({
      code: 'MALFORMED_WWW_AUTHENTICATE',
      message: 'WWW-Authenticate header does not match expected format',
    });
    return { warnings, ok: false };
  }

  // Check for expired challenge (expires= or expires_at= field)
  const expiresMatch = headerValue.match(/expires(?:_at)?="([^"]+)"/i);
  if (expiresMatch) {
    const expiry = new Date(expiresMatch[1]!).getTime();
    if (!isNaN(expiry) && expiry < Date.now()) {
      warnings.push({
        code: 'EXPIRED_CHALLENGE',
        message: 'Challenge expires field is in the past',
      });
    }
  }

  // SIWX-specific: nonce is required to prevent replay attacks
  if (/^\s*SIWX\s/i.test(headerValue)) {
    if (!/nonce="[^"]+"/.test(headerValue)) {
      warnings.push({
        code: 'SIWX_NO_NONCE',
        message: 'SIWX challenge is missing the nonce parameter',
      });
    }
  }

  return { warnings, ok: warnings.length === 0 };
}

/**
 * Audits a decoded x402 PaymentRequired object for missing required fields.
 */
export function auditX402Challenge(paymentRequired: Record<string, unknown>): AuditResult {
  const warnings: AuditWarning[] = [];

  const accepts = (paymentRequired['accepts'] as Record<string, unknown>[] | undefined) ?? [];
  const first = accepts[0];
  if (first !== undefined && !first['payTo']) {
    warnings.push({
      code: 'X402_MISSING_RECIPIENT',
      message: 'x402 PaymentRequired is missing payTo in the first accepts entry',
    });
  }

  return { warnings, ok: warnings.length === 0 };
}
