// ABOUTME: Public API surface for @mindwallet/discovery
// ABOUTME: Re-exports origin probing and registry search utilities

export { probeOrigin } from './prober.js';
export type { ProbeResult } from './prober.js';

export { searchRegistry } from './registry.js';
export type { OriginRecord, RegistrySearchOptions } from './registry.js';
