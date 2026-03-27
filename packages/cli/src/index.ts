// ABOUTME: Public API surface for mindwallet CLI package
// ABOUTME: Re-exports router factory and configuration helpers

export { loadConfig, saveConfig, configPath } from './config.js';
export type { MindwalletConfig, PolicyRuleConfig } from './config.js';
export { routerFromConfig } from './router-from-config.js';
export type { RouterContext } from './router-from-config.js';
export { createMcpServer, startMcpServer } from './mcp-server.js';
export { discoverCommand } from './commands/discover.js';
export type { DiscoverCommandOptions } from './commands/discover.js';
export { searchCommand } from './commands/search.js';
export type { SearchCommandOptions } from './commands/search.js';
export { keyCreateCommand, keyRevokeCommand, keyListCommand } from './commands/key.js';
export type { KeyCreateOptions, KeyRevokeOptions, KeyListOptions } from './commands/key.js';
