// ABOUTME: Public API surface for @mindpass/discovery
// ABOUTME: Re-exports origin probing and registry search utilities

export { probeOrigin } from './prober.js';
export type { ProbeResult } from './prober.js';

export { searchRegistry } from './registry.js';
export type { OriginRecord, RegistrySearchOptions } from './registry.js';

export { searchHubRegistry } from './hub-registry.js';
export type { HubRegistrySearchOptions } from './hub-registry.js';

export { auditPaidResponse, auditWwwAuthenticate, auditX402Challenge } from './audit.js';
export type { AuditResult, AuditWarning, AuditWarningCode } from './audit.js';
